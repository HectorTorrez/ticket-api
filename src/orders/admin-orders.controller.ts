import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders-admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(RolesGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders (admin)' })
  list(@Query() query: QueryAdminOrdersDto) {
    return this.ordersService.listForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Order detail (admin)' })
  detail(@Param('id') id: string) {
    return this.ordersService.findForAdmin(id);
  }
}
