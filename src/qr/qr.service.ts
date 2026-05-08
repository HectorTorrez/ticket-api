import { Injectable } from '@nestjs/common';
import { TicketStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

export type QrValidationResult = 'VALID' | 'INVALID' | 'ALREADY_USED';

@Injectable()
export class QrService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(adminUserId: string, code: string): Promise<{ result: QrValidationResult }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Ticket" WHERE "publicCode" = $1 FOR UPDATE`,
        code,
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
}
