// Isolated sandbox only. Contact data is synthetic and removed in finally.
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const endpoint='https://alfwwggavmyerjyqumuo.supabase.co/functions/v1/guest-booking';
function request(body,{method='POST',origin='https://quickguard.uk'}={}){
 const args=['--silent','--show-error','--max-time','20','--request',method,endpoint,'--header','Content-Type: application/json','--header','Origin: '+origin,'--write-out','\n%{http_code}'];
 if(method==='POST')args.push('--data-binary','@-');const output=execFileSync('curl',args,{input:method==='POST'?JSON.stringify(body):undefined,encoding:'utf8'});const split=output.lastIndexOf('\n'),status=Number(output.slice(split+1));return{status,body:output.slice(0,split)?JSON.parse(output.slice(0,split)):null};
}
const receipt=crypto.randomBytes(32).toString('hex'),date=new Date(Date.now()+3*86400000).toISOString().slice(0,10),submissionId='qgb_'+crypto.randomBytes(16).toString('hex');let created=false;
try{
 assert.equal(request({}, {method:'OPTIONS'}).status,204);assert.equal(request({action:'availability'},{origin:'https://unapproved.example.invalid'}).status,403);
 const count=request({action:'availability',postcode:'SW1A 1AA',startDate:date,startTime:'09:00',endTime:'17:00',numberOfDays:'1',numberOfGuards:'1',bookingType:'one_off_shift',hourlyRate:'15',requiredLicenseType:'door_supervisor',venueCategory:'nightclub_bar'});assert.equal(count.status,200);assert.ok(Number.isInteger(count.body.count)&&count.body.count>=0);assert.deepEqual(Object.keys(count.body).sort(),['checkedAt','count','daysChecked','scope']);
 const contact={action:'save_enquiry',receipt,submissionId,email:'sandbox.enquiry@example.invalid',contactName:'Synthetic HTTP enquiry',postcodeArea:'SW1A',startDate:date,followupConsent:true,consentVersion:'booking-followup-2026-11-25'};
 assert.equal(request({...contact,followupConsent:false}).status,400);
 const saved=request(contact);assert.equal(saved.status,200);created=true;assert.equal(saved.body.saved,true);const retry=request(contact);assert.equal(retry.status,200);assert.equal(retry.body.expiresAt,saved.body.expiresAt);
 assert.equal(request({action:'complete_enquiry',receipt,jobId:'22222222-2222-4222-8222-222222222222'}).status,401);
 console.log(JSON.stringify({passed:true,checks:7,scope:'sandbox HTTP CORS, genuine geocoding/count, consent rejection, idempotent save and unauthenticated conversion denial',matches:count.body.count}));
}finally{const removal=request({action:'withdraw_enquiry',receipt});assert.equal(removal.status,200);assert.equal(removal.body.removed,true);console.log(JSON.stringify({syntheticEnquiryRemoved:true,hadConfirmedSave:created}));}
