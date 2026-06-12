import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { V } from '../../common/validation-messages';

export class QueryAdminEventsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Omit = returns drafts and published. `true` / `false` filter by `published` (query strings use true/false).',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: V.boolean })
  published?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: V.dateString })
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: V.dateString })
  to?: string;

  @ApiPropertyOptional({ description: 'Search title/slug' })
  @IsOptional()
  @IsString({ message: V.string })
  @MaxLength(120, { message: V.maxLength(120) })
  q?: string;
}
