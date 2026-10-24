import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import {
  hashPassword,
  newRefreshToken,
  sha256,
  verifyPassword,
} from '../common/crypto.js';
import { band, object, text, uuid } from './validation.js';

export type Actor = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  targetBand: number | null;
  targetExamDate: Date | null;
  status: string;
};
const publicSelect = {
  id: true,
  email: true,
  displayName: true,
  targetBand: true,
  targetExamDate: true,
  status: true,
  userRoles: { select: { role: { select: { code: true } } } },
} as const;
const TTL = 7 * 86400000;

@Injectable()
export class AuthService {
  // Inject required services.
  constructor(private readonly prisma: PrismaService) {}
  // Get the JWT signing secret.
  private secret() {
    const secret = process.env.AUTH_TOKEN_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32)
      throw new ServiceUnavailableException(
        'Configure AUTH_TOKEN_SECRET with at least 32 bytes',
      );
    return secret;
  }
  // Create an access token.
  private sign(userId: string, sessionId: string) {
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        sid: sessionId,
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
    ).toString('base64url');
    const data = `${header}.${payload}`;
    return `${data}.${createHmac('sha256', this.secret()).update(data).digest('base64url')}`;
  }
  // Verify and decode an access token.
  private decode(token: string): { sub: string; sid: string } {
    const secret = this.secret();
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error();
      const [header, payload, signature] = parts;
      const expected = createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest();
      const supplied = Buffer.from(signature, 'base64url');
      if (
        expected.length !== supplied.length ||
        !timingSafeEqual(expected, supplied)
      )
        throw new Error();
      const h = JSON.parse(Buffer.from(header, 'base64url').toString());
      const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (
        h.alg !== 'HS256' ||
        !Number.isInteger(p.exp) ||
        p.exp <= Date.now() / 1000
      )
        throw new Error();
      return { sub: uuid(p.sub), sid: uuid(p.sid) };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
  // Validate email and password.
  private credentials(input: unknown, registering = false) {
    const dto = object(input);
    const email = text(dto.email, 'email', 320).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException('Invalid email');
    if (
      typeof dto.password !== 'string' ||
      dto.password.length < (registering ? 8 : 1) ||
      dto.password.length > 256
    )
      throw new BadRequestException('Invalid password length');
    return { dto, email, password: dto.password };
  }
  // Register a learner account.
  async register(input: unknown) {
    const { dto, email, password } = this.credentials(input, true);
    const displayName = text(dto.displayName, 'displayName', 120);
    const targetBand =
      dto.targetBand == null ? null : band(dto.targetBand, 'targetBand');
    const role = await this.prisma.role.findUnique({
      where: { code: 'LEARNER' },
    });
    if (!role)
      throw new ServiceUnavailableException('LEARNER role is not configured');
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          displayName,
          passwordHash: hashPassword(password),
          targetBand,
          userRoles: { create: { roleId: role.id } },
        },
        select: publicSelect,
      });
      return { message: 'Register Successful', user: this.publicUser(user) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Email is already registered');
      throw error;
    }
  }
  // Log in and return tokens.
  async login(input: unknown) {
    this.secret();
    const { email, password } = this.credentials(input);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...publicSelect, passwordHash: true },
    });
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !verifyPassword(password, user.passwordHash)
    )
      throw new UnauthorizedException('Invalid email or password');
    const refreshToken = newRefreshToken();
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + TTL),
      },
    });
    return {
      message: 'Login successfully',
      accessToken: this.sign(user.id, session.id),
      refreshToken,
      expiresIn: 900,
      user: this.publicUser(user),
    };
  }
  // Rotate tokens for the current session.
  async refresh(input: unknown) {
    this.secret();
    const token = text(object(input).refreshToken, 'refreshToken', 128);
    const next = newRefreshToken();
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { refreshTokenHash: sha256(token) },
        include: { user: { select: publicSelect } },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.user.status !== 'ACTIVE'
      )
        throw new UnauthorizedException('Invalid refresh token');
      const changed = await tx.authSession.updateMany({
        where: {
          id: session.id,
          refreshTokenHash: sha256(token),
          revokedAt: null,
        },
        data: { refreshTokenHash: sha256(next) },
      });
      if (changed.count !== 1)
        throw new UnauthorizedException('Refresh token already used');
      return {
        accessToken: this.sign(session.userId, session.id),
        refreshToken: next,
        expiresIn: 900,
        user: this.publicUser(session.user),
      };
    });
  }
  // Authenticate the Bearer token.
  async authenticate(header?: string): Promise<Actor> {
    if (!header || !/^Bearer [^\s]+$/i.test(header))
      throw new UnauthorizedException('Bearer token required');
    return this.getProfileFromToken(header.slice(7));
  }
  // Get the user from a valid token.
  async getProfileFromToken(token: string): Promise<Actor> {
    const payload = this.decode(token);
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    )
      throw new UnauthorizedException('Session expired');
    return this.getProfile(payload.sub);
  }
  // Get the active user profile.
  async getProfile(userId: string): Promise<Actor> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicSelect,
    });
    if (!user || user.status !== 'ACTIVE')
      throw new UnauthorizedException('Account is not active');
    return this.publicUser(user);
  }
  // Revoke the current session.
  async logout(header?: string) {
    await this.authenticate(header);
    const payload = this.decode(header!.slice(7));
    await this.prisma.authSession.updateMany({
      where: { id: payload.sid, userId: payload.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out' };
  }
  // Return user details without the password hash.
  private publicUser(
    user: Prisma.UserGetPayload<{ select: typeof publicSelect }>,
  ): Actor {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      targetBand: user.targetBand?.toNumber() ?? null,
      targetExamDate: user.targetExamDate,
      roles: user.userRoles.map((x) => x.role.code),
    };
  }
}
