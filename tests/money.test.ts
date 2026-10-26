import { describe,it,expect } from 'vitest';
import { feeFor,purchase,sale } from '../src/lib/money';
import { history,instruments } from '../src/lib/market';
describe('exact minor-unit accounting',()=>{
 it('buys five RELIANCE with 0.10% fee',()=>{expect(purchase(5,285000n)).toEqual({quantity:5,costBasis:1425000n,notional:1425000n,fee:1425n,cashDelta:-1426425n});});
 it('rounds half a paise upward',()=>{expect(feeFor(499n)).toBe(0n);expect(feeFor(500n)).toBe(1n);expect(feeFor(1500n)).toBe(2n);});
 it('combines weighted acquisition costs',()=>{const p=purchase(3,30000n,2,40000n);expect(p.quantity).toBe(5);expect(p.costBasis).toBe(130000n);expect(p.costBasis/BigInt(p.quantity)).toBe(26000n);});
 it('realizes partial sale and keeps remaining basis',()=>{const s=sale(2,30000n,5,130000n);expect(s.realizedGross).toBe(8000n);expect(s.costBasis).toBe(78000n);expect(s.cashDelta).toBe(59940n);});
 it('releases all fractional basis on final sale',()=>{const s=sale(1,100n,3,100n);const last=sale(2,100n,2,s.costBasis);expect(s.removedBasis+last.removedBasis).toBe(100n);expect(last.costBasis).toBe(0n);});
 it('rejects excess sale',()=>{expect(()=>sale(6,100n,5,500n)).toThrow('INSUFFICIENT_HOLDINGS');});
 it('keeps generated OHLC and quotes consistent',()=>{for(const [, , , ,price,previous,volatility] of instruments){const h=history(price,previous,volatility);expect(h.at(-1)?.close).toBe(BigInt(price));expect(h.at(-2)?.close).toBe(BigInt(previous));for(const c of h){expect(c.low<=c.open&&c.low<=c.close).toBe(true);expect(c.high>=c.open&&c.high>=c.close).toBe(true);}expect(h).toEqual(history(price,previous,volatility));}});
});
