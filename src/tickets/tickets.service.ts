import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { paginationSkipTake } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import type {
  MyTicketsWhen,
  QueryMyTicketsDto,
} from './dto/query-my-tickets.dto';

const myTicketInclude = {
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      venue: true,
    },
  },
  ticketType: { select: { tier: true, name: true } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async issueTicketsForPaidOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            ticketType: { select: { eventId: true } },
          },
        },
      },
    });
    if (!order) {
      throw new Error(`Order ${orderId} not found while issuing tickets`);
    }

    for (const line of order.lines) {
      for (let i = 0; i < line.quantity; i++) {
        await tx.ticket.create({
          data: {
            orderLineId: line.id,
            userId: order.userId,
            eventId: line.ticketType.eventId,
            ticketTypeId: line.ticketTypeId,
          },
        });
      }
    }
  }

  async listMine(userId: string, query: QueryMyTicketsDto) {
    const when: MyTicketsWhen = query.when ?? 'upcoming';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = paginationSkipTake(page, limit);
    const now = new Date();

    const upcomingWhere = {
      userId,
      event: { startsAt: { gte: now } },
    } satisfies Prisma.TicketWhereInput;
    const pastWhere = {
      userId,
      event: { startsAt: { lt: now } },
    } satisfies Prisma.TicketWhereInput;

    const [upcoming, past] = await Promise.all([
      this.prisma.ticket.count({ where: upcomingWhere }),
      this.prisma.ticket.count({ where: pastWhere }),
    ]);

    const filteredTotal =
      when === 'upcoming' ? upcoming : when === 'past' ? past : upcoming + past;

    const items = await this.listMinePage(
      when,
      upcomingWhere,
      pastWhere,
      skip,
      take,
      upcoming,
    );

    return {
      items,
      total: filteredTotal,
      page,
      limit,
      counts: { upcoming, past, total: upcoming + past },
    };
  }

  private listMinePage(
    when: MyTicketsWhen,
    upcomingWhere: Prisma.TicketWhereInput,
    pastWhere: Prisma.TicketWhereInput,
    skip: number,
    take: number,
    upcomingCount: number,
  ) {
    if (when === 'upcoming') {
      return this.prisma.ticket.findMany({
        where: upcomingWhere,
        orderBy: { event: { startsAt: 'asc' } },
        skip,
        take,
        include: myTicketInclude,
      });
    }

    if (when === 'past') {
      return this.prisma.ticket.findMany({
        where: pastWhere,
        orderBy: { event: { startsAt: 'desc' } },
        skip,
        take,
        include: myTicketInclude,
      });
    }

    if (skip + take <= upcomingCount) {
      return this.prisma.ticket.findMany({
        where: upcomingWhere,
        orderBy: { event: { startsAt: 'asc' } },
        skip,
        take,
        include: myTicketInclude,
      });
    }

    if (skip >= upcomingCount) {
      return this.prisma.ticket.findMany({
        where: pastWhere,
        orderBy: { event: { startsAt: 'desc' } },
        skip: skip - upcomingCount,
        take,
        include: myTicketInclude,
      });
    }

    const fromUpcoming = upcomingCount - skip;
    return Promise.all([
      this.prisma.ticket.findMany({
        where: upcomingWhere,
        orderBy: { event: { startsAt: 'asc' } },
        skip,
        take: fromUpcoming,
        include: myTicketInclude,
      }),
      this.prisma.ticket.findMany({
        where: pastWhere,
        orderBy: { event: { startsAt: 'desc' } },
        skip: 0,
        take: take - fromUpcoming,
        include: myTicketInclude,
      }),
    ]).then(([upcomingItems, pastItems]) => [...upcomingItems, ...pastItems]);
  }

  async findPublicTicket(publicCode: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { publicCode },
      include: {
        event: { select: { title: true, startsAt: true, slug: true } },
        ticketType: { select: { tier: true, name: true } },
      },
    });
    if (!ticket) return null;
    return {
      publicCode: ticket.publicCode,
      status: ticket.status,
      event: ticket.event,
      ticketType: ticket.ticketType,
    };
  }

  async findTicketForPdf(publicCode: string) {
    return this.prisma.ticket.findUnique({
      where: { publicCode },
      select: {
        id: true,
        publicCode: true,
        pdfS3Key: true,
        event: {
          select: { id: true, title: true, startsAt: true, venue: true },
        },
        ticketType: { select: { name: true, tier: true } },
      },
    });
  }
}
