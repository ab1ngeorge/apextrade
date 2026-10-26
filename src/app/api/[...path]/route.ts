import { NextRequest, NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, currentUser, createSession, logout, rateLimit } from '@/lib/auth';
import { orderSchema, placeOrder, cancelOrder, portfolio } from '@/lib/trading';
import { SIM_TIME } from '@/lib/market';
import { isAllowedRequestOrigin } from '@/lib/origin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>new NextResponse(JSON.stringify({data},(_,v)=>typeof v==='bigint'?v.toString():v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const authSchema=z.object({email:z.string().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(12).max(128),name:z.string().trim().min(1).max(80).optional()});
async function route(req:NextRequest,ctx:{params:Promise<{path:string[]}>}) {
 try {
  const path=(await ctx.params).path, method=req.method, p=path.join('/'), q=req.nextUrl.searchParams;
  if(method!=='GET') {
   if(!isAllowedRequestOrigin(req.headers.get('origin'),process.env))throw new ApiError(403,'ORIGIN_REJECTED','Request origin is not allowed');
   if(Number(req.headers.get('content-length')??0)>20000)throw new ApiError(413,'BODY_TOO_LARGE','Request body too large');
  }
  if(p==='auth/login'||p==='auth/register') {
   if(method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED','Use POST');
   const body=authSchema.parse(await req.json());
   // Database-backed limits work across application replicas; key by attempted account.
   await rateLimit('login:'+body.email);
   if(p==='auth/register') {
    const user=await db.user.create({data:{email:body.email,name:body.name??'Trader',passwordHash:await hash(body.password,12),account:{create:{ledger:{create:{kind:'INITIAL_CREDIT',delta:100000000n,balanceAfter:100000000n}}}},watchlists:{create:{name:'My watchlist'}}}});
    await createSession(user.id);return json({id:user.id,email:user.email,name:user.name},201);
   }
   const user=await db.user.findUnique({where:{email:body.email}});
   const valid=await compare(body.password,user?.passwordHash??'$2b$12$wufA1P.OoDfxCPH98L32BunhqPIvIBb9C2F/7t0xUeT5hbsT.UzXu');
   if(!user||!valid)throw new ApiError(401,'INVALID_CREDENTIALS','Invalid email or password');
   await createSession(user.id);return json({id:user.id,email:user.email,name:user.name});
  }
  const user=await currentUser();
  if(method!=='GET')await rateLimit('write:'+user.id,120);
  if(p==='auth/logout'&&method==='POST'){await logout();return json({loggedOut:true});}
  if(p==='profile') {
   if(method==='PATCH'){const v=z.object({name:z.string().trim().min(1).max(80)}).parse(await req.json());await db.user.update({where:{id:user.id},data:v});return json(v);}
   if(method==='GET')return json({id:user.id,email:user.email,name:user.name});
  }
  if(p==='instruments'&&method==='GET') {
   const search=(q.get('search')??'').slice(0,100), exchange=q.get('exchange')||undefined,sector=q.get('sector')||undefined;
   const list=await db.instrument.findMany({where:{AND:[{OR:[{symbol:{contains:search,mode:'insensitive'}},{name:{contains:search,mode:'insensitive'}}]},{exchange,sector}]}});
   const sort=q.get('sort'), dir=q.get('dir')==='desc'?-1:1;
   list.sort((a,b)=>dir*(sort==='price'?Number(a.price-b.price):sort==='change'?(Number(a.price-a.previousClose)/Number(a.previousClose)-Number(b.price-b.previousClose)/Number(b.previousClose)):a.symbol.localeCompare(b.symbol)));
   const page=Math.max(1,Math.min(1000,Number(q.get('page'))||1));return json({items:list.slice((page-1)*8,page*8),total:list.length,page,simulationTime:SIM_TIME});
  }
  if(path[0]==='instruments'&&method==='GET') {
   const instrument=await db.instrument.findUnique({where:{symbol:path[1]}});if(!instrument)throw new ApiError(404,'NOT_FOUND','Instrument not found');
   const history=await db.priceHistory.findMany({where:{symbol:path[1]},orderBy:{time:'asc'}});
   if(path[2]==='history')return json(history);return json({...instrument,history,simulationTime:SIM_TIME});
  }
  if(['account','holdings','portfolio'].includes(p)&&method==='GET')return json(await portfolio(user.id));
  if(p==='lab'&&method==='GET') {
   const [p,w,o]=await Promise.all([portfolio(user.id),db.watchlistItem.count({where:{symbol:'RELIANCE',watchlist:{userId:user.id}}}),db.order.findMany({where:{userId:user.id},include:{execution:true}})]);
   const buys=o.filter(x=>x.side==='BUY'&&x.status==='FILLED'&&x.execution),sales=o.filter(x=>x.side==='SELL'&&x.status==='FILLED'&&x.execution);
   return json({'0':true,'4':w>0,'6':buys.some(x=>x.quantity===5),'7':buys.length>0,'8':p.reconciled&&buys.length>0,'9':p.reconciled&&p.holdings.length>0,'10':p.reconciled,'11':o.some(x=>x.reason==='INSUFFICIENT_FUNDS'),'12':o.some(x=>x.reason==='INSUFFICIENT_HOLDINGS'),'13':o.some(x=>x.type==='LIMIT'),'14':o.some(x=>x.status==='CANCELLED'),'15':sales.length>0});
  }
  if(p==='orders'&&method==='POST') {const order=await placeOrder(user.id,orderSchema.parse(await req.json()));return json(order,order.status==='REJECTED'?422:201);}
  if(path[0]==='orders'&&path[2]==='cancel'&&method==='POST')return json(await cancelOrder(user.id,path[1]));
  if(['orders','trades','ledger'].includes(p)&&method==='GET') {
   const from=q.get('from'),to=q.get('to');
   const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v)));
   const createdAt=(from||to)?{...(from?{gte:new Date(dateSchema.parse(from)+'T00:00:00Z')}:{}),...(to?{lte:new Date(dateSchema.parse(to)+'T23:59:59.999Z')}:{})}:undefined;
   if(p==='ledger') {const account=await db.account.findUniqueOrThrow({where:{userId:user.id}});return json(await db.cashLedger.findMany({where:{accountId:account.id,createdAt},orderBy:{createdAt:'desc'}}));}
   const status=p==='trades'?'FILLED':q.get('status')||undefined;
   const orders=await db.order.findMany({where:{userId:user.id,status,symbol:q.get('symbol')?{contains:q.get('symbol')!.toUpperCase()}:undefined,createdAt},include:{execution:{include:{trade:true}}},orderBy:{createdAt:'desc'}});
   if(q.get('format')==='csv') {
    const rows=[['Order ID','Symbol','Side','Type','Status','Quantity','Execution price (paise)','Fee (paise)','Created at'],...orders.map(o=>[o.id,o.symbol,o.side,o.type,o.status,o.quantity,o.execution?.price??'',o.execution?.fee??'',o.createdAt.toISOString()])];
    return new NextResponse(rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="apextrade-trades.csv"','Cache-Control':'no-store'}});
   }return json(orders);
  }
  if(path[0]==='watchlists') {
   if(p==='watchlists') {
    if(method==='GET')return json(await db.watchlist.findMany({where:{userId:user.id},include:{items:{include:{instrument:true}}}}));
    if(method==='POST'){const v=z.object({name:z.string().trim().min(1).max(50)}).parse(await req.json());return json(await db.watchlist.create({data:{userId:user.id,...v}}),201);}
   }
   const wl=await db.watchlist.findFirst({where:{id:path[1],userId:user.id}});if(!wl)throw new ApiError(404,'NOT_FOUND','Watchlist not found');
   if(path.length===2&&method==='PATCH'){const v=z.object({name:z.string().trim().min(1).max(50)}).parse(await req.json());return json(await db.watchlist.update({where:{id:wl.id},data:v}));}
   if(path.length===2&&method==='DELETE'){await db.watchlist.delete({where:{id:wl.id}});return json({deleted:true});}
   if(path[2]==='items'&&method==='POST'){const v=z.object({symbol:z.string().min(1).max(16)}).parse(await req.json());return json(await db.watchlistItem.upsert({where:{watchlistId_symbol:{watchlistId:wl.id,symbol:v.symbol}},create:{watchlistId:wl.id,symbol:v.symbol},update:{}}));}
   if(path[2]==='items'&&path[3]&&method==='DELETE'){await db.watchlistItem.deleteMany({where:{watchlistId:wl.id,symbol:path[3]}});return json({deleted:true});}
  }
  if(p==='notifications'&&method==='GET')return json(await db.notification.findMany({where:{userId:user.id},orderBy:{createdAt:'desc'},take:100}));
  if(path[0]==='notifications'&&method==='PATCH'){await db.notification.updateMany({where:{id:path[1],userId:user.id},data:{read:true}});return json({read:true});}
  if(p==='alerts'&&method==='GET')return json(await db.priceAlert.findMany({where:{userId:user.id}}));
  if(p==='alerts'&&method==='POST'){const v=z.object({symbol:z.string().max(16),target:z.string().regex(/^[1-9]\d{0,11}$/),direction:z.enum(['ABOVE','BELOW'])}).parse(await req.json());return json(await db.priceAlert.create({data:{userId:user.id,...v,target:BigInt(v.target)}}),201);}
  if(path[0]==='alerts'&&method==='DELETE'){await db.priceAlert.deleteMany({where:{id:path[1],userId:user.id}});return json({deleted:true});}
  throw new ApiError(404,'NOT_FOUND','Endpoint not found');
 } catch(e) {
  let status=500,code='INTERNAL_ERROR',message='Server error. No success has been confirmed; check order history before retrying.';
  if(e instanceof ApiError){status=e.status;code=e.code;message=e.message;}
  else if(e instanceof z.ZodError){status=400;code='VALIDATION_ERROR';message=e.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ');}
  else if(e instanceof SyntaxError){status=400;code='INVALID_JSON';message='Invalid JSON body';}
  else if(e&&typeof e==='object'&&'code' in e&&e.code==='P2002'){status=409;code='CONFLICT';message='Record already exists';}
  else if(e&&typeof e==='object'&&'code' in e&&e.code==='P2003'){status=400;code='INVALID_REFERENCE';message='Unknown instrument or related record';}
  else console.error(e);
  return NextResponse.json({error:{code,message}},{status,headers:{'Cache-Control':'no-store'}});
 }
}
export {route as GET, route as POST,route as PATCH,route as DELETE};
