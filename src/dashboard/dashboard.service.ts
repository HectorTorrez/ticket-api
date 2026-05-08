import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const now = new Date();

    const [ticketsSold, revenueAgg, activeEvents, remainingInventory] = await Promise.all([
      this.prisma.ticket.count(),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID },
        _sum: { totalAmount: true },
      }),
      this.prisma.event.count({
        where: {
          deletedAt: null,
          published: true,
          endsAt: { gt: now },
        },
      }),
      this.prisma.ticketType.aggregate({
        where: { event: { deletedAt: null } },
        _sum: { quantityRemaining: true },
      }),
    ]);

    return {
      ticketsSold,
      totalRevenue: revenueAgg._sum.totalAmount?.toString() ?? '0',
      activeEvents,
      remainingInventory: remainingInventory._sum.quantityRemaining ?? 0,
    };
  }
}
