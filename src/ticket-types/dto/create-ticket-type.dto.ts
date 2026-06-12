import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TicketTier } from '../../generated/prisma/enums';
import { V } from '../../common/validation-messages';

export class CreateTicketTypeDto {
  @ApiProperty({ enum: TicketTier })
  @IsEnum(TicketTier, { message: V.enum })
  tier!: TicketTier;

  @ApiProperty({ example: 'General admission' })
  @IsString({ message: V.string })
  @MaxLength(120, { message: V.maxLength(120) })
  name!: string;

  @ApiProperty({ example: 49.99 })
  @Type(() => Number)
  @Min(0, { message: V.min(0) })
  price!: number;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsInt({ message: V.int })
  @Min(1, { message: V.min(1) })
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: V.dateString })
  saleStartsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: V.dateString })
  saleEndsAt?: string;
}
