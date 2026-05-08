import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { EventsService } from './events.service';
import { QueryPublishedEventsDto } from './dto/query-published-events.dto';

@ApiTags('events')
@Controller('events')
export class EventsPublicController {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published events' })
  list(@Query() query: QueryPublishedEventsDto) {
    return this.eventsService.listPublished(query);
  }

  @Public()
  @Get(':slugOrId')
  @ApiOperation({ summary: 'Get published event by slug or id' })
  getOne(@Param('slugOrId') slugOrId: string) {
    return this.eventsService.findPublishedBySlugOrId(slugOrId);
  }
}
