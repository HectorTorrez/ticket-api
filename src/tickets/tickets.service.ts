import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async issueTicketsForPaidOrder(tx: Prisma.TransactionClient, orderId: string) {
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

  listMine(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      include: {
        event: { select: { id: true, title: true, slug: true, startsAt: true, venue: true } },
        ticketType: { select: { tier: true, name: true } },
      },
    });
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
}
