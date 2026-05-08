import { Injectable } from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

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

  async createCustomer(email: string, passwordHash: string) {
    return this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: UserRole.CUSTOMER,
      },
    });
  }
}
