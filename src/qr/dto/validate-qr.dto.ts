import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ValidateQrDto {
  @ApiProperty({ description: 'Ticket publicCode read from QR payload' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  code!: string;
}
