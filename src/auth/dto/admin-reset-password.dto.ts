import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { V } from '../../common/validation-messages';

export class AdminResetPasswordDto {
  @ApiProperty({ example: 'buyer@example.com' })
  @IsEmail({}, { message: V.email })
  email!: string;
}
