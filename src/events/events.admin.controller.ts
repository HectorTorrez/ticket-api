import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { S3Service } from '../aws/s3.service';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@ApiTags('events-admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(RolesGuard)
@Controller('events')
export class EventsAdminController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly s3Service: S3Service,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create event (draft)' })
  create(@CurrentUser() user: Express.UserPayload, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update event' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete event' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.eventsService.softDelete(id);
    return { deleted: true };
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish event' })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.publish(id, true);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish event' })
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.publish(id, false);
  }

  @Post(':id/banner')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload banner image to S3' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: '(image/jpeg|image/png|image/webp)',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    await this.eventsService.requireEventForAdmin(id);
    const { key, url } = await this.s3Service.putBanner(id, file.buffer, file.mimetype);
    return this.eventsService.setBanner(id, key, url);
  }
}
