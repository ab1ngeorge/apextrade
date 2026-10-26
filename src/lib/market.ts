export const SIM_TIME = new Date('2026-10-23T10:00:00Z');
export const instruments = [
 ['RELIANCE','Reliance Industries','NSE','Energy',285000,282000,1.1],
 ['TCS','Tata Consultancy Services','NSE','Technology',412000,410500,0.55],
 ['INFY','Infosys','NSE','Technology',186000,184000,0.9],
 ['HDFCBANK','HDFC Bank','NSE','Financials',172000,171000,0.7],
 ['ICICIBANK','ICICI Bank','NSE','Financials',125000,124000,0.85],
 ['SBIN','State Bank of India','NSE','Financials',82000,83000,1.3],
 ['ITC','ITC Limited','NSE','Consumer',48500,48300,0.5],
 ['LT','Larsen & Toubro','NSE','Industrials',360000,358000,1.0],
 ['AAPL','Apple','NASDAQ','Technology',1960000,1950000,1.1],
 ['MSFT','Microsoft','NASDAQ','Technology',3570000,3550000,0.9],
 ['NVDA','NVIDIA','NASDAQ','Technology',1120000,1100000,2.2],
 ['AMZN','Amazon','NASDAQ','Consumer',1590000,1600000,1.4],
] as const;
export function history(price:number, previous:number, volatility:number) {
 return Array.from({length:90},(_,i)=> {
  const time = new Date(SIM_TIME); time.setUTCDate(time.getUTCDate()-89+i);time.setUTCHours(0,0,0,0);
  const close = i===89 ? price : i===88 ? previous : Math.round(previous*(0.97+0.03*i/88+Math.sin(i*.67)*volatility/150));
  const open = i===89 ? previous : Math.round(close*(1+Math.cos(i)*volatility/400));
  return {time,open:BigInt(open),high:BigInt(Math.max(open,close)+Math.round(price*volatility/250)),low:BigInt(Math.min(open,close)-Math.round(price*volatility/250)),close:BigInt(close),volume:1000000+(i*7919)%900000};
 });
}
