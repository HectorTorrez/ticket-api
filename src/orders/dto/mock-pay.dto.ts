import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { V } from '../../common/validation-messages';

export enum MockPayOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export class MockPayDto {
  @ApiProperty({ enum: MockPayOutcome })
  @IsEnum(MockPayOutcome, { message: V.enum })
  outcome!: MockPayOutcome;
}
