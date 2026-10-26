import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { instruments, history } from '../src/lib/market';

if (existsSync('.env')) process.loadEnvFile('.env');

export type SeedClient = Pick<PrismaClient, 'instrument' | 'priceHistory' | 'user'>;

export async function seedDemo(client: SeedClient, env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' || env.ENABLE_DEMO_SEED !== 'true') {
    throw new Error('Demo seed is development-only and requires ENABLE_DEMO_SEED=true');
  }
  const email = env.DEMO_EMAIL?.trim().toLowerCase();
  const password = env.DEMO_PASSWORD;
  if (!email || !password) throw new Error('DEMO_EMAIL and DEMO_PASSWORD required');

  for (const [symbol, name, exchange, sector, price, previous, volatility] of instruments) {
    await client.instrument.upsert({
      where: { symbol },
      create: {
        symbol, name, exchange, sector, price: BigInt(price), previousClose: BigInt(previous),
        metrics: { pe: 24, marketCapCrore: 250000, volatility, description: 'Fictional educational snapshot; not investment research.' },
      },
      update: {},
    });
    await client.priceHistory.createMany({
      data: history(price, previous, volatility).map((point) => ({ ...point, symbol })),
      skipDuplicates: true,
    });
  }

  const passwordHash = await hash(password, 12);
  await client.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email, name: 'Demo Agent', passwordHash,
      account: { create: { cash: 100000000n, ledger: { create: { kind: 'INITIAL_CREDIT', delta: 100000000n, balanceAfter: 100000000n } } } },
      watchlists: { create: { name: 'My watchlist' } },
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = new PrismaClient();
  seedDemo(db).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Demo seed failed');
    process.exitCode = 1;
  }).finally(() => db.$disconnect());
}
