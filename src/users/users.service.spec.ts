jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '../generated/prisma/enums';
import { UsersService } from './users.service';

function buildService(prisma: Record<string, unknown>) {
  return new UsersService(prisma as never);
}

describe('UsersService admin account actions', () => {
  const actorId = 'admin-1';
  const customerId = 'user-1';

  it('refuses to change your own account', async () => {
    const service = buildService({
      user: { findFirst: jest.fn() },
    });

    await expect(
      service.setStatus(actorId, actorId, UserStatus.SUSPENDED),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 when the target user does not exist', async () => {
    const service = buildService({
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.setStatus(actorId, customerId, UserStatus.BANNED),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('suspends a customer and revokes refresh tokens', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: customerId,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn().mockResolvedValue({
          id: customerId,
          email: 'cliente@ejemplo.com',
          role: UserRole.CUSTOMER,
          status: UserStatus.SUSPENDED,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          _count: { orders: 3 },
        }),
        count: jest.fn(),
      },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = buildService(prisma);

    const row = await service.setStatus(
      actorId,
      customerId,
      UserStatus.SUSPENDED,
    );

    expect(row).toMatchObject({
      id: customerId,
      status: UserStatus.SUSPENDED,
      orderCount: 3,
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: customerId },
    });
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('blocks suspending the last active admin', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'admin-2',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      refreshToken: { deleteMany: jest.fn() },
    };
    const service = buildService(prisma);

    await expect(
      service.setStatus(actorId, 'admin-2', UserStatus.SUSPENDED),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('creates an admin when the email is free', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'admin-new',
          email: 'nuevo@ejemplo.com',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          _count: { orders: 0 },
        }),
      },
    };
    const service = buildService(prisma);

    await expect(
      service.createAdmin('Nuevo@ejemplo.com', 'hash'),
    ).resolves.toMatchObject({
      id: 'admin-new',
      email: 'nuevo@ejemplo.com',
      role: UserRole.ADMIN,
      orderCount: 0,
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'nuevo@ejemplo.com',
          role: UserRole.ADMIN,
        }),
      }),
    );
  });

  it('rejects creating an admin with an email already in use', async () => {
    const service = buildService({
      user: {
        findUnique: jest.fn().mockResolvedValue({ deletedAt: null }),
        create: jest.fn(),
      },
    });

    await expect(
      service.createAdmin('admin@ejemplo.com', 'hash'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft-deletes a customer and revokes sessions', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: customerId,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const service = buildService(prisma);

    await expect(service.softDelete(actorId, customerId)).resolves.toEqual({
      deleted: true,
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: customerId },
    });
  });
});
