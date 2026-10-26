import { beforeAll,afterAll,beforeEach,describe,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { placeOrder,portfolio,cancelOrder } from '../src/lib/trading';
import { db } from '../src/lib/db';
import { seedDemo } from '../prisma/seed';
import { compare, hash } from 'bcryptjs';
const enabled=!!process.env.TEST_DATABASE_URL;
let userId='',otherId='';
function input(side:'BUY'|'SELL'='BUY',quantity=5,type:'MARKET'|'LIMIT'|'STOP_LOSS'='MARKET'){return {symbol:'RELIANCE',side,quantity,type,idempotencyKey:randomUUID(),...(type!=='MARKET'?{triggerPrice:'280000'}:{})};}
describe.skipIf(!enabled)('PostgreSQL trading and isolation',()=>{
 beforeAll(async()=>{
  const test=process.env.TEST_DATABASE_URL!;
  if(process.env.NODE_ENV==='production'||!new URL(test).pathname.endsWith('_test'))throw new Error('Only a dedicated _test database is allowed');
  // The process must be started with DATABASE_URL pointing at the isolated database.
  if(process.env.DATABASE_URL!==test)throw new Error('Set DATABASE_URL=TEST_DATABASE_URL before running integration tests');
  await db.instrument.upsert({where:{symbol:'RELIANCE'},update:{price:285000n},create:{symbol:'RELIANCE',name:'Reliance Industries',exchange:'NSE',sector:'Energy',price:285000n,previousClose:282000n,metrics:{}}});
 });
 beforeEach(async()=>{
  const create=()=>db.user.create({data:{email:randomUUID()+'@integration.test',name:'Test',passwordHash:'not-a-login',account:{create:{ledger:{create:{kind:'INITIAL_CREDIT',delta:100000000n,balanceAfter:100000000n}}}}}});
  userId=(await create()).id;otherId=(await create()).id;
 });
 afterAll(async()=>{await db.$disconnect();});
 it('atomically buys, sells, and reconciles every execution',async()=>{
  const o=await placeOrder(userId,input());expect(o.status).toBe('FILLED');expect(o.execution?.price).toBe(285000n);expect(o.execution?.fee).toBe(1425n);
  let p=await portfolio(userId);expect(p.cash).toBe(98573575n);expect(p.equity).toBe(99998575n);expect(p.holdings[0].averageCost).toBe(285000n);expect(p.reconciled).toBe(true);
  await db.instrument.update({where:{symbol:'RELIANCE'},data:{price:300000n}});
  await placeOrder(userId,input('BUY',5));p=await portfolio(userId);expect(p.holdings[0].costBasis).toBe(2925000n);expect(p.holdings[0].averageCost).toBe(292500n);expect(p.unrealized).toBe(75000n);expect(p.reconciled).toBe(true);
  const s=await placeOrder(userId,input('SELL',2));expect(s.status).toBe('FILLED');p=await portfolio(userId);expect(p.holdings[0].quantity).toBe(8);expect(p.realizedGross).toBe(15000n);expect(p.reconciled).toBe(true);expect(p.equity).toBe(p.cash+p.marketValue);
  await db.instrument.update({where:{symbol:'RELIANCE'},data:{price:285000n}});
 });
 it('does not mutate cash for rejected and cancelled orders',async()=>{
  expect((await placeOrder(userId,input('BUY',1000000))).status).toBe('REJECTED');expect((await placeOrder(userId,input('SELL',1))).reason).toBe('INSUFFICIENT_HOLDINGS');
  const o=await placeOrder(userId,input('BUY',5,'LIMIT'));expect(o.status).toBe('PENDING');expect((await cancelOrder(userId,o.id)).status).toBe('CANCELLED');const p=await portfolio(userId);expect(p.cash).toBe(100000000n);expect(p.holdings).toHaveLength(0);expect(p.reconciled).toBe(true);
 });
 it('serializes duplicate submissions and rejects key conflicts',async()=>{
  const v=input();const [a,b]=await Promise.all([placeOrder(userId,v),placeOrder(userId,v)]);expect(a.id).toBe(b.id);expect((await portfolio(userId)).holdings[0].quantity).toBe(5);await expect(placeOrder(userId,{...v,quantity:6})).rejects.toThrow('different order details');
 });
 it('prevents concurrent overspending',async()=>{
  const result=await Promise.all([placeOrder(userId,input('BUY',300)),placeOrder(userId,input('BUY',300))]);expect(result.map(x=>x.status).sort()).toEqual(['FILLED','REJECTED']);const p=await portfolio(userId);expect(p.cash>=0n).toBe(true);expect(p.holdings[0].quantity).toBe(300);expect(p.reconciled).toBe(true);
 });
 it('isolates user account and cancellation ownership',async()=>{
  const o=await placeOrder(userId,input('BUY',5,'STOP_LOSS'));await expect(cancelOrder(otherId,o.id)).rejects.toThrow('Order not found');expect((await portfolio(otherId)).holdings).toHaveLength(0);expect((await portfolio(otherId)).cash).toBe(100000000n);
 });
 it('rejects malformed quantities on the server',async()=>{await expect(placeOrder(userId,{...input(),quantity:1.5})).rejects.toThrow();await expect(placeOrder(userId,{...input(),quantity:-1})).rejects.toThrow();});
 it('re-seeds only the demo password and preserves account history',async()=>{
  const email=`${randomUUID()}@demo.test`,oldPassword='OldPassword!2026',newPassword='NewPassword!2026';
  const account=await db.account.create({data:{user:{create:{email,name:'Existing Demo',passwordHash:await hash(oldPassword,12)}},cash:7654321n,ledger:{create:{kind:'INITIAL_CREDIT',delta:100000000n,balanceAfter:100000000n}},positions:{create:{symbol:'RELIANCE',quantity:3,costBasis:855000n}}},include:{user:true}});
  await db.order.create({data:{userId:account.user.id,symbol:'RELIANCE',side:'BUY',type:'MARKET',quantity:3,status:'FILLED',idempotencyKey:randomUUID(),fingerprint:'preserved-history'}});
  const config:NodeJS.ProcessEnv={...process.env,NODE_ENV:'test',ENABLE_DEMO_SEED:'true',DEMO_EMAIL:email,DEMO_PASSWORD:newPassword};
  const initialHistory=await db.priceHistory.count();
  await seedDemo(db,config);
  let seeded=await db.user.findUniqueOrThrow({where:{email},include:{account:{include:{ledger:true,positions:true}}}});
  expect(await compare(newPassword,seeded.passwordHash)).toBe(true);
  expect(await compare(oldPassword,seeded.passwordHash)).toBe(false);
  expect(seeded.account?.cash).toBe(7654321n);expect(seeded.account?.ledger).toHaveLength(1);expect(seeded.account?.positions[0].quantity).toBe(3);
  expect(await db.order.count({where:{userId:account.user.id}})).toBe(1);
  const firstHash=seeded.passwordHash;
  await seedDemo(db,config);
  seeded=await db.user.findUniqueOrThrow({where:{email},include:{account:{include:{ledger:true,positions:true}}}});
  expect(await compare(newPassword,seeded.passwordHash)).toBe(true);expect(seeded.passwordHash).not.toBe(firstHash);
  expect(seeded.account?.cash).toBe(7654321n);expect(seeded.account?.ledger).toHaveLength(1);expect(seeded.account?.positions[0].quantity).toBe(3);
  expect(await db.order.count({where:{userId:account.user.id}})).toBe(1);
  expect(await db.priceHistory.count()).toBe(initialHistory);
  await db.user.delete({where:{id:account.user.id}});
 });
});
// Keep type checking the independent client constructor used by test tooling.
void PrismaClient;
