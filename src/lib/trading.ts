import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from './db';
import { ApiError } from './auth';
import { purchase, sale } from './money';
export const orderSchema=z.object({symbol:z.string().min(1).max(16),side:z.enum(['BUY','SELL']),type:z.enum(['MARKET','LIMIT','STOP_LOSS']),quantity:z.number().int().positive().max(1000000),triggerPrice:z.string().regex(/^[1-9]\d{0,11}$/).optional(),idempotencyKey:z.string().uuid()}).strict().superRefine((v,c)=>{if(v.type!=='MARKET'&&!v.triggerPrice)c.addIssue({code:z.ZodIssueCode.custom,message:'A positive trigger/limit price in paise is required',path:['triggerPrice']});});
export type OrderInput=z.infer<typeof orderSchema>;
export async function placeOrder(userId:string,input:OrderInput) {
 const v=orderSchema.parse(input), fingerprint=JSON.stringify({symbol:v.symbol,side:v.side,type:v.type,quantity:v.quantity,triggerPrice:v.triggerPrice??null});
 return db.$transaction(async tx=>{
  // Serialize all trading writes on this account, including idempotency and cancellation.
  const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Account" WHERE "userId"=${userId} FOR UPDATE`;
  if(!rows.length) throw new ApiError(404,'ACCOUNT_NOT_FOUND','Account not found');
  const prior=await tx.order.findUnique({where:{userId_idempotencyKey:{userId,idempotencyKey:v.idempotencyKey}},include:{execution:true}});
  if(prior) {if(prior.fingerprint!==fingerprint)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This submission key was used with different order details');return prior;}
  const instrument=await tx.instrument.findUnique({where:{symbol:v.symbol}});
  if(!instrument)throw new ApiError(404,'INSTRUMENT_NOT_FOUND','Unknown instrument');
  const account=await tx.account.findUniqueOrThrow({where:{userId}});
  const pos=await tx.position.findUnique({where:{accountId_symbol:{accountId:account.id,symbol:v.symbol}}});
  const quantity=pos?.quantity??0, basis=pos?.costBasis??0n;
  const computed=v.side==='BUY'?purchase(v.quantity,v.type==='MARKET'?instrument.price:BigInt(v.triggerPrice!),quantity,basis):null;
  const reason=v.side==='BUY' && account.cash < (computed ? -computed.cashDelta : 0n) ? 'INSUFFICIENT_FUNDS' : v.side==='SELL' && quantity<v.quantity ? 'INSUFFICIENT_HOLDINGS' : null;
  const status=reason?'REJECTED':v.type==='MARKET'?'FILLED':'PENDING';
  const order=await tx.order.create({data:{userId,symbol:v.symbol,side:v.side,type:v.type,quantity:v.quantity,triggerPrice:v.triggerPrice?BigInt(v.triggerPrice):null,status,reason,idempotencyKey:v.idempotencyKey,fingerprint}});
  if(status==='FILLED') {
   const sold=v.side==='SELL'?sale(v.quantity,instrument.price,quantity,basis):null;
   const calc=sold??purchase(v.quantity,instrument.price,quantity,basis);
   const gross=sold?.realizedGross??0n, removed=sold?.removedBasis??0n;
   const updated=await tx.account.update({where:{id:account.id},data:{cash:{increment:calc.cashDelta}}});
   await tx.position.upsert({where:{accountId_symbol:{accountId:account.id,symbol:v.symbol}},create:{accountId:account.id,symbol:v.symbol,quantity:calc.quantity,costBasis:calc.costBasis,realizedGross:gross,fees:calc.fee},update:{quantity:calc.quantity,costBasis:calc.costBasis,realizedGross:{increment:gross},fees:{increment:calc.fee}}});
   await tx.execution.create({data:{orderId:order.id,price:instrument.price,quantity:v.quantity,notional:calc.notional,fee:calc.fee,trade:{create:{realizedGross:gross,removedBasis:removed}},ledger:{create:{accountId:account.id,kind:v.side,delta:calc.cashDelta,balanceAfter:updated.cash}}}});
  }
  await tx.notification.create({data:{userId,message:`${v.symbol} ${v.side} × ${v.quantity}: ${status}${reason?' — '+reason:''}. Order ${order.id}`}});
  return tx.order.findUniqueOrThrow({where:{id:order.id},include:{execution:true}});
 },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:15000});
}
export async function cancelOrder(userId:string,id:string) {
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Account" WHERE "userId"=${userId} FOR UPDATE`;
  const order=await tx.order.findFirst({where:{id,userId}});
  if(!order)throw new ApiError(404,'NOT_FOUND','Order not found');
  if(order.status!=='PENDING')throw new ApiError(409,'NOT_CANCELLABLE','Only pending orders may be cancelled');
  return tx.order.update({where:{id},data:{status:'CANCELLED'}});
 });
}
export async function portfolio(userId:string) {
 return db.$transaction(async tx=>{
  // Stable snapshot while a trade commits in another connection.
  const account=await tx.account.findUniqueOrThrow({where:{userId},include:{positions:{include:{instrument:true}},ledger:true}});
  const holdings=account.positions.filter(p=>p.quantity>0).map(p=>({...p,averageCost: (p.costBasis+BigInt(p.quantity)/2n)/BigInt(p.quantity),marketValue:BigInt(p.quantity)*p.instrument.price,unrealized:BigInt(p.quantity)*p.instrument.price-p.costBasis}));
  const marketValue=holdings.reduce((s,p)=>s+p.marketValue,0n), costBasis=holdings.reduce((s,p)=>s+p.costBasis,0n);
  const fees=account.positions.reduce((s,p)=>s+p.fees,0n), realizedGross=account.positions.reduce((s,p)=>s+p.realizedGross,0n);
  const ledgerCash=account.ledger.reduce((s,e)=>s+e.delta,0n);
  return {cash:account.cash,holdings,marketValue,costBasis,equity:account.cash+marketValue,unrealized:marketValue-costBasis,realizedGross,fees,netTradingPnl:realizedGross+marketValue-costBasis-fees,ledgerCash,reconciled:ledgerCash===account.cash};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
