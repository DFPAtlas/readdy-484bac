const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--pretty','false'],{encoding:'utf8'});
const report=(result.stdout || '')+(result.stderr || '');
fs.writeFileSync('tsc-output.txt',report);
const critical=report.split('\n').filter(line=> /^(app\/admin\/|lib\/(financeAmounts|adminFunction|adminData|adminJobStatus)\.)/.test(line));
if(result.error || (result.status !== 0 && !report.includes('error TS'))) {console.error(report || result.error);process.exit(1);}
if(critical.length){console.error(critical.join('\n'));process.exit(1);}
console.log('Admin and financial frontend TypeScript checks passed. Full repository report: tsc-output.txt');
