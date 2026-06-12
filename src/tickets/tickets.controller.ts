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
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@Controller()
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
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
  listMine(@CurrentUser() user: Express.UserPayload) {
    return this.ticketsService.listMine(user.userId);
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
}
