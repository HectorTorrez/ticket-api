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

export class CreateTicketTypeDto {
  @ApiProperty({ enum: TicketTier })
  @IsEnum(TicketTier)
  tier!: TicketTier;

  @ApiProperty({ example: 'General admission' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 49.99 })
  @Type(() => Number)
  @Min(0)
  price!: number;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  saleStartsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  saleEndsAt?: string;
}
