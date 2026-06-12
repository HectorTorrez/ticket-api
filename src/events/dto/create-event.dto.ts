import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { V } from '../../common/validation-messages';

export class CreateEventDto {
  @ApiProperty()
  @IsString({ message: V.string })
  @MinLength(2, { message: V.minLength(2) })
  @MaxLength(200, { message: V.maxLength(200) })
  title!: string;

  @ApiPropertyOptional({ description: 'URL-safe slug; generated if omitted' })
  @IsOptional()
  @IsString({ message: V.string })
  @MaxLength(200, { message: V.maxLength(200) })
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: V.string })
  @MaxLength(5000, { message: V.maxLength(5000) })
  description?: string;

  @ApiProperty()
  @IsDateString({}, { message: V.dateString })
  startsAt!: string;

  @ApiProperty()
  @IsDateString({}, { message: V.dateString })
  endsAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: V.string })
  @MaxLength(300, { message: V.maxLength(300) })
  venue?: string;
}
