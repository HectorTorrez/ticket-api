import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketTypesService } from './ticket-types.service';

@ApiTags('ticket-types')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(RolesGuard)
@Controller()
export class TicketTypesController {
  constructor(private readonly ticketTypesService: TicketTypesService) {}

  @Post('events/:eventId/ticket-types')
  @ApiOperation({ summary: 'Create ticket type for event' })
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTicketTypeDto,
  ) {
    return this.ticketTypesService.create(eventId, dto);
  }

  @Patch('ticket-types/:id')
  @ApiOperation({ summary: 'Update ticket type' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketTypeDto,
  ) {
    return this.ticketTypesService.update(id, dto);
  }

  @Delete('ticket-types/:id')
  @ApiOperation({ summary: 'Delete ticket type (only if unused)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketTypesService.remove(id);
  }
}
