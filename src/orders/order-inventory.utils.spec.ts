import { OrderStatus } from '../generated/prisma/enums';
import {
  isPendingActiveOrder,
  restoreReservedInventory,
} from './order-inventory.utils';

describe('isPendingActiveOrder', () => {
  it('returns true for PENDING with future expiresAt', () => {
    const expiresAt = new Date(Date.now() + 60_000);
    expect(isPendingActiveOrder(OrderStatus.PENDING, expiresAt)).toBe(true);
  });

  it('returns false when expiresAt is in the past', () => {
    const expiresAt = new Date(Date.now() - 1_000);
    expect(isPendingActiveOrder(OrderStatus.PENDING, expiresAt)).toBe(false);
  });

  it('returns false for non-PENDING statuses', () => {
    const expiresAt = new Date(Date.now() + 60_000);
    expect(isPendingActiveOrder(OrderStatus.PAID, expiresAt)).toBe(false);
    expect(isPendingActiveOrder(OrderStatus.CANCELLED, expiresAt)).toBe(false);
    expect(isPendingActiveOrder(OrderStatus.EXPIRED, expiresAt)).toBe(false);
  });
});

describe('restoreReservedInventory', () => {
  it('increments quantityRemaining for each order line', async () => {
    const updates: Array<{ id: string; quantity: number }> = [];
    const tx = {
      orderLine: {
        findMany: jest.fn().mockResolvedValue([
          { ticketTypeId: 'tt-1', quantity: 2 },
          { ticketTypeId: 'tt-2', quantity: 1 },
        ]),
      },
      ticketType: {
        update: jest.fn().mockImplementation(({ where, data }) => {
          updates.push({
            id: where.id,
            quantity: data.quantityRemaining.increment,
          });
          return Promise.resolve({});
        }),
      },
    };

    await restoreReservedInventory(tx as never, 'order-1');

    expect(tx.orderLine.findMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      select: { ticketTypeId: true, quantity: true },
    });
    expect(updates).toEqual([
      { id: 'tt-1', quantity: 2 },
      { id: 'tt-2', quantity: 1 },
    ]);
  });
});
