import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'ApexTrade | Paper trading terminal',description:'Deterministic educational stock simulator. Virtual money only.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
