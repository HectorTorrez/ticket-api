import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { V } from '../../common/validation-messages';

export const MY_TICKETS_WHEN = ['upcoming', 'past', 'all'] as const;
export type MyTicketsWhen = (typeof MY_TICKETS_WHEN)[number];

export class QueryMyTicketsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: MY_TICKETS_WHEN,
    default: 'upcoming',
    description:
      'Filtra por fecha del evento: upcoming (próximos), past (pasados) o all (todos).',
  })
  @IsOptional()
  @IsIn(MY_TICKETS_WHEN, { message: V.enum })
  when?: MyTicketsWhen;
}
