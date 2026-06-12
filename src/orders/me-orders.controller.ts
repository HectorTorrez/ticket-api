import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { QueryMyOrdersDto } from './dto/query-my-orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@UseGuards(RolesGuard)
@Controller()
export class MeOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('me/orders')
  @ApiOperation({ summary: 'List current customer orders' })
  listMine(
    @CurrentUser() user: Express.UserPayload,
    @Query() query: QueryMyOrdersDto,
  ) {
    return this.ordersService.listMine(user.userId, query);
  }

  @Get('me/orders/:id')
  @ApiOperation({ summary: 'Get one order (current customer)' })
  findMine(
    @CurrentUser() user: Express.UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findMine(user.userId, id);
  }
}
