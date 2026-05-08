import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersExpiryScheduler {
  private readonly logger = new Logger(OrdersExpiryScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleOrders() {
    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      select: { id: true },
      take: 100,
    });

    for (const row of stale) {
      try {
        await this.ordersService.expireOrder(row.id);
      } catch (err) {
        this.logger.warn(`Failed to expire order ${row.id}: ${(err as Error).message}`);
      }
    }
  }
}
