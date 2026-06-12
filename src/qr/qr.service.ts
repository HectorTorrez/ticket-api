import { Injectable } from '@nestjs/common';
import { TicketStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

export type QrValidationResult = 'VALID' | 'INVALID' | 'ALREADY_USED';

@Injectable()
export class QrService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    adminUserId: string,
    code: string,
  ): Promise<{ result: QrValidationResult }> {
    const publicCode = this.normalizeTicketCode(code);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Ticket" WHERE "publicCode" = $1 FOR UPDATE`,
        publicCode,
      );
      const ticketId = rows[0]?.id;
      if (!ticketId) {
        return { result: 'INVALID' };
      }

      const ticket = await tx.ticket.findUniqueOrThrow({
        where: { id: ticketId },
      });

      if (ticket.status === TicketStatus.USED) {
        return { result: 'ALREADY_USED' };
      }

      if (ticket.status === TicketStatus.CANCELLED) {
        return { result: 'INVALID' };
      }

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.USED,
          usedAt: new Date(),
          validatedByUserId: adminUserId,
        },
      });

      return { result: 'VALID' };
    });
  }

  /** Accepts raw publicCode or a /check/:code URL from QR scans. */
  private normalizeTicketCode(code: string): string {
    const trimmed = code.trim();
    try {
      const url = new URL(trimmed);
      const match = url.pathname.match(/\/check\/([^/]+)\/?$/);
      if (match?.[1]) return decodeURIComponent(match[1]);
    } catch {
      // Not a URL — use as-is.
    }
    return trimmed;
  }
}
