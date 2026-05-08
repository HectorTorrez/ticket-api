import type { Prisma } from '../generated/prisma/client';
import { OrderStatus } from '../generated/prisma/enums';

export async function restoreReservedInventory(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const lines = await tx.orderLine.findMany({
    where: { orderId },
    select: { ticketTypeId: true, quantity: true },
  });

  for (const line of lines) {
    await tx.ticketType.update({
      where: { id: line.ticketTypeId },
      data: { quantityRemaining: { increment: line.quantity } },
    });
  }
}

export async function loadOrderInventorySnapshotTx(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const lines = await tx.orderLine.findMany({
    where: { orderId },
    include: {
      ticketType: {
        select: { id: true, eventId: true, quantityRemaining: true, updatedAt: true },
      },
    },
  });
  return lines.map((l) => ({
    eventId: l.ticketType.eventId,
    ticketTypeId: l.ticketTypeId,
    remaining: l.ticketType.quantityRemaining,
    updatedAt: l.ticketType.updatedAt.toISOString(),
  }));
}

export function isPendingActiveOrder(status: OrderStatus, expiresAt: Date) {
  return status === OrderStatus.PENDING && expiresAt >= new Date();
}
