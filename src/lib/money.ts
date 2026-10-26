export function feeFor(notional: bigint) { return (notional + 500n) / 1000n; }
export function purchase(qty: number, price: bigint, oldQty = 0, oldBasis = 0n) {
  const notional = BigInt(qty) * price;
  return { notional, fee: feeFor(notional), quantity: qty + oldQty, costBasis: oldBasis + notional, cashDelta: -notional - feeFor(notional) };
}
export function sale(qty: number, price: bigint, oldQty: number, oldBasis: bigint) {
  if(qty > oldQty || qty <= 0) throw new Error('INSUFFICIENT_HOLDINGS');
  const notional = BigInt(qty) * price;
  const removedBasis = qty === oldQty ? oldBasis : (oldBasis * BigInt(qty) + BigInt(oldQty) / 2n) / BigInt(oldQty);
  return {notional, fee:feeFor(notional), quantity:oldQty-qty, costBasis:oldBasis-removedBasis, removedBasis, realizedGross:notional-removedBasis, cashDelta:notional-feeFor(notional)};
}
export const money = (paise: number | string | bigint) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(paise)/100);
