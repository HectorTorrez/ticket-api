import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { TicketTypesController } from './ticket-types.controller';
import { TicketTypesService } from './ticket-types.service';

@Module({
  imports: [EventsModule, WebsocketModule],
  controllers: [TicketTypesController],
  providers: [TicketTypesService],
})
export class TicketTypesModule {}
