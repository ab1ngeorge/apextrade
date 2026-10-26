import Terminal from '@/components/Terminal';
export const dynamic='force-dynamic';
export default function Page(){
 const demo=process.env.NODE_ENV!=='production'&&process.env.ENABLE_DEMO_SEED==='true'&&process.env.DEMO_EMAIL&&process.env.DEMO_PASSWORD?{email:process.env.DEMO_EMAIL,password:process.env.DEMO_PASSWORD}:undefined;
 return <Terminal demo={demo}/>;
}
