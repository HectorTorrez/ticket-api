import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryGateway } from './inventory.gateway';

@Module({
  imports: [AuthModule],
  providers: [InventoryGateway],
  exports: [InventoryGateway],
})
export class WebsocketModule {}
