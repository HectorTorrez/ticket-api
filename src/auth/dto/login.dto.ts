import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { V } from '../../common/validation-messages';

export class LoginDto {
  @ApiProperty()
  @IsEmail({}, { message: V.email })
  email!: string;

  @ApiProperty()
  @IsString({ message: V.string })
  password!: string;
}
