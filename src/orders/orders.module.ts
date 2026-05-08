import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { AdminOrdersController } from './admin-orders.controller';
import { MeOrdersController } from './me-orders.controller';
import { OrdersExpiryScheduler } from './orders-expiry.scheduler';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [TicketsModule, WebsocketModule],
  controllers: [OrdersController, MeOrdersController, AdminOrdersController],
  providers: [OrdersService, OrdersExpiryScheduler],
  exports: [OrdersService],
})
export class OrdersModule {}
