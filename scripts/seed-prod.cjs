/**
 * Production seed runnable with plain Node (no tsx). Used via SSM on EC2:
 * docker exec ticket-api node /app/scripts/seed-prod.cjs
 */
const pg = require('pg');
const argon2 = require('argon2');
const { randomUUID } = require('crypto');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const useRdsTls = connectionString.includes('rds.amazonaws.com');
  const pool = new pg.Pool({
    connectionString,
    ssl: useRdsTls ? { rejectUnauthorized: false } : undefined,
  });

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@tidetickets.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'TideAdmin2026!';
  const passwordHash = await argon2.hash(password);

  const adminResult = await pool.query(
    `INSERT INTO "User" (id, email, "passwordHash", role, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'ADMIN', NOW(), NOW())
     ON CONFLICT (email) DO UPDATE
       SET "passwordHash" = EXCLUDED."passwordHash",
           role = 'ADMIN',
           "updatedAt" = NOW()
     RETURNING id`,
    [randomUUID(), email, passwordHash],
  );
  const adminId = adminResult.rows[0].id;

  const slug = 'concierto-demo-tide';
  const startsAt = new Date(Date.now() + 7 * 864e5);
  const endsAt = new Date(startsAt.getTime() + 3 * 360e5);

  const eventResult = await pool.query(
    `INSERT INTO "Event" (
       id, "organizerId", title, slug, description, "startsAt", "endsAt", venue,
       published, "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       "startsAt" = EXCLUDED."startsAt",
       "endsAt" = EXCLUDED."endsAt",
       venue = EXCLUDED.venue,
       published = true,
       "deletedAt" = NULL,
       "updatedAt" = NOW()
     RETURNING id, slug`,
    [
      randomUUID(),
      adminId,
      'Concierto Demo — Tide Tickets',
      slug,
      'Evento de demostración para probar reservas, pago simulado y entradas QR/PDF.',
      startsAt,
      endsAt,
      'Teatro Nacional, San Salvador',
    ],
  );
  const eventId = eventResult.rows[0].id;

  await pool.query(
    `INSERT INTO "TicketType" (
       id, "eventId", tier, name, price, "quantityTotal", "quantityRemaining",
       "createdAt", "updatedAt"
     ) VALUES ($1, $2, 'GENERAL', 'General', 15, 100, 100, NOW(), NOW())
     ON CONFLICT ("eventId", tier) DO UPDATE SET
       name = EXCLUDED.name,
       price = EXCLUDED.price,
       "quantityTotal" = EXCLUDED."quantityTotal",
       "quantityRemaining" = EXCLUDED."quantityRemaining",
       "updatedAt" = NOW()`,
    [randomUUID(), eventId],
  );

  await pool.query(
    `INSERT INTO "TicketType" (
       id, "eventId", tier, name, price, "quantityTotal", "quantityRemaining",
       "createdAt", "updatedAt"
     ) VALUES ($1, $2, 'VIP', 'VIP', 35, 20, 20, NOW(), NOW())
     ON CONFLICT ("eventId", tier) DO UPDATE SET
       name = EXCLUDED.name,
       price = EXCLUDED.price,
       "quantityTotal" = EXCLUDED."quantityTotal",
       "quantityRemaining" = EXCLUDED."quantityRemaining",
       "updatedAt" = NOW()`,
    [randomUUID(), eventId],
  );

  console.log(
    JSON.stringify(
      {
        admin: { email, password },
        event: {
          slug,
          url: `https://tidetickets.com/events/${slug}`,
        },
      },
      null,
      2,
    ),
  );

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
