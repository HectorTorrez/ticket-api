import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { V } from '../validation-messages';

export enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

export class SortQueryDto {
  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.asc })
  @IsOptional()
  @IsEnum(SortOrder, { message: V.enum })
  sortOrder?: SortOrder = SortOrder.asc;
}

export function resolveSortOrder(
  sortOrder: SortOrder | undefined,
  defaultOrder: SortOrder,
): 'asc' | 'desc' {
  return sortOrder ?? defaultOrder;
}
