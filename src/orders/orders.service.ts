import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { InventoryGateway } from '../websocket/inventory.gateway';
import { paginationSkipTake } from '../common/dto/pagination-query.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { MockPayDto, MockPayOutcome } from './dto/mock-pay.dto';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';
import { QueryMyOrdersDto } from './dto/query-my-orders.dto';
import {
  loadOrderInventorySnapshotTx,
  restoreReservedInventory,
} from './order-inventory.utils';

function mergeLines(lines: CreateOrderDto['lines']) {
  const map = new Map<string, number>();
  for (const l of lines) {
    map.set(l.ticketTypeId, (map.get(l.ticketTypeId) ?? 0) + l.quantity);
  }
  return [...map.entries()].map(([ticketTypeId, quantity]) => ({
    ticketTypeId,
    quantity,
  }));
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly ticketsService: TicketsService,
    private readonly inventoryGateway: InventoryGateway,
  ) {}

  listMine(userId: string, query: QueryMyOrdersDto) {
    const { skip, take } = paginationSkipTake(query.page, query.limit);
    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    return Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          lines: {
            include: {
              ticketType: { select: { tier: true, name: true, price: true } },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  }

  async findMine(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { lines: { include: { ticketType: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  listForAdmin(query: QueryAdminOrdersDto) {
    const { skip, take } = paginationSkipTake(query.page, query.limit);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    return Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, email: true, role: true } },
          lines: { include: { ticketType: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  }

  async create(userId: string, dto: CreateOrderDto) {
    const ttlMinutes =
      this.configService.get<number>('ORDER_RESERVATION_TTL_MINUTES') ?? 15;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const normalized = mergeLines(dto.lines);

    const { orderId, snapshots } = await this.prisma.$transaction(
      async (tx) => {
        const ids = [...normalized.map((l) => l.ticketTypeId)].sort();
        for (const id of ids) {
          await tx.$executeRawUnsafe(
            `SELECT id FROM "TicketType" WHERE id = $1 FOR UPDATE`,
            id,
          );
        }

        let total = new Prisma.Decimal(0);
        const linesPayload: {
          ticketTypeId: string;
          quantity: number;
          unitPrice: Prisma.Decimal;
        }[] = [];

        const now = new Date();

        for (const line of normalized) {
          const tt = await tx.ticketType.findUnique({
            where: { id: line.ticketTypeId },
            include: { event: true },
          });
          if (!tt || tt.event.deletedAt) {
            throw new NotFoundException('Ticket type not found');
          }
          if (!tt.event.published) {
            throw new BadRequestException('Event is not on sale');
          }
          if (tt.saleStartsAt && now < tt.saleStartsAt) {
            throw new BadRequestException(
              'Sale has not started for this ticket type',
            );
          }
          if (tt.saleEndsAt && now > tt.saleEndsAt) {
            throw new BadRequestException(
              'Sale has ended for this ticket type',
            );
          }
          if (tt.quantityRemaining < line.quantity) {
            throw new ConflictException('Not enough tickets remaining');
          }

          total = total.add(tt.price.mul(line.quantity));
          linesPayload.push({
            ticketTypeId: tt.id,
            quantity: line.quantity,
            unitPrice: tt.price,
          });
        }

        for (const line of normalized) {
          await tx.ticketType.update({
            where: { id: line.ticketTypeId },
            data: { quantityRemaining: { decrement: line.quantity } },
          });
        }

        const order = await tx.order.create({
          data: {
            userId,
            status: OrderStatus.PENDING,
            totalAmount: total,
            expiresAt,
            lines: {
              create: linesPayload.map((l) => ({
                ticketTypeId: l.ticketTypeId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
              })),
            },
          },
        });

        const snapshots = await loadOrderInventorySnapshotTx(tx, order.id);
        return { orderId: order.id, snapshots };
      },
    );

    for (const s of snapshots) {
      this.inventoryGateway.emitTicketUpdate(s);
    }

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            ticketType: { select: { tier: true, name: true, price: true } },
          },
        },
      },
    });
  }

  async mockPay(userId: string, orderId: string, dto: MockPayDto) {
    const snapshots = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
        orderId,
      );

      const order = await tx.order.findUnique({
        where: { id: orderId },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.userId !== userId)
        throw new ForbiddenException('Not your order');

      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException('Order is not awaiting payment');
      }

      if (order.expiresAt < new Date()) {
        await restoreReservedInventory(tx, order.id);
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.EXPIRED },
        });
        return loadOrderInventorySnapshotTx(tx, order.id);
      }

      if (dto.outcome === MockPayOutcome.FAILURE) {
        await restoreReservedInventory(tx, order.id);
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.FAILED,
            paymentReference: 'mock_failed',
          },
        });
        return loadOrderInventorySnapshotTx(tx, order.id);
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          paymentReference: `mock_${Date.now()}`,
        },
      });

      await this.ticketsService.issueTicketsForPaidOrder(tx, order.id);

      return loadOrderInventorySnapshotTx(tx, order.id);
    });

    for (const s of snapshots) {
      this.inventoryGateway.emitTicketUpdate(s);
    }

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: { include: { ticketType: true } },
      },
    });
  }

  async cancel(userId: string, orderId: string) {
    const snapshots = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
        orderId,
      );

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.userId !== userId) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException('Only pending orders can be cancelled');
      }

      if (order.expiresAt < new Date()) {
        throw new GoneException('Reservation expired');
      }

      await restoreReservedInventory(tx, order.id);
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });

      return loadOrderInventorySnapshotTx(tx, order.id);
    });

    for (const s of snapshots) {
      this.inventoryGateway.emitTicketUpdate(s);
    }

    return { cancelled: true };
  }

  /** Called by scheduler when expiresAt passed */
  async expireOrder(orderId: string) {
    const snapshots = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`,
        orderId,
      );

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.PENDING) {
        return [];
      }
      if (order.expiresAt >= new Date()) {
        return [];
      }

      await restoreReservedInventory(tx, order.id);
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.EXPIRED },
      });

      return loadOrderInventorySnapshotTx(tx, order.id);
    });

    for (const s of snapshots) {
      this.inventoryGateway.emitTicketUpdate(s);
    }
  }
}
