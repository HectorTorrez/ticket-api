import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { V } from '../../common/validation-messages';

export class RegisterDto {
  @ApiProperty({ example: 'buyer@example.com' })
  @IsEmail({}, { message: V.email })
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString({ message: V.string })
  @MinLength(8, { message: V.minLength(8) })
  password!: string;
}
