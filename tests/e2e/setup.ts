import { PrismaClient } from '@prisma/client';
import { seedDemo } from '../../prisma/seed';
export default async function setup(){
 const url=process.env.TEST_DATABASE_URL;
 if(process.env.NODE_ENV==='production'||!url||!new URL(url).pathname.endsWith('_test'))throw new Error('E2E requires TEST_DATABASE_URL ending in _test. Never point tests at production.');
 const db=new PrismaClient({datasourceUrl:url});
 try {
  // Explicit isolated database guard above is mandatory before this destructive reset.
  await db.$executeRawUnsafe('TRUNCATE TABLE "User", "Instrument", "RateLimit" RESTART IDENTITY CASCADE');
  if(!process.env.DEMO_PASSWORD||!process.env.DEMO_EMAIL)throw new Error('DEMO_EMAIL and DEMO_PASSWORD must be configured');
  await seedDemo(db,{...process.env,NODE_ENV:'test',ENABLE_DEMO_SEED:'true'});
 }finally{await db.$disconnect();}
}
