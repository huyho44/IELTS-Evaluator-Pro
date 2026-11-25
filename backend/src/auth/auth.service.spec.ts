import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, sha256, verifyPassword } from '../common/crypto.js';
import type { PrismaService } from '../prisma.service.js';
import { AuthService, RESET_LIMIT, RESET_TTL } from './auth.service.js';
import type { MailMessage, MailerService } from './mailer.service.js';

type User = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: string;
  targetBand: null;
  targetExamDate: null;
  userRoles: { role: { code: string } }[];
};
type Session = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};
type ResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};
type Where = Record<string, unknown>;

// Minimal in-memory stand-in for the Prisma calls used by AuthService.
function fakeDb() {
  let seq = 0;
  const id = (prefix: string) =>
    `${prefix}0000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const users: User[] = [];
  const sessions: Session[] = [];
  const tokens: ResetToken[] = [];
  const audits: { action: string; actorId: string }[] = [];
  const matches = (row: Record<string, unknown>, where: Where) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        const cond = value as { not?: unknown; gt?: Date };
        if ('not' in cond) return row[key] !== cond.not;
        if (cond.gt) return (row[key] as Date) > cond.gt;
      }
      return row[key] === value;
    });
  const updateMany = <T extends Record<string, unknown>>(
    rows: T[],
    args: { where: Where; data: Partial<T> },
  ) => {
    const hits = rows.filter((row) => matches(row, args.where));
    hits.forEach((row) => Object.assign(row, args.data));
    return { count: hits.length };
  };
  const db = {
    user: {
      findUnique: async ({ where }: { where: Where }) =>
        users.find((u) => matches(u, where)) ?? null,
      update: async ({ where, data }: { where: Where; data: Partial<User> }) =>
        Object.assign(
          users.find((u) => matches(u, where))!,
          data,
        ),
      updateMany: async (args: { where: Where; data: Partial<User> }) =>
        updateMany(users, args),
    },
    authSession: {
      create: async ({ data }: { data: Omit<Session, 'id' | 'revokedAt'> }) => {
        const row = { id: id('5e55'), revokedAt: null, ...data };
        sessions.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: Where }) =>
        sessions.find((s) => matches(s, where)) ?? null,
      updateMany: async (args: { where: Where; data: Partial<Session> }) =>
        updateMany(sessions, args),
    },
    passwordResetToken: {
      count: async ({ where }: { where: Where }) =>
        tokens.filter((t) => matches(t, where)).length,
      create: async ({
        data,
      }: {
        data: Omit<ResetToken, 'id' | 'usedAt' | 'createdAt'>;
      }) => {
        const row = {
          id: id('70c3'),
          usedAt: null,
          createdAt: new Date(),
          ...data,
        };
        tokens.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: Where }) => {
        const row = tokens.find((t) => matches(t, where));
        return row
          ? { ...row, user: users.find((u) => u.id === row.userId)! }
          : null;
      },
      updateMany: async (args: { where: Where; data: Partial<ResetToken> }) =>
        updateMany(tokens, args),
    },
    auditEvent: {
      create: async ({ data }: { data: { action: string; actorId: string } }) =>
        audits.push(data),
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(db),
  };
  const addUser = (email: string, password: string, status = 'ACTIVE') => {
    const user: User = {
      id: id('a5e7'),
      email,
      displayName: 'An <Learner>',
      passwordHash: hashPassword(password),
      status,
      targetBand: null,
      targetExamDate: null,
      userRoles: [{ role: { code: 'LEARNER' } }],
    };
    users.push(user);
    return user;
  };
  return { db, users, sessions, tokens, audits, addUser };
}

function setup() {
  const data = fakeDb();
  const sent: MailMessage[] = [];
  const mailer = {
    send: vi.fn(async (message: MailMessage) => {
      sent.push(message);
      return true;
    }),
  } as unknown as MailerService;
  const service = new AuthService(data.db as unknown as PrismaService, mailer);
  const tokenFrom = (message: MailMessage) =>
    /token=([0-9a-f]{64})/.exec(message.text)![1];
  return { ...data, sent, mailer, service, tokenFrom };
}

describe('password recovery and change', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_TOKEN_SECRET', 'test-only-secret-with-at-least-32-bytes');
    vi.stubEnv('APP_BASE_URL', 'https://ielts.test/');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('answers the same way for unknown, inactive and active emails', async () => {
    const { service, addUser, sent } = setup();
    addUser('locked@test.example', 'Password123', 'LOCKED');
    addUser('an@test.example', 'Password123');
    const unknown = await service.forgotPassword({
      email: 'nobody@test.example',
    });
    const locked = await service.forgotPassword({
      email: 'locked@test.example',
    });
    const active = await service.forgotPassword({ email: 'AN@test.example' });
    expect(unknown).toEqual(active);
    expect(locked).toEqual(active);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('an@test.example');
  });

  it('emails a single-use link and stores only the token hash', async () => {
    const { service, addUser, sent, tokens, tokenFrom, audits } = setup();
    const user = addUser('an@test.example', 'Password123');
    await service.forgotPassword({ email: 'an@test.example' });
    const token = tokenFrom(sent[0]);
    expect(sent[0].text).toContain(
      `https://ielts.test/reset-password?token=${token}`,
    );
    expect(sent[0].html).toContain('An &lt;Learner&gt;');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toBe(sha256(token));
    expect(JSON.stringify(tokens)).not.toContain(token);
    expect(tokens[0].expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      RESET_TTL,
    );
    expect(audits).toContainEqual(
      expect.objectContaining({
        action: 'PASSWORD_RESET_REQUESTED',
        actorId: user.id,
      }),
    );
  });

  it('rate limits reset emails per account without changing the response', async () => {
    const { service, addUser, sent } = setup();
    addUser('an@test.example', 'Password123');
    const responses = [];
    for (let i = 0; i < RESET_LIMIT + 2; i++)
      responses.push(
        await service.forgotPassword({ email: 'an@test.example' }),
      );
    expect(sent).toHaveLength(RESET_LIMIT);
    expect(new Set(responses.map((r) => r.message)).size).toBe(1);
  });

  it('resets the password, signs out every session and rejects reuse', async () => {
    const { service, addUser, sent, sessions, tokenFrom, audits } = setup();
    const user = addUser('an@test.example', 'OldPassword1');
    await service.login({ email: 'an@test.example', password: 'OldPassword1' });
    await service.login({ email: 'an@test.example', password: 'OldPassword1' });
    await service.forgotPassword({ email: 'an@test.example' });
    await service.forgotPassword({ email: 'an@test.example' });
    const [first, second] = sent.map(tokenFrom);

    await service.resetPassword({ token: second, password: 'NewPassword1' });

    expect(verifyPassword('NewPassword1', user.passwordHash)).toBe(true);
    expect(sessions.every((s) => s.revokedAt)).toBe(true);
    expect(audits.map((a) => a.action)).toContain('PASSWORD_RESET');
    await expect(
      service.resetPassword({ token: second, password: 'Another123' }),
    ).rejects.toThrow(BadRequestException);
    // The older, unused link was invalidated by the successful reset.
    await expect(
      service.resetPassword({ token: first, password: 'Another123' }),
    ).rejects.toThrow('invalid or has expired');
    await expect(
      service.login({ email: 'an@test.example', password: 'OldPassword1' }),
    ).rejects.toThrow('Invalid email or password');
    await expect(
      service.login({ email: 'an@test.example', password: 'NewPassword1' }),
    ).resolves.toHaveProperty('accessToken');
  });

  it('rejects expired, unknown and short-password resets', async () => {
    const { service, addUser, sent, tokenFrom } = setup();
    addUser('an@test.example', 'OldPassword1');
    await service.forgotPassword({ email: 'an@test.example' });
    const token = tokenFrom(sent[0]);
    await expect(
      service.resetPassword({ token, password: 'short' }),
    ).rejects.toThrow('between 8 and 256');
    await expect(
      service.resetPassword({
        token: 'f'.repeat(64),
        password: 'NewPassword1',
      }),
    ).rejects.toThrow('invalid or has expired');
    vi.useFakeTimers({ now: Date.now() + RESET_TTL + 1000 });
    await expect(
      service.resetPassword({ token, password: 'NewPassword1' }),
    ).rejects.toThrow('invalid or has expired');
  });

  it('changes the password and keeps only the current session', async () => {
    const { service, addUser, sessions, audits } = setup();
    const user = addUser('an@test.example', 'OldPassword1');
    const other = await service.login({
      email: 'an@test.example',
      password: 'OldPassword1',
    });
    const current = await service.login({
      email: 'an@test.example',
      password: 'OldPassword1',
    });
    const header = `Bearer ${current.accessToken}`;

    await expect(
      service.changePassword(header, {
        currentPassword: 'wrong-password',
        newPassword: 'NewPassword1',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.changePassword(header, {
        currentPassword: 'OldPassword1',
        newPassword: 'OldPassword1',
      }),
    ).rejects.toThrow('must differ');

    await service.changePassword(header, {
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
    });

    expect(verifyPassword('NewPassword1', user.passwordHash)).toBe(true);
    expect(sessions.filter((s) => !s.revokedAt)).toHaveLength(1);
    await expect(service.authenticate(header)).resolves.toMatchObject({
      id: user.id,
    });
    await expect(
      service.authenticate(`Bearer ${other.accessToken}`),
    ).rejects.toThrow('Session expired');
    expect(audits.map((a) => a.action)).toContain('PASSWORD_CHANGED');
  });

  it('requires a signed-in user to change the password', async () => {
    const { service } = setup();
    await expect(
      service.changePassword(undefined, {
        currentPassword: 'x',
        newPassword: 'NewPassword1',
      }),
    ).rejects.toThrow('Bearer token required');
  });
});
