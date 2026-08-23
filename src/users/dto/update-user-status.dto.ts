import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserStatus } from '../../generated/prisma/enums';
import { V } from '../../common/validation-messages';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus, { message: V.enum })
  status!: UserStatus;
}
