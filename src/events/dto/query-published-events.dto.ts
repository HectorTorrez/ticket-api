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

export class QueryPublishedEventsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: true, description: 'Omit or true = published only; false = include drafts (still excludes soft-deleted).' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: V.boolean })
  publishedOnly?: boolean = true;

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
