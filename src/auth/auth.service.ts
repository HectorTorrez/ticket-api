import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { parseDurationMs } from '../common/duration';
import type { AccessTokenPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(password);
    const user = await this.usersService.createCustomer(email, passwordHash);
    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = stored.user;
    if (user.deletedAt) throw new UnauthorizedException('User inactive');

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    return { loggedOut: true };
  }

  private hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async issueTokens(userId: string, email: string, role: AccessTokenPayload['role']) {
    const accessPayload: AccessTokenPayload = { sub: userId, email, role };

    const accessToken = await this.jwtService.signAsync(accessPayload);

    const rawRefresh = randomBytes(48).toString('hex');
    const refreshExpires = this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES');
    const expiresAt = new Date(Date.now() + parseDurationMs(refreshExpires));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawRefresh),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: { id: userId, email, role },
    };
  }
}
