import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { instruments, history } from '../src/lib/market';
if(existsSync('.env')) process.loadEnvFile('.env');
const db = new PrismaClient();
async function seed() {
 if(process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_SEED !== 'true') throw new Error('Demo seed is development-only and requires ENABLE_DEMO_SEED=true');
 const email=process.env.DEMO_EMAIL, password=process.env.DEMO_PASSWORD;
 if(!email || !password) throw new Error('DEMO_EMAIL and DEMO_PASSWORD required');
 for(const [symbol,name,exchange,sector,price,previous,volatility] of instruments) {
  await db.instrument.upsert({where:{symbol},create:{symbol,name,exchange,sector,price:BigInt(price),previousClose:BigInt(previous),metrics:{pe:24,marketCapCrore:250000,volatility,description:'Fictional educational snapshot; not investment research.'}},update:{}});
  await db.priceHistory.createMany({data:history(price,previous,volatility).map(h=>({...h,symbol})),skipDuplicates:true});
 }
 await db.user.upsert({where:{email},update:{},create:{email,name:'Demo Agent',passwordHash:await hash(password,12),account:{create:{cash:100000000n,ledger:{create:{kind:'INITIAL_CREDIT',delta:100000000n,balanceAfter:100000000n}}}},watchlists:{create:{name:'My watchlist'}}}});
}
seed().finally(()=>db.$disconnect());
