const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { jsPDF } = require('jspdf');
const { load } = require('./helpers/enterprise-module.cjs');
const csv = load('lib/bulk-job-csv.ts');
const pdf = load('lib/report-pdf.ts');
const priority = load('lib/priority-support.ts');
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree,...nodes(tree.props?.children)] : [];

test('CSV template round-trips and quoted multiline text is preserved without executing spreadsheet content', () => {
  const rows=csv.importBulkJobCsv(csv.bulkJobCsvTemplate());assert.equal(rows.length,1);assert.equal(rows[0].numberOfGuards,'2');
  const source=csv.bulkJobCsvTemplate().replace('Example shift','"Shift, with ""quotes"""').replace('Replace this example before posting','"Line one\r\nLine two, notes"');
  const parsed=csv.importBulkJobCsv('\uFEFF'+source);assert.equal(parsed[0].jobTitle,'Shift, with "quotes"');assert.equal(parsed[0].jobDescription,'Line one\r\nLine two, notes');
  assert.equal(csv.importBulkJobCsv(source.replace('"Shift, with ""quotes"""','=1+2'))[0].jobTitle,'=1+2');
  assert.deepEqual(csv.parseCsvRows('a,b\r\n"",value\r\n\r\n'),[['a','b'],['','value']]);
});
test('CSV invalid headers, malformed data, large imports and unsafe field shapes fail before grid mutation', () => {
  const source=csv.bulkJobCsvTemplate();
  for(const invalid of [source.replace('jobTitle,securityType','jobTitle,jobTitle'),source.replace('jobTitle','unknown'),source.replace('2027-01-01','2027-02-30'),source.replace('18:00','25:00'),source.replace(',2,20,',',101,20,'),source.replace(',2,20,',',2,9.99,'),source.replace('event-security','unsupported'),source.replace('Example shift','"unclosed'),source.replace('Example shift','"closed"junk'),source.replace('Example shift','\0')]) assert.throws(()=>csv.importBulkJobCsv(invalid));
  assert.throws(()=>csv.importBulkJobCsv('x'.repeat(1024*1024+1)),/1MB/);
  const [header,row]=source.trim().split('\r\n');assert.throws(()=>csv.importBulkJobCsv(header+'\n'+Array(101).fill(row).join('\n')),/100 jobs/);
});
test('CSV import component only sends reviewed parsed rows to its parent, never a posting request', async () => {
  let imported,slot=0;const state=[];const effect=[];
  const hooks={...React,useState(initial){const i=slot++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=v;}]},useRef(value){const i=slot++;if(!(i in state))state[i]={current:value};return state[i]},useEffect(fn){effect.push(fn)}};
  const Component=load('app/client/bulk-posting/BulkCsvImport.tsx',{react:hooks}).default;
  const tree=Component({disabled:false,onImport:rows=>{imported=rows;}});effect.forEach(fn=>fn());
  const input=nodes(tree).find(node=>node.props?.['aria-label']==='Import jobs CSV');
  const bytes=new TextEncoder().encode(csv.bulkJobCsvTemplate());await input.props.onChange({target:{files:[{size:bytes.length,arrayBuffer:async()=>bytes.buffer}],value:'example.csv'}});
  assert.equal(imported.length,1);assert.equal(imported[0].securityType,'event-security');assert.ok(state.some(value=>typeof value==='string'&&value.includes('Nothing has been posted')));
});
test('real PDF rendering paginates long cells, preserves selected values and emits a valid downloadable PDF', async () => {
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:false});
  pdf.renderReportPdf(doc,{title:'Owned records',columns:['Job','Amount','Status'],rows:Array.from({length:120},(_,i)=>['QA-'+i,i===0?'£88.00':'£20.00',i===0?'Paid Out':'Complete']),summary:['Filtered completed jobs']});
  assert.ok(doc.getNumberOfPages()>1);const raw=doc.output();assert.ok(raw.startsWith('%PDF-'));assert.ok(raw.includes('QA-119'));assert.ok(raw.includes('Paid Out'));assert.ok(raw.includes('Page 1 of'));
  const long=new jsPDF({orientation:'landscape'});pdf.renderReportPdf(long,{title:'Long text',columns:['Terms','Other'],rows:[['Long '.repeat(10000),'Retained value']]});assert.ok(long.getNumberOfPages()>1);assert.ok(long.output().includes('Retained value'));
  assert.throws(()=>pdf.renderReportPdf(doc,{title:'Invalid',columns:['one'],rows:[['a','b']]}),/columns/);
  const blob=await pdf.createReportPdf({title:'Download',columns:['Item'],rows:[['Confirmed']]});assert.equal(blob.type,'application/pdf');assert.ok(blob.size>1000);
});
test('PDF control uses an immutable click-time report and prevents duplicate concurrent downloads', async () => {
  let saved,resolve,pending=0;const calls=[];const hooks={...React,useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:fn=>fn()};
  const Component=load('app/client/reports/ReportPdfButton.tsx',{react:hooks,'@/lib/report-pdf':{createReportPdf:report=>{calls.push(report);return new Promise(r=>{resolve=r;});}}},{URL:{createObjectURL:blob=>{saved=blob;return'blob:pdf';},revokeObjectURL(){}},document:{createElement:()=>({click(){pending++;}})},setTimeout(){}}).default;
  const messages=[];const button=Component({report:()=>({title:'Selected',columns:['Status'],rows:[['Paid Out']]}),filename:'owned-report',disabled:false,onToast:m=>messages.push(m)});
  const first=button.props.onClick();await button.props.onClick();assert.equal(calls.length,1);resolve(new Blob(['%PDF-1.3'],{type:'application/pdf'}));await first;assert.equal(pending,1);assert.equal(saved.type,'application/pdf');assert.match(messages[0],/1 records exported/);
});
test('report PDF factories use current filters, human-readable lifecycle values and recorded amounts', () => {
  const Component=load('app/client/reports/JobHistoryReport.tsx',{react:{...React,useState:initial=>[initial==='all'?'completed':initial,()=>{}],useMemo:fn=>fn()},'next/link':{default:props=>React.createElement('a',props),__esModule:true}}).default;
  const tree=Component({jobs:[{id:'paid',status:'paid_out',job_title:'Owned paid job',hourly_rate:20,start_time:'18:00',end_time:'22:00',job_assignments:[{}]},{id:'cancel',status:'cancelled',job_title:'Cancelled'}],reportRange:{from:'',to:''},onToast(){}});
  const button=nodes(tree).find(node=>typeof node.props?.report==='function');const report=button.props.report();assert.equal(report.rows.length,1);assert.equal(report.rows[0][2],'Paid Out');assert.ok(report.rows[0].includes('£80.00'));assert.ok(!JSON.stringify(report).includes('Cancelled'));
});
test('human support hours follow UK time, weekends and DST; priority routing preserves urgent safety first', () => {
  for(const [date,open] of [['2026-11-23T07:59:00Z',false],['2026-11-23T08:00:00Z',true],['2026-11-23T16:59:00Z',true],['2026-11-23T17:00:00Z',false],['2026-11-21T12:00:00Z',false],['2026-07-06T07:00:00Z',true],['2026-07-06T16:00:00Z',false]]) assert.equal(priority.humanSupportAvailable(new Date(date)),open,date);
  const ticket=(id,urgency,tier,date)=>({id,priority:urgency,support_tier:tier,created_at:date});
  const rows=[ticket('standard','normal','standard','2026-01-01'),ticket('priority-new','normal','priority','2026-01-03'),ticket('priority-old','normal','priority','2026-01-02'),ticket('safety','urgent','standard','2026-01-04')];
  assert.deepEqual(priority.sortSupportQueue(rows).map(r=>r.id),['safety','priority-old','priority-new','standard']);assert.equal(rows[0].id,'standard');
});
test('support availability renders agreed staffing hours without promising a response deadline', () => {
  const Component=load('components/SupportAvailability.tsx').default;const html=renderToStaticMarkup(React.createElement(Component));assert.match(html,/08:00–17:00/);assert.match(html,/24\/7/);assert.match(html,/response time is not guaranteed/);
});

test('public contact schema and shared hours match the confirmed weekday-only human coverage', () => {
  const guidance=load('lib/customer-guidance.ts');assert.equal(priority.HUMAN_SUPPORT_HOURS,guidance.HUMAN_SUPPORT_HOURS);
  const Component=load('app/contact/ContactSchema.tsx',{'@/lib/seo-helpers':{SITE_URL:'https://quickguard.uk'}}).default;
  const schemas=nodes(Component()).filter(node=>node.type==='script').map(node=>JSON.parse(node.props.dangerouslySetInnerHTML.__html));
  const business=schemas.find(schema=>schema.openingHoursSpecification);assert.deepEqual(business.openingHoursSpecification,[{'@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday'],opens:'08:00',closes:'17:00'}]);
  const ai=business.contactPoint.find(point=>point.contactType==='AI platform assistance');assert.equal(ai.hoursAvailable.dayOfWeek.length,7);
});

test('central support payload carries the trusted service tier while preserving urgent severity', () => {
  const fs=require('node:fs'),ts=require('typescript');const source=fs.readFileSync('supabase/functions/dfp-support-ticket-bridge/index.ts','utf8');
  const block=source.slice(source.indexOf('  const originalCategory ='),source.indexOf('  if (client.phone)'))+'\nreturn payload;';
  const make=new Function('ticket','client','ticketId','CATEGORY_MAP','PRIORITY_MAP',ts.transpileModule(block,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText);
  const payload=(priority,tier)=>make({category:'technical_issue',priority,support_tier:tier},{id:'owned',company_name:'QA',email:'qa@example.test'},'ticket',{}, {normal:'normal',urgent:'urgent'});
  assert.equal(payload('normal','standard').ticket.priority,'normal');assert.equal(payload('normal','priority').ticket.priority,'high');assert.equal(payload('urgent','priority').ticket.priority,'urgent');assert.equal(payload('normal','priority').context.quickguard_support_tier,'priority');
});
