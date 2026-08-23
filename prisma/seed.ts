import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as argon2 from 'argon2';
import { TicketTier, UserRole } from '../src/generated/prisma/enums.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const useRdsTls = connectionString.includes('rds.amazonaws.com');
const pool = new pg.Pool({
  connectionString,
  ssl: useRdsTls ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@tidetickets.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'TideAdmin2026!';

  const passwordHash = await argon2.hash(password);

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
    },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const demoSlug = 'concierto-demo-tide';
  const startsAt = new Date(Date.now() + 7 * 864e5);
  const endsAt = new Date(startsAt.getTime() + 3 * 360e5);

  const event = await prisma.event.upsert({
    where: { slug: demoSlug },
    create: {
      organizerId: admin.id,
      title: 'Concierto Demo — Tide Tickets',
      slug: demoSlug,
      description:
        'Evento de demostración para probar reservas, pago simulado y entradas QR/PDF.',
      startsAt,
      endsAt,
      venue: 'Teatro Nacional, San Salvador',
      published: true,
    },
    update: {
      title: 'Concierto Demo — Tide Tickets',
      description:
        'Evento de demostración para probar reservas, pago simulado y entradas QR/PDF.',
      startsAt,
      endsAt,
      venue: 'Teatro Nacional, San Salvador',
      published: true,
      deletedAt: null,
    },
  });

  await prisma.ticketType.upsert({
    where: {
      eventId_tier: { eventId: event.id, tier: TicketTier.GENERAL },
    },
    create: {
      eventId: event.id,
      tier: TicketTier.GENERAL,
      name: 'General',
      price: 15,
      quantityTotal: 100,
      quantityRemaining: 100,
    },
    update: {
      name: 'General',
      price: 15,
      quantityTotal: 100,
      quantityRemaining: 100,
    },
  });

  await prisma.ticketType.upsert({
    where: {
      eventId_tier: { eventId: event.id, tier: TicketTier.VIP },
    },
    create: {
      eventId: event.id,
      tier: TicketTier.VIP,
      name: 'VIP',
      price: 35,
      quantityTotal: 20,
      quantityRemaining: 20,
    },
    update: {
      name: 'VIP',
      price: 35,
      quantityTotal: 20,
      quantityRemaining: 20,
    },
  });

  console.info(
    JSON.stringify(
      {
        admin: { email, password },
        event: {
          slug: event.slug,
          url: `https://tidetickets.com/events/${event.slug}`,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
