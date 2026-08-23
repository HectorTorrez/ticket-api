import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
import { UserRole } from '../generated/prisma/enums';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { QueryMyTicketsDto } from './dto/query-my-tickets.dto';
import { TicketPdfService } from './ticket-pdf.service';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@Controller()
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketPdfService: TicketPdfService,
    private readonly configService: ConfigService,
  ) {}

  private ticketCheckUrl(publicCode: string, origin?: string): string {
    const configured = this.configService
      .get<string>('FRONTEND_BASE_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    const base = origin?.replace(/\/$/, '') || configured;
    return `${base}/check/${encodeURIComponent(publicCode)}`;
  }

  @ApiBearerAuth()
  @Roles(UserRole.CUSTOMER)
  @UseGuards(RolesGuard)
  @Get('me/tickets')
  @ApiOperation({ summary: 'List tickets for current customer' })
  listMine(
    @CurrentUser() user: Express.UserPayload,
    @Query() query: QueryMyTicketsDto,
  ) {
    return this.ticketsService.listMine(user.userId, query);
  }

  @Public()
  @Get('tickets/:publicCode')
  @ApiOperation({ summary: 'Limited ticket payload by public code (wallet)' })
  async getOne(@Param('publicCode') publicCode: string) {
    const ticket = await this.ticketsService.findPublicTicket(publicCode);
    if (!ticket) throw new NotFoundException('Entrada no encontrada');
    return ticket;
  }

  @Public()
  @Get('tickets/:publicCode/qr')
  @ApiOperation({ summary: 'PNG QR code encoding the ticket check-in URL' })
  @ApiProduces('image/png')
  @Header('Cache-Control', 'no-store')
  async qrPng(
    @Param('publicCode') publicCode: string,
    @Query('origin') origin: string | undefined,
    @Res() res: Response,
  ) {
    const ticket = await this.ticketsService.findPublicTicket(publicCode);
    if (!ticket) throw new NotFoundException('Entrada no encontrada');

    const png = await QRCode.toBuffer(this.ticketCheckUrl(publicCode, origin), {
      type: 'png',
      width: 256,
      margin: 1,
    });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }

  @Public()
  @Get('tickets/:publicCode/pdf')
  @ApiOperation({
    summary: 'Ticket PDF stored in S3 (generates on first request)',
  })
  @ApiProduces('application/pdf')
  @Header('Cache-Control', 'private, max-age=3600')
  async ticketPdf(
    @Param('publicCode') publicCode: string,
    @Res() res: Response,
  ) {
    const ticket = await this.ticketsService.findTicketForPdf(publicCode);
    if (!ticket) throw new NotFoundException('Entrada no encontrada');

    const pdfUrl = await this.ticketPdfService.resolvePdfUrl(ticket);
    res.redirect(302, pdfUrl);
  }
}
