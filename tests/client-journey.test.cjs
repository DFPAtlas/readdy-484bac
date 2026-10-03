const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');
function load(path){const mod={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports);return mod.exports;}
const {nextJobAction,paymentLabel,planLabel,bookingLabels}=load('lib/client-journey.ts');
const {getStepErrors,validateAllSteps}=load('lib/post-job-validation.ts');
const {paymentTotals}=load('lib/financeAmounts.ts');
test('job journey sends new applicants and unpaid selections to permanent pages',()=>{
 assert.equal(nextJobAction({id:'new-job',status:'open',applications_count:1}).href,'/client/jobs/applicants?id=new-job');
 assert.equal(nextJobAction({id:'new-job',status:'awaiting_payment'}).label,'Pay to Confirm');
 assert.equal(nextJobAction({id:'new-job',status:'awaiting_client_confirmation'}).href,'/client/jobs/confirmation?id=new-job');
});
test('funded and cancelled bookings cannot offer another payment',()=>{
 for(const status of ['confirmed','cancelled']) assert.notEqual(nextJobAction({id:'j',status,payment_status:'completed'}).label,'Pay to Confirm');
 assert.notEqual(nextJobAction({id:'j',status:'awaiting_payment',payment_status:'funded'}).label,'Pay to Confirm');
 assert.equal(nextJobAction({id:'j',status:'cancelled',payment_status:'refunded'}).href,'/client/payment-centre?tab=history&job=j');
});
test('sandbox accounting includes both refunded payments and excludes failed attempts',()=>{
 assert.deepEqual(paymentTotals([{amount:92,status:'completed'},{amount:92,status:'partially_refunded',refund_amount:20},{amount:92,status:'refunded',refunded:true},{amount:92,status:'failed'}]),{collected:276,refunded:112,remaining:164});
});
test('labels match across legacy payment and plan aliases',()=>{
 for(const status of ['completed','succeeded','funded']) assert.equal(paymentLabel(status),'Paid');
 assert.equal(paymentLabel('partially_refunded'),'Partially refunded');assert.equal(planLabel('basic'),planLabel('free'));
});
const form={jobTitle:'Test job',securityType:'event-security',numberOfGuards:'1',jobDescription:'Valid description',venue:'Venue',addressLine1:'Test Street',city:'London',postcode:'SW1A 1AA',siteInstructions:'',startDate:'2026-10-13',endDate:'2026-10-13',startTime:'09:00',endTime:'13:00',numberOfDays:'1',breakInfo:'',experienceLevel:'any',siaLicenceRequired:'yes',specificLicences:['door-supervisor'],hourlyRate:'20',contactName:'Test',contactPhone:'07700900102',contactEmail:'test@example.com',publishAt:'',expiresAt:''};
test('client catches server title and description limits before posting',()=>{
 assert.equal(validateAllSteps(form).valid,true);
 for(const description of ['test','         ']) assert.ok(getStepErrors(1,{...form,jobDescription:description}).jobDescription);
 assert.ok(getStepErrors(1,{...form,jobTitle:'a'}).jobTitle);assert.ok(getStepErrors(1,{...form,jobTitle:'a'.repeat(161)}).jobTitle);
});
test('validation returns first step and all field errors without mutating entered data',()=>{
 const input={...form,jobDescription:'test',city:'',specificLicences:[],expiresAt:'2026-10-01',publishAt:'2026-10-02'};const snapshot=JSON.stringify(input);const result=validateAllSteps(input);
 assert.equal(result.firstInvalidStep,1);for(const field of ['jobDescription','city','specificLicences','expiresAt'])assert.ok(result.allErrors[field]);assert.equal(JSON.stringify(input),snapshot);
});
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
function renderModule(path, mocks={}) {const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('module','exports','require',code)(mod,mod.exports,name=>name in mocks ? mocks[name] : require(name));return mod.exports.default;}
const Link=({children,...props})=>React.createElement('a',props,children);
const Badge=renderModule('app/client/jobs/BookingStatusBadge.tsx', {'@/lib/client-journey':{bookingLabels}});
const RecentJobs=renderModule('app/client/dashboard/RecentJobs.tsx',{'next/link':{default:Link},'next/navigation':{useRouter:()=>({push(){}})},'@/lib/supabase':{supabase:{}},'../jobs/BookingStatusBadge':{default:Badge},'@/lib/client-journey':{nextJobAction,paymentLabel}});
test('dashboard renders confirmed paid booking with one relevant action and payment link',()=>{
 const html=renderToStaticMarkup(React.createElement(RecentJobs,{jobs:[{id:'fresh',job_title:'New checkout job',status:'confirmed',payment_status:'funded',applications_count:1,assigned_count:1,needs_payment:false,start_date:'2026-10-13',venue_city:'London'}]}));
 assert.match(html,/>Confirmed</);assert.match(html,/>Paid</);assert.match(html,/\/client\/jobs\/detail\?id=fresh/);assert.match(html,/\/client\/payment-centre\?tab=history&amp;job=fresh/);assert.doesNotMatch(html,/Pay Now|Review Applicants|Manage Guards/);
});
function mapHandler(apiKey, validUser=true){let handler;const env={SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'test-only',GOOGLE_MAPS_EMBED_API_KEY:apiKey};const deno={env:{get:name=>env[name]},serve:fn=>{handler=fn;}};const code=ts.transpileModule(fs.readFileSync('supabase/functions/maps-embed-config/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('Deno','require','exports',code)(deno,()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:validUser?{id:'test'}:null},error:validUser?null:new Error('invalid')})}})}),{});return handler;}
test('map configuration rejects disallowed origins and requires a valid signed-in user',async()=>{
 const handler=mapHandler('synthetic-test-key');
 assert.equal((await handler(new Request('https://test.invalid',{method:'POST',headers:{origin:'https://untrusted.invalid',authorization:'Bearer test'}}))).status,403);
 assert.equal((await handler(new Request('https://test.invalid',{method:'POST',headers:{origin:'https://quickguard.uk'}}))).status,401);
 assert.equal((await mapHandler('synthetic',false)(new Request('https://test.invalid',{method:'POST',headers:{origin:'https://quickguard.uk',authorization:'Bearer test'}}))).status,401);
 const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{origin:'https://quickguard.uk',authorization:'Bearer test'}}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await mapHandler(undefined)(new Request('https://test.invalid',{method:'POST',headers:{origin:'https://quickguard.uk',authorization:'Bearer test'}}))).status,500);
});
