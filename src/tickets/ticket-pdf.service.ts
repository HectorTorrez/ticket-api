import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { S3Service } from '../aws/s3.service';
import { PrismaService } from '../prisma/prisma.service';

type TicketPdfSource = {
  id: string;
  publicCode: string;
  pdfS3Key: string | null;
  event: {
    id: string;
    title: string;
    startsAt: Date;
    venue: string | null;
  };
  ticketType: {
    name: string;
    tier: string;
  };
};

@Injectable()
export class TicketPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {}

  private ticketCheckUrl(publicCode: string): string {
    const base = this.configService
      .get<string>('FRONTEND_BASE_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    return `${base}/check/${encodeURIComponent(publicCode)}`;
  }

  async resolvePdfUrl(ticket: TicketPdfSource): Promise<string> {
    if (ticket.pdfS3Key) {
      const existing = this.s3Service.buildPublicUrl(ticket.pdfS3Key);
      if (existing) return existing;
    }

    const buffer = await this.renderPdf(ticket);
    const { key, url } = await this.s3Service.putTicketPdf(
      ticket.event.id,
      ticket.publicCode,
      buffer,
    );

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { pdfS3Key: key },
    });

    if (!url) {
      throw new ServiceUnavailableException(
        'No se pudo publicar el PDF (falta S3_PUBLIC_BASE_URL)',
      );
    }

    return url;
  }

  private async renderPdf(ticket: TicketPdfSource): Promise<Buffer> {
    const checkUrl = this.ticketCheckUrl(ticket.publicCode);
    const qrPng = await QRCode.toBuffer(checkUrl, {
      type: 'png',
      width: 220,
      margin: 1,
    });

    const startsAt = new Intl.DateTimeFormat('es-SV', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(ticket.event.startsAt);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A6', margin: 28 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(14).text('Tide Tickets', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).text(ticket.event.title, { align: 'center' });
      doc.moveDown(0.75);
      doc.fontSize(9).text(`Fecha: ${startsAt}`);
      doc.text(`Lugar: ${ticket.event.venue ?? 'Por confirmar'}`);
      doc.text(
        `Entrada: ${ticket.ticketType.name} (${ticket.ticketType.tier})`,
      );
      doc.text(`Código: ${ticket.publicCode}`);
      doc.moveDown(0.75);
      const qrSize = 140;
      const qrX = (doc.page.width - qrSize) / 2;
      const qrY = doc.y;
      doc.image(qrPng, qrX, qrY, { fit: [qrSize, qrSize] });
      doc.y = qrY + qrSize + 10;
      doc.fontSize(8).fillColor('#555555').text(checkUrl, {
        align: 'center',
        link: checkUrl,
      });

      doc.end();
    });
  }
}
