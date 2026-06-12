import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { V } from '../../common/validation-messages';

export class ValidateQrDto {
  @ApiProperty({ description: 'Ticket publicCode read from QR payload' })
  @IsString({ message: V.string })
  @MinLength(8, { message: V.minLength(8) })
  @MaxLength(64, { message: V.maxLength(64) })
  code!: string;
}
