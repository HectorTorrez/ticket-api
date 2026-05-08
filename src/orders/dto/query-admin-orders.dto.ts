import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryAdminOrdersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}
