import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryMyOrdersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
