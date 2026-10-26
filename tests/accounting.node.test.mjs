// Dependency-free verification for constrained environments. Node >=22.6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchase,sale,feeFor } from '../src/lib/money.ts';
import { history,instruments } from '../src/lib/market.ts';
test('buy, partial sale, weighted basis and equity reconcile in exact paise',()=>{
 let cash=100000000n;const b=purchase(5,285000n);cash+=b.cashDelta;
 assert.equal(cash,98573575n);assert.equal(b.fee,1425n);assert.equal(cash+b.costBasis,99998575n);
 const b2=purchase(5,300000n,b.quantity,b.costBasis);cash+=b2.cashDelta;
 assert.equal(b2.costBasis,2925000n);assert.equal(b2.costBasis/BigInt(b2.quantity),292500n);
 const s=sale(2,300000n,b2.quantity,b2.costBasis);cash+=s.cashDelta;
 assert.equal(s.realizedGross,15000n);assert.equal(s.costBasis,2340000n);
 const fees=b.fee+b2.fee+s.fee;const unrealized=BigInt(s.quantity)*300000n-s.costBasis;
 assert.equal(cash+BigInt(s.quantity)*300000n-100000000n,s.realizedGross+unrealized-fees);
});
test('fee and remaining basis rounding conserve minor units',()=>{
 assert.equal(feeFor(499n),0n);assert.equal(feeFor(500n),1n);
 const p=sale(1,100n,3,100n),s=sale(2,100n,2,p.costBasis);assert.equal(p.removedBasis+s.removedBasis,100n);assert.equal(s.costBasis,0n);
 assert.throws(()=>sale(4,100n,3,100n),/INSUFFICIENT_HOLDINGS/);
});
test('all 12 deterministic histories close at quote and have valid OHLCV',()=>{
 assert.equal(instruments.length,12);
 for(const [,,,,price,previous,volatility]of instruments){
  const h=history(price,previous,volatility);assert.deepEqual(h,history(price,previous,volatility));assert.equal(h.at(-1).close,BigInt(price));assert.equal(h.at(-2).close,BigInt(previous));
  for(const c of h){assert.ok(c.low<=c.open&&c.low<=c.close);assert.ok(c.high>=c.open&&c.high>=c.close);assert.ok(c.volume>0);}
 }
});
