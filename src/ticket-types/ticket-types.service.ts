import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { InventoryGateway } from '../websocket/inventory.gateway';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class TicketTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly inventoryGateway: InventoryGateway,
  ) {}

  async create(eventId: string, dto: CreateTicketTypeDto) {
    await this.eventsService.requireEventForAdmin(eventId);

    const saleStartsAt = dto.saleStartsAt
      ? new Date(dto.saleStartsAt)
      : undefined;
    const saleEndsAt = dto.saleEndsAt ? new Date(dto.saleEndsAt) : undefined;

    try {
      const created = await this.prisma.ticketType.create({
        data: {
          eventId,
          tier: dto.tier,
          name: dto.name,
          price: new Prisma.Decimal(dto.price),
          quantityTotal: dto.quantity,
          quantityRemaining: dto.quantity,
          saleStartsAt,
          saleEndsAt,
        },
      });
      this.inventoryGateway.emitTicketUpdate({
        eventId,
        ticketTypeId: created.id,
        remaining: created.quantityRemaining,
        updatedAt: created.updatedAt.toISOString(),
      });
      return created;
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? String((e as { code?: string }).code)
          : '';
      if (code === 'P2002') {
        throw new ConflictException(
          'Ya existe un tipo de entrada para este nivel en el evento',
        );
      }
      throw e;
    }
  }

  async update(ticketTypeId: string, dto: UpdateTicketTypeDto) {
    const existing = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      include: { event: true },
    });
    if (!existing || existing.event.deletedAt) {
      throw new NotFoundException('Tipo de entrada no encontrado');
    }

    const sold = existing.quantityTotal - existing.quantityRemaining;
    const nextTotal = dto.quantity ?? existing.quantityTotal;
    if (nextTotal < sold) {
      throw new ConflictException(
        'La cantidad no puede ser menor que las entradas vendidas o reservadas',
      );
    }

    const nextRemaining =
      dto.quantity !== undefined
        ? nextTotal - sold
        : existing.quantityRemaining;

    try {
      const updated = await this.prisma.ticketType.update({
        where: { id: ticketTypeId },
        data: {
          tier: dto.tier,
          name: dto.name,
          price:
            dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
          quantityTotal: dto.quantity !== undefined ? nextTotal : undefined,
          quantityRemaining:
            dto.quantity !== undefined ? nextRemaining : undefined,
          saleStartsAt:
            dto.saleStartsAt !== undefined
              ? dto.saleStartsAt
                ? new Date(dto.saleStartsAt)
                : null
              : undefined,
          saleEndsAt:
            dto.saleEndsAt !== undefined
              ? dto.saleEndsAt
                ? new Date(dto.saleEndsAt)
                : null
              : undefined,
        },
      });
      this.inventoryGateway.emitTicketUpdate({
        eventId: existing.eventId,
        ticketTypeId: updated.id,
        remaining: updated.quantityRemaining,
        updatedAt: updated.updatedAt.toISOString(),
      });
      return updated;
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? String((e as { code?: string }).code)
          : '';
      if (code === 'P2002') {
        throw new ConflictException(
          'Ya existe un tipo de entrada para este nivel en el evento',
        );
      }
      throw e;
    }
  }

  async remove(ticketTypeId: string) {
    const existing = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      include: { event: true, orderLines: { take: 1 } },
    });
    if (!existing || existing.event.deletedAt) {
      throw new NotFoundException('Tipo de entrada no encontrado');
    }
    if (existing.orderLines.length > 0) {
      throw new ConflictException(
        'El tipo de entrada tiene pedidos y no puede eliminarse',
      );
    }

    await this.prisma.ticketType.delete({ where: { id: ticketTypeId } });
    return { deleted: true };
  }
}
