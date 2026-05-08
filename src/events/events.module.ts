import { Module } from '@nestjs/common';
import { AwsS3Module } from '../aws/aws-s3.module';
import { EventsAdminController } from './events.admin.controller';
import { EventsPublicController } from './events.public.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AwsS3Module],
  controllers: [EventsAdminController, EventsPublicController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
