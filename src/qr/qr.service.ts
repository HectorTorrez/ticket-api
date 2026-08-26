import { Injectable } from '@nestjs/common';
import { TicketStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { QrTicketContext, QrValidateResponse } from './qr-validate.types';

type TicketForValidate = {
  id: string;
  status: TicketStatus;
  publicCode: string;
  event: { title: string };
  ticketType: { name: string; tier: string };
  user: { email: string };
};

@Injectable()
export class QrService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    adminUserId: string,
    code: string,
  ): Promise<QrValidateResponse> {
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
        include: {
          event: { select: { title: true } },
          ticketType: { select: { name: true, tier: true } },
          user: { select: { email: true } },
        },
      });

      const context = this.toTicketContext(ticket);

      if (ticket.status === TicketStatus.USED) {
        return { result: 'ALREADY_USED', ticket: context };
      }

      if (ticket.status === TicketStatus.CANCELLED) {
        return { result: 'INVALID', ticket: context };
      }

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.USED,
          usedAt: new Date(),
          validatedByUserId: adminUserId,
        },
      });

      return { result: 'VALID', ticket: context };
    });
  }

  private toTicketContext(ticket: TicketForValidate): QrTicketContext {
    return {
      publicCode: ticket.publicCode,
      eventTitle: ticket.event.title,
      ticketTypeName: ticket.ticketType.name,
      tier: ticket.ticketType.tier,
      holderEmail: ticket.user.email,
    };
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
