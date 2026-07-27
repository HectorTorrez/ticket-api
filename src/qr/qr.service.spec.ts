jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { TicketStatus } from '../generated/prisma/enums';
import { QrService } from './qr.service';

type TxMock = {
  $queryRawUnsafe: jest.Mock;
  ticket: {
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
  };
};

function buildService(tx: TxMock) {
  const prisma = {
    $transaction: jest.fn(async (fn: (client: TxMock) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return new QrService(prisma as never);
}

describe('QrService.validate', () => {
  const adminId = 'admin-1';

  it('returns INVALID when ticket does not exist', async () => {
    const tx: TxMock = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      ticket: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = buildService(tx);

    await expect(service.validate(adminId, 'missing-code')).resolves.toEqual({
      result: 'INVALID',
    });
    expect(tx.ticket.update).not.toHaveBeenCalled();
  });

  it('returns ALREADY_USED when ticket is USED', async () => {
    const tx: TxMock = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 't1' }]),
      ticket: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 't1',
          status: TicketStatus.USED,
        }),
        update: jest.fn(),
      },
    };
    const service = buildService(tx);

    await expect(service.validate(adminId, 'CODE1234')).resolves.toEqual({
      result: 'ALREADY_USED',
    });
    expect(tx.ticket.update).not.toHaveBeenCalled();
  });

  it('returns INVALID when ticket is CANCELLED', async () => {
    const tx: TxMock = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 't1' }]),
      ticket: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 't1',
          status: TicketStatus.CANCELLED,
        }),
        update: jest.fn(),
      },
    };
    const service = buildService(tx);

    await expect(service.validate(adminId, 'CODE1234')).resolves.toEqual({
      result: 'INVALID',
    });
  });

  it('marks ACTIVE ticket as USED and returns VALID', async () => {
    const tx: TxMock = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 't1' }]),
      ticket: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 't1',
          status: TicketStatus.ACTIVE,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = buildService(tx);

    await expect(service.validate(adminId, 'ABC12345')).resolves.toEqual({
      result: 'VALID',
    });
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({
          status: TicketStatus.USED,
          validatedByUserId: adminId,
        }),
      }),
    );
  });

  it('extracts publicCode from /check/:code URL before lookup', async () => {
    const tx: TxMock = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      ticket: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = buildService(tx);

    await service.validate(
      adminId,
      'http://localhost:3000/check/my-public-code',
    );

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('publicCode'),
      'my-public-code',
    );
  });
});
