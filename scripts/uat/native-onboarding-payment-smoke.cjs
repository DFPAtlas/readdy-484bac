// Isolated native Auth/profile/payment probes. Credentials stay in a 0600 state
// file; only sanitized HTTP status and owned fixture IDs may reach output.
// Operator-run acceptance probes for one fresh, explicitly owned sandbox run.
// The mode-0600 state is temporary and must never be committed or printed.
// Native Auth credentials are passed to curl on stdin, never command arguments.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const base='https://alfwwggavmyerjyqumuo.supabase.co';
const statePath=process.env.QG_NATIVE_STATE;
assert.ok(statePath&&fs.existsSync(statePath),'Private QG_NATIVE_STATE file required');
assert.equal(fs.statSync(statePath).mode&0o077,0,'State must be mode 0600');
const state=JSON.parse(fs.readFileSync(statePath,'utf8'));
assert.equal(state.project,'alfwwggavmyerjyqumuo');
assert.match(state.run,/^qg-native-20261126-[a-f0-9]{16}$/);
function save(){fs.writeFileSync(statePath,JSON.stringify(state),{mode:0o600});}
function request(path,body,{token,method='POST',headers={},file}={}){
  const quote=v=>JSON.stringify(String(v));
  const config=['silent','show-error','max-time = 30','url = '+quote(base+path),'request = '+quote(method),'header = '+quote('apikey: '+state.anon),'header = '+quote('Content-Type: '+(headers['Content-Type']||'application/json')),'header = '+quote('Authorization: Bearer '+(token||state.anon)),...Object.entries(headers).filter(([k])=>k!=='Content-Type').map(([k,v])=>'header = '+quote(k+': '+v)),'write-out = "\\n%{http_code}"'];
  if(file)config.push('data-binary = '+quote('@'+file));else if(body!==undefined)config.push('data = '+quote(JSON.stringify(body)));
  const raw=execFileSync('curl',['--config','-'],{input:config.join('\n'),encoding:'utf8',stdio:['pipe','pipe','pipe']});const split=raw.lastIndexOf('\n');const text=raw.slice(0,split);let data;try{data=JSON.parse(text);}catch{data={};}return{status:Number(raw.slice(split+1)),data};
}
const fn=(name,body,token)=>request('/functions/v1/'+name,body,{token});
const phase=process.argv[2];
if(phase==='register'){
  assert.ok(!state.registered,'Fresh run required');
  for(const role of ['client','guard']){
    const r=fn('register-magic-link',{email:state[role].email,role,first_name:'Synthetic',last_name:role==='client'?'Journey Client':'Journey Guard'});assert.equal(r.status,200,role+' signup status '+r.status);assert.equal(r.data.verification_sent,true);console.log(JSON.stringify({role,signup:r.status,verificationSent:true}));
  }
  state.registered=true;save();
}else if(phase==='activate'){
  for(const role of ['client','guard']){
    const fixture=state[role];assert.ok(fixture.tokenHash&&!fixture.accessToken,'Fresh delivered verification hash required');
    const r=request('/auth/v1/verify',{token_hash:fixture.tokenHash,type:'email'});assert.equal(r.status,200,role+' native verification status');assert.ok(r.data.user.email_confirmed_at);assert.equal(r.data.user.app_metadata.account_type,role);fixture.id=r.data.user.id;fixture.accessToken=r.data.access_token;fixture.refreshToken=r.data.refresh_token;delete fixture.tokenHash;save();console.log(JSON.stringify({role,verified:true,userId:fixture.id}));
  }
}else if(phase==='client-profile'){
  const token=state.client.accessToken;assert.ok(token);
  const denied=fn('complete-client-profile',{first_name:'Synthetic',is_active:true},token);assert.equal(denied.status,400);
  const input={first_name:'Synthetic',last_name:'Journey Client',phone:'07700900123',company_name:'Synthetic Sandbox Journey Ltd',industry:'Events & Entertainment',address_line1:'1 Synthetic Test Road',city:'Test Town',postcode:'AL1 1AA',preferred_contact_method:'Email',security_needs:['Event Security']};
  const r=fn('complete-client-profile',input,token);assert.equal(r.status,200,JSON.stringify({phase,status:r.status,error:r.data.error}));assert.equal(r.data.success,true);save();console.log(JSON.stringify({role:'client',profileCompleted:true,protectedFieldDenied:true}));
}else if(phase==='guard-profile'){
  const fixture=state.guard,token=fixture.accessToken;assert.ok(token);
  const get=()=>request('/rest/v1/guards?select=id,updated_at,profile_completed&user_id=eq.'+fixture.id,undefined,{token,method:'GET',headers:{'Accept-Profile':'app'}});
  const initial=get();assert.equal(initial.status,200);assert.equal(initial.data.length,1);fixture.profileId=initial.data[0].id;
  const incomplete=fn('complete-guard-profile',{updatedAt:initial.data[0].updated_at},token);assert.equal(incomplete.status,400);
  const uploads=[['sia-licences','sia_licence_front_url','front-'],['sia-licences','sia_licence_back_url','back-'],['guard-documents','driving_licence_front_url','front-'],['guard-documents','driving_licence_back_url','back-'],['guard-documents','proof_of_address_url','poa-']];
  const updates={full_name:'Synthetic Journey Guard',phone:'07700900124',sia_licence_number:'1000000000000001',sia_expiry_date:'2030-12-31',license_cardholder_name:'Synthetic Journey Guard',years_experience:3,hourly_rate:15,available_hours_from:'09:00',available_hours_to:'17:00',available_days:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],certifications:['Door Supervision'],bio:'Clearly synthetic sandbox fixture. Not a real licensed guard.'};
  fixture.documents=[];
  for(const [bucket,field,prefix] of uploads){const path=fixture.id+'/'+prefix+state.run+'.png';const r=request('/storage/v1/object/'+bucket+'/'+path,undefined,{token,headers:{'Content-Type':'image/png','x-upsert':'false'},file:'/tmp/qg-synthetic-document.png'});assert.ok([200,201].includes(r.status),'Synthetic upload failed: '+r.status);updates[field]=path;fixture.documents.push({bucket,path});save();}
  const saved=request('/rest/v1/guards?user_id=eq.'+fixture.id,updates,{token,method:'PATCH',headers:{'Content-Profile':'app',Prefer:'return=representation'}});assert.equal(saved.status,200,'Owned guard update status');assert.equal(saved.data.length,1);
  const stale=fn('complete-guard-profile',{updatedAt:initial.data[0].updated_at},token);assert.equal(stale.status,409);
  const r=fn('complete-guard-profile',{updatedAt:saved.data[0].updated_at},token);assert.equal(r.status,200,JSON.stringify({phase,status:r.status,error:r.data.error}));assert.equal(r.data.success,true);save();
  for(const {bucket,path} of fixture.documents){const own=request('/storage/v1/object/sign/'+bucket+'/'+path,{expiresIn:60},{token});assert.equal(own.status,200);const other=request('/storage/v1/object/sign/'+bucket+'/'+path,{expiresIn:60},{token:state.client.accessToken});assert.ok([400,403,404].includes(other.status),'Another account must not sign a private document');}
  console.log(JSON.stringify({role:'guard',profileCompleted:true,incompleteProfileDenied:true,staleSubmissionDenied:true,syntheticUploads:5,crossAccountDocumentsDenied:true}));
}else if(phase==='prepare-browser'){
  const crypto=require('node:crypto');for(const role of ['client','guard']){const fixture=state[role];assert.ok(fixture.accessToken&&!fixture.password);const password=crypto.randomBytes(24).toString('base64url')+'aA1!';const r=request('/auth/v1/user',{password},{token:fixture.accessToken,method:'PUT'});assert.equal(r.status,200);fixture.password=password;save();console.log(JSON.stringify({role,browserFixturePrepared:true}));}
}else if(phase==='create-job'){
  const fixture=state.client,token=fixture.accessToken;assert.ok(token&&!state.jobId);
  const profile=request('/rest/v1/clients?select=id&user_id=eq.'+fixture.id,undefined,{token,method:'GET',headers:{'Accept-Profile':'app'}});assert.equal(profile.status,200);assert.equal(profile.data.length,1);fixture.profileId=profile.data[0].id;state.submissionId=require('node:crypto').randomUUID();save();
  const formData={jobTitle:'QG E2E Sandbox '+state.run,jobDescription:'Synthetic isolated payment lifecycle test. No real security work.',securityType:'Event Security',venue:'Synthetic Sandbox Venue',addressLine1:'1 Synthetic Test Road',city:'Test Town',postcode:'AL1 1AA',numberOfGuards:'1',numberOfDays:'1',hourlyRate:'15',startDate:'2026-11-27',endDate:'2026-11-27',startTime:'09:00',endTime:'17:00',contactName:'Synthetic Journey Client',contactEmail:fixture.email,contactPhone:'07700900123',siaLicenceRequired:'yes',specificLicences:['Door Supervision'],uniformRequired:'no',urgency:'standard',repeatShift:'none'};
  const body={formData,clientId:fixture.profileId,submissionId:state.submissionId};const r=fn('create-job',body,token);assert.equal(r.status,200,JSON.stringify({phase,status:r.status,error:r.data.error,message:r.data.message}));assert.ok(r.data.jobId);state.jobId=r.data.jobId;save();const retry=fn('create-job',body,token);assert.equal(retry.status,200);assert.equal(retry.data.jobId,state.jobId);assert.equal(retry.data.idempotent,true);console.log(JSON.stringify({createdJob:state.jobId,replayReturnedSameJob:true,warnings:r.data.warnings}));
}else if(phase==='inactive-application'){
  assert.ok(state.jobId&&!state.applicationId);const r=fn('apply-to-job',{guardId:state.guard.profileId,jobId:state.jobId},state.guard.accessToken);assert.equal(r.status,403);assert.equal(r.data.code,'guard_inactive');console.log(JSON.stringify({inactiveGuardApplicationDenied:true}));
}else if(phase==='apply-select-checkout'){
  assert.ok(state.jobId&&!state.checkout);const guard=state.guard,client=state.client;
  const application=fn('apply-to-job',{guardId:guard.profileId,jobId:state.jobId,coverMessage:'Synthetic native payment fixture application'},guard.accessToken);assert.equal(application.status,200,JSON.stringify({phase,status:application.status,error:application.data.error}));assert.ok(application.data.applicationId);state.applicationId=application.data.applicationId;save();
  const selection=request('/rest/v1/rpc/select_job_guards',{p_job_id:state.jobId,p_selections:[{guard_id:guard.profileId,agreed_hourly_rate:1,agreed_hours:1,gross_guard_amount:1}]},{token:client.accessToken,headers:{'Content-Profile':'app'}});assert.equal(selection.status,200,JSON.stringify({phase,status:selection.status,error:selection.data.message}));assert.equal(selection.data.success,true);
  const first=fn('create-job-payment',{jobId:state.jobId,taxDisclaimerAccepted:true},client.accessToken);assert.equal(first.status,200,JSON.stringify({phase,status:first.status,error:first.data.error}));assert.match(first.data.sessionId,/^cs_test_/);assert.equal(first.data.breakdown.guardFees,120);assert.equal(first.data.breakdown.guardPayoutAmount,120);assert.equal(first.data.breakdown.guardServiceFee,0);assert.equal(first.data.breakdown.clientTotalCharge,138);
  const url=new URL(first.data.url);assert.equal(url.origin,'https://checkout.stripe.com');state.checkout={sessionId:first.data.sessionId,url:first.data.url,breakdown:first.data.breakdown};save();const retry=fn('create-job-payment',{jobId:state.jobId,taxDisclaimerAccepted:true},client.accessToken);assert.equal(retry.status,200);assert.equal(retry.data.sessionId,state.checkout.sessionId);console.log(JSON.stringify({jobId:state.jobId,applicationId:state.applicationId,sessionId:state.checkout.sessionId,guardPay:120,clientCharge:138,retryReturnsSameCheckout:true,browserSuppliedPayIgnored:true}));
}else if(phase==='connect-account'){
  assert.ok(!state.connect);const r=fn('create-guard-connect-account',{},state.guard.accessToken);assert.equal(r.status,200,JSON.stringify({phase,status:r.status,error:r.data.error}));assert.match(r.data.stripeAccountId,/^acct_/);assert.equal(new URL(r.data.url).hostname,'connect.stripe.com');state.connect={accountId:r.data.stripeAccountId,url:r.data.url};save();console.log(JSON.stringify({sandboxConnectAccount:r.data.stripeAccountId,hostedLinkCreated:true}));
}else if(phase==='completion-gates'){
  const rows=request('/rest/v1/job_assignments?select=id&job_id=eq.'+state.jobId,undefined,{token:state.guard.accessToken,method:'GET',headers:{'Accept-Profile':'app'}});assert.equal(rows.status,200);assert.equal(rows.data.length,1);state.assignmentId=rows.data[0].id;save();
  const early=fn('request-job-completion',{jobId:state.jobId,assignmentId:state.assignmentId},state.guard.accessToken);assert.equal(early.status,400);assert.match(early.data.error,/check in/);
  for(const role of ['client','guard']){const denied=fn('create-guard-payout',{jobId:state.jobId,assignmentId:state.assignmentId,internalApprovalSource:'client_completion_approved',approvedByUserId:state.client.id},state[role].accessToken);assert.equal(denied.status,403);}
  const repeated=fn('create-job-payment',{jobId:state.jobId,taxDisclaimerAccepted:true},state.client.accessToken);assert.equal(repeated.status,400);assert.equal(repeated.data.error,'This job is not ready for payment');console.log(JSON.stringify({completionBeforeAttendanceDenied:true,forgedInternalPayoutDenied:true,paidBookingCannotBeChargedAgain:true}));
}else if(phase==='refresh'){
  for(const role of ['client','guard']){const fixture=state[role];assert.ok(fixture.password);const r=request('/auth/v1/token?grant_type=password',{email:fixture.email,password:fixture.password});assert.equal(r.status,200);assert.equal(r.data.user.id,fixture.id);fixture.accessToken=r.data.access_token;fixture.refreshToken=r.data.refresh_token;save();console.log(JSON.stringify({role,sessionRefreshed:true}));}
}else if(phase==='logout'){
  for(const role of ['client','guard'])if(state[role].accessToken){const r=request('/auth/v1/logout?scope=global',undefined,{token:state[role].accessToken});assert.equal(r.status,204);delete state[role].accessToken;delete state[role].refreshToken;save();console.log(JSON.stringify({role,signedOut:true}));}
}else throw Error('Unsupported native probe phase');
