import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { V } from '../../common/validation-messages';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Single-use token from the reset link' })
  @IsString({ message: V.string })
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString({ message: V.string })
  @MinLength(8, { message: V.minLength(8) })
  newPassword!: string;
}
