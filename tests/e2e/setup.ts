import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { instruments,history } from '../../src/lib/market';
export default async function setup(){
 const url=process.env.TEST_DATABASE_URL;
 if(process.env.NODE_ENV==='production'||!url||!new URL(url).pathname.endsWith('_test'))throw new Error('E2E requires TEST_DATABASE_URL ending in _test. Never point tests at production.');
 const db=new PrismaClient({datasourceUrl:url});
 try {
  // Explicit isolated database guard above is mandatory before this destructive reset.
  await db.$executeRawUnsafe('TRUNCATE TABLE "User", "Instrument", "RateLimit" RESTART IDENTITY CASCADE');
  for(const [symbol,name,exchange,sector,price,previous,volatility] of instruments){
   await db.instrument.create({data:{symbol,name,exchange,sector,price:BigInt(price),previousClose:BigInt(previous),metrics:{pe:24,marketCapCrore:250000,volatility,description:'Mock test data'},history:{create:history(price,previous,volatility)}}});
  }
  if(!process.env.DEMO_PASSWORD||!process.env.DEMO_EMAIL)throw new Error('DEMO_EMAIL and DEMO_PASSWORD must be configured');
  await db.user.create({data:{email:process.env.DEMO_EMAIL,name:'Demo Agent',passwordHash:await hash(process.env.DEMO_PASSWORD,12),account:{create:{ledger:{create:{kind:'INITIAL_CREDIT',delta:100000000n,balanceAfter:100000000n}}}},watchlists:{create:{name:'My watchlist'}}}});
 }finally{await db.$disconnect();}
}
