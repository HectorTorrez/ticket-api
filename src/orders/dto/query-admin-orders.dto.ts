import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { V } from '../../common/validation-messages';

export class QueryAdminOrdersDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus, { message: V.enum })
  status?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(undefined, { message: V.uuid })
  userId?: string;
}
