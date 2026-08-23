import { Module } from '@nestjs/common';
import { AwsS3Module } from '../aws/aws-s3.module';
import { TicketPdfService } from './ticket-pdf.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [AwsS3Module],
  providers: [TicketsService, TicketPdfService],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
