// Built pages, synthetic APIs and no external traffic. Native SQL acceptance is separate.
const {chromium,expect}=require('@playwright/test');const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3100',origin=new URL(base);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const U='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222';
(async()=>{const browser=await chromium.launch({args:['--no-sandbox']});try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});let signedIn=false,failAvailability=true;const calls=[],unexpected=[],errors=[];
 const user={id:U,email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{role:'client'}};
 const client={id:C,user_id:U,contact_name:'Synthetic Client',email:'synthetic@example.invalid',phone:'07000000000',company_name:'Synthetic Client',subscription_tier:'Free',plan_slug:'client_free',subscription_plan:'client_free',profile_completed:true,is_active:true,is_suspended:false,onboarding_status:'completed',subscription_status:'active'};
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===origin.origin)return route.continue();if(url.origin!=='http://127.0.0.1:9')return route.abort();const headers={'content-type':'application/json','access-control-allow-origin':origin.origin,'access-control-allow-headers':'*','access-control-allow-methods':'*'};if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});let data=null,status=200;
 if(req.method()==='GET'&&url.pathname==='/functions/v1/qg-public-launch-settings')data={settings:{programme_enabled:false,exit_popup_enabled:false,exit_popup_test_icon_enabled:false}};
 else if(req.method()==='GET'&&url.pathname==='/functions/v1/public-site-media')data={publications:[]};
 else if(url.pathname==='/functions/v1/guest-booking'){
  const body=req.postDataJSON();calls.push(body);
  if(body.action==='availability'){if(failAvailability){status=503;data={error:'Synthetic availability outage. Please retry.'};}else data={count:3,checkedAt:new Date().toISOString(),scope:'requested_shifts',daysChecked:1};}
  else if(body.action==='save_enquiry')data={saved:true,expiresAt:new Date(Date.now()+30*86400000).toISOString()};
  else if(body.action==='withdraw_enquiry')data={removed:true};
  else{unexpected.push(url.pathname+':'+body.action);status=409;data={error:'Unexpected action'};}
 }
 else if(url.pathname.includes('/functions/')){unexpected.push(url.pathname);status=409;data={error:'Unexpected provider call'};}
 else if(url.pathname==='/auth/v1/user')data=signedIn?user:null;
 else if(url.pathname.endsWith('/clients'))data=signedIn?client:null;
 else if(url.pathname.endsWith('/users'))data=signedIn?{id:U,user_type:'client'}:null;
 else if(url.pathname.endsWith('/admin_users')||url.pathname.endsWith('/guards')||url.pathname.endsWith('/subscriptions'))data=null;
 else if(url.pathname.endsWith('/user_entitlements_data'))data={user_id:U,plan_slug:'client_free',is_active:true,features:['client.post_job']};
 else if(url.pathname.endsWith('/plan_fee_rules'))data={platform_fee_percent:15,platform_fee_fixed_pence:0,stripe_fee_payer:'quickguard',payout_delay_days:5,auto_release_hours:72,dispute_window_hours:24};
 else if(url.pathname.endsWith('/rpc/is_active_admin'))data=false;
 else data=[];
 return route.fulfill({status,headers,body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');const essential=page.getByRole('button',{name:'Essential Only',exact:true});await essential.click();await expect(essential).not.toBeVisible();
 await page.locator('section[aria-labelledby="hero-heading"]').getByRole('link',{name:'Book a Guard Now',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Do you have a QuickGuard account?',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Yes, sign in',exact:true}).click();await page.waitForURL('**/client/login?**');await expect(page.getByRole('alert')).toHaveCount(0);
 await page.goto(base+'/post-job?mode=immediate&source=homepage');await page.getByRole('button',{name:'No, check availability first',exact:true}).click();
 await page.getByRole('button',{name:/^Nightclub or Bar/}).click();await page.getByRole('button',{name:/Next: When/}).click();
 const values={'Venue or event name':'Synthetic Venue','Street address':'Synthetic Street','City':'London','Postcode':'SW1A 1AA','Start date':new Date(Date.now()+3*86400000).toISOString().slice(0,10),'Start time':'09:00','End time':'17:00'};
 for(const [label,value]of Object.entries(values))await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Next: Requirements',exact:false}).click();await page.getByRole('button',{name:'Door Supervisor Licence',exact:true}).click();
 for(const [label,value]of Object.entries({'Hourly rate':'15','Brief description':'Synthetic guest booking','Your name':'Synthetic Visitor','Phone number':'07000000000','Email address':'synthetic@example.invalid'}))await page.getByLabel(label,{exact:true}).fill(value);
 const check=page.getByRole('button',{name:'Check matching guards',exact:true});await check.click();await expect(page.getByText('Synthetic availability outage. Please retry.',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:/guards match/})).toHaveCount(0);
 failAvailability=false;await check.click();await expect(page.getByRole('heading',{name:'3 guards match your requirements',exact:true})).toBeVisible();assert.equal(calls.filter(c=>c.action==='save_enquiry').length,0);
 const availability=calls.find(c=>c.action==='availability');for(const name of ['contactName','contactEmail','contactPhone','addressLine1','venueName','jobDescription'])assert.equal(availability[name],undefined);
 const checkbox=page.getByRole('checkbox');await expect(checkbox).not.toBeChecked();await expect(page.getByRole('button',{name:'Save booking follow-up',exact:true})).toBeDisabled();await checkbox.check();await page.getByRole('button',{name:'Save booking follow-up',exact:true}).click();await expect(page.getByText('Booking follow-up saved. You can remove it below.',{exact:true})).toBeVisible();
 assert.equal(calls.filter(c=>c.action==='save_enquiry').length,1);assert.equal(calls.find(c=>c.action==='save_enquiry').followupConsent,true);
 await page.getByRole('button',{name:'Remove saved booking follow-up',exact:true}).click();await expect(page.getByText('Saved booking follow-up removed.',{exact:true})).toBeVisible();
 fs.mkdirSync('uat-results/guest-booking',{recursive:true});await page.screenshot({path:`uat-results/guest-booking/availability-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Continue with a client account',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Your booking details are saved',exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:'Create a free account',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await page.getByRole('button',{name:'Continue with a client account',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Create a free account',exact:true}).click();await page.waitForURL('**/client/register?**');
 const target=new URL(page.url()).searchParams.get('redirect');assert.equal(target,'/client/post-job?mode=immediate&source=homepage');await expect(page.getByRole('alert')).toHaveCount(0);
 const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('qg_pending_job_draft_v1')));assert.equal(draft.venueName,'Synthetic Venue');assert.equal(draft.contactEmail,'synthetic@example.invalid');assert.match(draft.submissionId,/^qgb_/);
 signedIn=true;const accessToken=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:U,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
 await page.evaluate(({user,accessToken})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:accessToken,refresh_token:'synthetic',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user})),{user,accessToken});
 await page.goto(base+target);await expect(page.getByText('Continuing your “Book a Guard Now” request',{exact:true})).toBeVisible();await expect(page.locator('input[name="jobTitle"]')).toHaveValue('Synthetic Venue — Nightclub or Bar');await expect(page.locator('textarea[name="jobDescription"]')).toHaveValue('Synthetic guest booking');
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('qg_pending_job_draft_v1')))).submissionId,draft.submissionId);
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);await page.screenshot({path:`uat-results/guest-booking/restored-${width}.png`,fullPage:true});console.log(`PASS guest ${width}px: hero account choice, login/signup navigation, failure/retry, private aggregate request, explicit consent/removal, secure draft restore and no job/payment/email provider calls; synthetic APIs only`);await context.close();
 }}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
