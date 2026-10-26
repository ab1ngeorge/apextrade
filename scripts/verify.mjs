import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
// Fixed command list; no user input is interpolated into the Windows shell.
const scripts=['test:core','typecheck','lint','build','db:migrate','db:seed','test:unit','test:integration','test:e2e'];
const results=[];
for(const script of scripts){
 const startedAt=new Date().toISOString();
 const command=`npm run ${script}`;
 const run=process.platform==='win32'
  ?spawnSync('cmd.exe',['/d','/s','/c',command],{encoding:'utf8',timeout:180000})
  :spawnSync('npm',['run',script],{encoding:'utf8',timeout:180000});
 const output=(run.stdout??'')+(run.stderr??'');
 results.push({command,startedAt,exitCode:run.status,error:run.error?.message,output});
 console.log(`${command}: ${run.status===0?'PASS':'FAIL/BLOCKED'} (exit ${run.status})`);
 console.log(output.trim());
}
mkdirSync('.runtime',{recursive:true});
writeFileSync('.runtime/verification.json',JSON.stringify({recordedAt:new Date().toISOString(),node:process.version,results},null,2));
// A skipped suite is not a pass. Review runner output as well as exit codes.
process.exitCode=results.every(r=>r.exitCode===0)?0:1;
