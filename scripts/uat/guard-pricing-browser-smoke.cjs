// Built-page fixtures only. All API responses are synthetic and provider traffic
// is blocked. Native catalogue/migration acceptance is verified separately.
const {chromium,expect}=require('@playwright/test');const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3100',origin=new URL(base);assert.ok(['127.0.0.1','localhost'].includes(origin.hostname),'Local preview only');
const U='11111111-1111-4111-8111-111111111111';
const plans=[['client_free','Free Starter',0,1],['client-starter','Client Starter',4900,10],['client-pro','Client Pro',9900,30],['client-enterprise','Client Enterprise',19900,null],['guard_starter','Guard Free',0,2],['guard-elite','Guard Elite',2900,40]].map(([slug,name,amount,limit])=>({slug,name,audience:slug.startsWith('guard')?'guard':'client',monthly_price_pence:amount,job_limit_per_month:limit,features:slug==='guard-elite'?['guard.profile_boost']:['client.post_job'],description:'Synthetic catalogue fixture',active:true,stripe_price_id:amount?'price_test_month':null,stripe_annual_price_id:amount?'price_test_year':null}));
const fees=[['client_free',15],['client-starter',10],['client-pro',7.5],['client-enterprise',5]].map(([plan_slug,platform_fee_percent])=>({plan_slug,platform_fee_percent,platform_fee_fixed_pence:0}));
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});try{
 for(const width of [1440,390])for(const role of ['anonymous','guard']){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),user={id:U,email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{role:'guard'}};let feeFailure=false;const errors=[],writes=[];
  if(role==='guard'){
   const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:U,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
   await context.addInitScript(({user,token})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user})),{user,token});
  }
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin===origin.origin)return route.continue();if(url.origin!=='http://127.0.0.1:9')return route.abort();
   const headers={'access-control-allow-origin':origin.origin,'access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   let data=null,status=200;
   if(req.method()==='GET'&&url.pathname==='/functions/v1/qg-public-launch-settings')data={settings:{programme_enabled:false,exit_popup_enabled:false,exit_popup_test_icon_enabled:false}};
   else if(req.method()==='GET'&&url.pathname==='/functions/v1/public-site-media'&&!url.search)data={publications:[]};
   else if(url.pathname==='/auth/v1/user')data=role==='guard'?user:null;
   else if(url.pathname.endsWith('/plans'))data=plans;
   else if(url.pathname.endsWith('/rpc/get_public_client_pricing_fees')){data=feeFailure?{message:'Synthetic fee read failure'}:fees;status=feeFailure?500:200;}
   else if(url.pathname.endsWith('/user_entitlements_data'))data={plan_slug:'guard-elite',plan_name:'Historical Guard Elite',audience:'guard',features:['guard.profile_boost'],subscription_status:'active',is_active:true,is_free_tier:false,current_period_end:'2099-01-01'};
   else if(url.pathname.endsWith('/users'))data={user_type:'guard'};
   else if(url.pathname.endsWith('/guards'))data={id:U};
   else if(url.pathname.endsWith('/rpc/get_my_token_checkout_summary'))data={enabled:true,balance:500,pence_per_100:1000,max_percent:50,pending:null,new_subscription:true};
   else if(url.pathname.includes('/functions/')){writes.push(url.pathname);status=409;data={error:'Unexpected provider mutation in fixture'};}
   else data=[];
   return route.fulfill({status,headers,body:JSON.stringify(data)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  let consentSet=false;
  async function open(path){await page.goto(base+path);if(!consentSet){const consent=page.getByRole('button',{name:'Essential Only',exact:true});await consent.click();await expect(consent).not.toBeVisible();consentSet=true;}}
  if(role==='anonymous'){
   await open('/pricing');await expect(page.getByRole('heading',{name:'Free guard account',exact:true})).toBeVisible();
   const consent=page.getByRole('button',{name:'Essential Only',exact:true});if(await consent.isVisible())await consent.click();
   for(const [name,total]of [['Free Starter','£165.60'],['Client Starter','£158.40'],['Client Pro','£154.80'],['Client Enterprise','£151.20']])await expect(page.getByRole('row',{name:new RegExp(name)})).toContainText(total);
   await expect(page.locator('body')).not.toContainText(/\bGuard Elite\b|applications per month|Featured profile placement/);
   await expect(page.getByText('QuickGuard is not VAT registered.',{exact:false}).first()).toBeVisible();
   await expect(page.getByRole('button',{name:/^Annual\b/})).toHaveCount(0);
   await expect(page.locator('body')).not.toContainText('Billed £990.00 upfront each year');
   await open('/pricing/pdf');await expect(page.getByRole('heading',{name:'Free guard account',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save as PDF',exact:true})).toBeEnabled();
   feeFailure=true;await page.reload();await expect(page.getByRole('button',{name:'Save as PDF',exact:true})).toBeDisabled();await expect(page.getByText('Total unavailable',{exact:true}).first()).toBeVisible();
   feeFailure=false;await open('/pricing/pdf');await expect(page.getByRole('button',{name:'Save as PDF',exact:true})).toBeEnabled();
  }else{
   await open('/upgrade?reason=guard_application_limit_reached&plan=guard-elite');await expect(page.getByRole('heading',{name:'Free guard account',exact:true})).toBeVisible();
   const consent=page.getByRole('button',{name:'Essential Only',exact:true});if(await consent.isVisible())await consent.click();
   await expect(page.getByRole('link',{name:'Find Jobs',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Subscribe',exact:true})).toHaveCount(0);await expect(page.getByLabel('Tokens to redeem')).toHaveCount(0);
  }
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);fs.mkdirSync('uat-results/free-guard-access',{recursive:true});await page.screenshot({path:`uat-results/free-guard-access/pricing-${role}-${width}.png`,fullPage:true});
  console.log(`PASS pricing ${role} ${width}px: free guard storefront, expected client prices/failure recovery, no provider mutation or runtime errors; synthetic API only`);await context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
