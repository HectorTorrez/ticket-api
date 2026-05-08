import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum MockPayOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export class MockPayDto {
  @ApiProperty({ enum: MockPayOutcome })
  @IsEnum(MockPayOutcome)
  outcome!: MockPayOutcome;
}
