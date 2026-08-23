import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { V } from '../../common/validation-messages';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail({}, { message: V.email })
  email!: string;
}
