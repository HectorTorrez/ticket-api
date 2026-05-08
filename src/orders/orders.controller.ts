import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { MockPayDto } from '../orders/dto/mock-pay.dto';
import { OrdersService } from '../orders/orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@UseGuards(RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create pending order and reserve inventory' })
  create(@CurrentUser() user: Express.UserPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.userId, dto);
  }

  @Post(':id/mock-pay')
  @ApiOperation({ summary: 'Simulated payment (SUCCESS or FAILURE)' })
  mockPay(
    @CurrentUser() user: Express.UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MockPayDto,
  ) {
    return this.ordersService.mockPay(user.userId, id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel pending reservation' })
  cancel(@CurrentUser() user: Express.UserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.cancel(user.userId, id);
  }
}
