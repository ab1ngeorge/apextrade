'use client';
import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, ColorType, type Time } from 'lightweight-charts';
export type Candle={time:string;open:string;high:string;low:string;close:string;volume:number};
export default function Chart({history}:{history:Candle[]}) {
 const ref=useRef<HTMLDivElement>(null);const [range,setRange]=useState(90);
 useEffect(()=>{
  if(!ref.current)return;
  const chart=createChart(ref.current,{autoSize:true,height:340,layout:{background:{type:ColorType.Solid,color:'#101923'},textColor:'#99a9bb'},grid:{vertLines:{color:'#192633'},horzLines:{color:'#192633'}},rightPriceScale:{borderColor:'#293847'},timeScale:{borderColor:'#293847'},handleScroll:true,handleScale:true});
  const candles=chart.addSeries(CandlestickSeries,{upColor:'#42d9ad',downColor:'#f57b86',wickUpColor:'#42d9ad',wickDownColor:'#f57b86',borderVisible:false});
  const volume=chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume'});
  chart.priceScale('volume').applyOptions({scaleMargins:{top:.82,bottom:0}});
  const data=history.slice(-range);
  candles.setData(data.map(h=>({time:h.time.slice(0,10) as Time,open:Number(h.open)/100,high:Number(h.high)/100,low:Number(h.low)/100,close:Number(h.close)/100})));
  volume.setData(data.map(h=>({time:h.time.slice(0,10) as Time,value:h.volume,color:Number(h.close)>=Number(h.open)?'#42d9ad33':'#f57b8633'})));
  chart.timeScale().fitContent();return ()=>chart.remove();
 },[history,range]);
 return <section aria-label="Interactive simulated candlestick and volume chart"><div className="chart-toolbar"><span>OHLC · Daily candles · Volume</span><div>{[7,30,90].map(n=><button aria-pressed={range===n} key={n} onClick={()=>setRange(n)}>{n===7?'1W':n===30?'1M':'3M'}</button>)}</div></div><div ref={ref}/><p className="muted">Drag to pan · Scroll to zoom · Deterministic mock history</p></section>;
}
