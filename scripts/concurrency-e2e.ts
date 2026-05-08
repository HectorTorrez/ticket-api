/**
 * Full-stack concurrency check (requires PostgreSQL + DATABASE_URL).
 * Run: pnpm exec tsx scripts/concurrency-e2e.ts
 */
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { execSync } from 'child_process';
import { AppModule } from '../src/app.module';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit', env: process.env });
  execSync('pnpm exec prisma db seed', { stdio: 'inherit', env: process.env });

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  const httpServer = app.getHttpServer();
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@ticket-api.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!ChangeMe';

  const adminLogin = await request(httpServer)
    .post('/api/v1/auth/login')
    .send({ email: adminEmail, password: adminPassword });

  if (adminLogin.status >= 400) {
    console.error('Admin login failed', adminLogin.status, adminLogin.body);
    await app.close();
    process.exit(1);
  }

  const adminToken = adminLogin.body.accessToken as string;

  const ev = await request(httpServer)
    .post('/api/v1/events')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Concurrency script event',
      startsAt: new Date(Date.now() + 864e5).toISOString(),
      endsAt: new Date(Date.now() + 2 * 864e5).toISOString(),
    });

  const eventId = ev.body.id as string;

  await request(httpServer)
    .post(`/api/v1/events/${eventId}/publish`)
    .set('Authorization', `Bearer ${adminToken}`);

  const ttRes = await request(httpServer)
    .post(`/api/v1/events/${eventId}/ticket-types`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      tier: 'VIP',
      name: 'VIP',
      price: 99,
      quantity: 1,
    });

  const ticketTypeId = ttRes.body.id as string;

  const custA = await request(httpServer)
    .post('/api/v1/auth/register')
    .send({ email: `ca_${Date.now()}@e2e.local`, password: 'password123!' });

  const custB = await request(httpServer)
    .post('/api/v1/auth/register')
    .send({ email: `cb_${Date.now()}@e2e.local`, password: 'password123!' });

  const tokenA = custA.body.accessToken as string;
  const tokenB = custB.body.accessToken as string;

  const [first, second] = await Promise.all([
    request(httpServer)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ lines: [{ ticketTypeId, quantity: 1 }] }),
    request(httpServer)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ lines: [{ ticketTypeId, quantity: 1 }] }),
  ]);

  const statuses = [first.status, second.status].sort();
  if (!statuses.includes(409) || !statuses.some((s) => s >= 200 && s < 300)) {
    console.error('Concurrency assertion failed', { statuses, first: first.body, second: second.body });
    await app.close();
    process.exit(1);
  }

  console.info('Concurrency check passed', statuses);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
