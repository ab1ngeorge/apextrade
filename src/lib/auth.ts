import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'node:crypto';
import { db } from './db';
export class ApiError extends Error { constructor(public status:number, public code:string, message:string){super(message);} }
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function currentUser() {
 const token=(await cookies()).get('apex_session')?.value;
 if(!token) throw new ApiError(401,'UNAUTHENTICATED','Please log in.');
 const session=await db.session.findUnique({where:{id:digest(token)},include:{user:true}});
 if(!session || session.expiresAt < new Date()) throw new ApiError(401,'UNAUTHENTICATED','Your session has expired. Please log in.');
 return session.user;
}
export async function createSession(userId:string) {
 const token=randomBytes(32).toString('hex');
 await db.session.create({data:{id:digest(token),userId,expiresAt:new Date(Date.now()+7*86400000)}});
 (await cookies()).set('apex_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});
}
export async function logout() {
 const jar=await cookies(), token=jar.get('apex_session')?.value;
 if(token) await db.session.deleteMany({where:{id:digest(token)}});
 jar.delete('apex_session');
}
export async function rateLimit(key:string, limit=15) {
 const now=new Date();
 const row=await db.rateLimit.upsert({where:{key},create:{key,count:1,resetAt:new Date(Date.now()+60000)},update:{count:{increment:1}}});
 if(row.resetAt<now) {await db.rateLimit.update({where:{key},data:{count:1,resetAt:new Date(Date.now()+60000)}});return;}
 if(row.count>limit) throw new ApiError(429,'RATE_LIMIT','Too many requests. Try again in a minute.');
}
