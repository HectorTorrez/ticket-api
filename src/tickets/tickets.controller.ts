import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly ticketsService: TicketsService) {}

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
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  @Public()
  @Get('tickets/:publicCode/qr')
  @ApiOperation({ summary: 'PNG QR code encoding the public ticket code' })
  @ApiProduces('image/png')
  @Header('Cache-Control', 'no-store')
  async qrPng(@Param('publicCode') publicCode: string, @Res() res: Response) {
    const ticket = await this.ticketsService.findPublicTicket(publicCode);
    if (!ticket) throw new NotFoundException('Ticket not found');

    const png = await QRCode.toBuffer(publicCode, { type: 'png', width: 256, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }
}
