import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  SortOrder,
} from '../../common/dto/sort-query.dto';
import { V } from '../../common/validation-messages';

export enum AdminOrderSortField {
  id = 'id',
  createdAt = 'createdAt',
  status = 'status',
  totalAmount = 'totalAmount',
  userEmail = 'userEmail',
}

export class QueryAdminOrdersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AdminOrderSortField, default: AdminOrderSortField.createdAt })
  @IsOptional()
  @IsEnum(AdminOrderSortField, { message: V.enum })
  sortBy?: AdminOrderSortField = AdminOrderSortField.createdAt;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.desc })
  @IsOptional()
  @IsEnum(SortOrder, { message: V.enum })
  sortOrder?: SortOrder = SortOrder.desc;
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus, { message: V.enum })
  status?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: V.uuid })
  userId?: string;
}
