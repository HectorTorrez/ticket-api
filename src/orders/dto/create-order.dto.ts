import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { V } from '../../common/validation-messages';

export class OrderLineInputDto {
  @ApiProperty()
  @IsUUID(undefined, { message: V.uuid })
  ticketTypeId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: V.int })
  @Min(1, { message: V.min(1) })
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderLineInputDto] })
  @IsArray({ message: V.array })
  @ArrayMinSize(1, { message: V.arrayMinSize(1) })
  @ValidateNested({ each: true })
  @Type(() => OrderLineInputDto)
  lines!: OrderLineInputDto[];
}
