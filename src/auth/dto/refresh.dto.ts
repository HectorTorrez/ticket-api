import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { V } from '../../common/validation-messages';

export class RefreshDto {
  @ApiProperty()
  @IsString({ message: V.string })
  @MinLength(10, { message: V.minLength(10) })
  refreshToken!: string;
}
