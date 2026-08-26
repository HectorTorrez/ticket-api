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

const ticketRow = {
  id: 't1',
  status: TicketStatus.ACTIVE,
  publicCode: 'CODE1234',
  event: { title: 'Concierto en la playa' },
  ticketType: { name: 'General', tier: 'GENERAL' },
  user: { email: 'cliente@ejemplo.com' },
};

const ticketContext = {
  publicCode: 'CODE1234',
  eventTitle: 'Concierto en la playa',
  ticketTypeName: 'General',
  tier: 'GENERAL',
  holderEmail: 'cliente@ejemplo.com',
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
          ...ticketRow,
          status: TicketStatus.USED,
        }),
        update: jest.fn(),
      },
    };
    const service = buildService(tx);

    await expect(service.validate(adminId, 'CODE1234')).resolves.toEqual({
      result: 'ALREADY_USED',
      ticket: ticketContext,
    });
    expect(tx.ticket.update).not.toHaveBeenCalled();
  });

  it('returns INVALID when ticket is CANCELLED', async () => {
    const tx: TxMock = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 't1' }]),
      ticket: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...ticketRow,
          status: TicketStatus.CANCELLED,
        }),
        update: jest.fn(),
      },
    };
    const service = buildService(tx);

    await expect(service.validate(adminId, 'CODE1234')).resolves.toEqual({
      result: 'INVALID',
      ticket: ticketContext,
    });
  });

  it('marks ACTIVE ticket as USED and returns VALID with context', async () => {
    const tx: TxMock = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 't1' }]),
      ticket: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(ticketRow),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = buildService(tx);

    await expect(service.validate(adminId, 'ABC12345')).resolves.toEqual({
      result: 'VALID',
      ticket: ticketContext,
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
