import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '../generated/prisma/enums';
import { paginationSkipTake } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { adminUsersOrderBy } from './admin-users-order-by.util';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';

const adminUserSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { orders: true } },
} as const;

const profileSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type UserProfile = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminUserRow = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  orderCount: number;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: profileSelect,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
    return this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async findValidPasswordResetToken(tokenHash: string) {
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }

  async deletePasswordResetTokensForUser(userId: string) {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
  }

  async createCustomer(email: string, passwordHash: string) {
    return this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async createAdmin(
    email: string,
    passwordHash: string,
  ): Promise<AdminUserRow> {
    const normalized = email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { deletedAt: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.deletedAt
          ? 'Ese correo pertenece a una cuenta eliminada'
          : 'El correo electrónico ya está registrado',
      );
    }

    const created = await this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
      select: adminUserSelect,
    });
    return toAdminUserRow(created);
  }

  async updatePasswordHash(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async revokeAllRefreshTokens(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  listForAdmin(query: QueryAdminUsersDto) {
    const { skip, take } = paginationSkipTake(query.page, query.limit);
    const q = query.q?.trim();
    const where = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(q ? { email: { contains: q, mode: 'insensitive' as const } } : {}),
    };

    return Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: adminUsersOrderBy(query),
        skip,
        take,
        select: adminUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]).then(([items, total]) => ({
      items: items.map(toAdminUserRow),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }));
  }

  async setStatus(
    actorId: string,
    userId: string,
    status: UserStatus,
  ): Promise<AdminUserRow> {
    const target = await this.requireMutableTarget(actorId, userId);
    if (target.role === UserRole.ADMIN && status !== UserStatus.ACTIVE) {
      await this.assertAnotherActiveAdmin(target.id);
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { status },
      select: adminUserSelect,
    });

    if (status !== UserStatus.ACTIVE) {
      await this.revokeAllRefreshTokens(target.id);
    }

    return toAdminUserRow(updated);
  }

  async softDelete(actorId: string, userId: string) {
    const target = await this.requireMutableTarget(actorId, userId);
    if (target.role === UserRole.ADMIN) {
      await this.assertAnotherActiveAdmin(target.id);
    }

    await this.prisma.user.update({
      where: { id: target.id },
      data: { deletedAt: new Date() },
    });
    await this.revokeAllRefreshTokens(target.id);
    return { deleted: true };
  }

  private async requireMutableTarget(actorId: string, userId: string) {
    if (actorId === userId) {
      throw new ForbiddenException('No puedes modificar tu propia cuenta');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true, status: true },
    });
    if (!target) throw new NotFoundException('Usuario no encontrado');
    return target;
  }

  private async assertAnotherActiveAdmin(excludeUserId: string) {
    const remaining = await this.prisma.user.count({
      where: {
        id: { not: excludeUserId },
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
    });
    if (remaining === 0) {
      throw new ForbiddenException(
        'Debe quedar al menos un administrador activo',
      );
    }
  }
}

function toAdminUserRow(row: {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  _count: { orders: number };
}): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    orderCount: row._count.orders,
  };
}
