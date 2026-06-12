import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { QueryAdminEventsDto } from './dto/query-admin-events.dto';
import { EventsService } from './events.service';

@ApiTags('events-admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(RolesGuard)
@Controller('admin/events')
export class EventsAdminListController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({
    summary: 'List events (drafts + published; excludes soft-deleted)',
  })
  list(@Query() query: QueryAdminEventsDto) {
    return this.eventsService.listForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by id (draft or published)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findByIdForAdmin(id);
  }
}
