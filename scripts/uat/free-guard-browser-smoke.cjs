// Deterministic browser check of the built pages. API responses are synthetic;
// native Supabase/RLS acceptance is a separate rollback-only SQL smoke script.
const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3100';
const origin=new URL(base);assert.ok(['127.0.0.1','localhost'].includes(origin.hostname),'Local fixture preview only');
const U='11111111-1111-4111-8111-111111111111',G='22222222-2222-4222-8222-222222222222',J='33333333-3333-4333-8333-333333333333';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const context=await browser.newContext({viewport,serviceWorkers:'block'});let submitted=0,deny=false;const errors=[];
      const user={id:U,email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{role:'guard'}};
      const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:U,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
      await context.addInitScript(({user,token})=>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user})),{user,token});
      await context.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.origin===origin.origin)return route.continue();
        if(url.origin!=='http://127.0.0.1:9')return route.abort();
        const headers={'access-control-allow-origin':origin.origin,'access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};
        if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
        let data=null;
        if(url.pathname==='/auth/v1/user')data=user;
        else if(url.pathname.endsWith('/functions/v1/apply-to-job')){submitted++;data={success:true,applicationId:'synthetic-application'};}
        else if(url.pathname.endsWith('/rpc/get_my_feature_usage'))data={allowed:!deny,reason:deny?'guard_inactive':'free_access',used:50,limit:null,remaining:null,plan_slug:'guard-free-access',plan_name:'Free job access'};
        else if(url.pathname.endsWith('/rpc/get_job_contract'))data={job_id:J,contract:null};
        else if(url.pathname.endsWith('/guards'))data={id:G,user_id:U,full_name:'Synthetic Guard',verification_status:'approved',verified_by:U,profile_completed:true,dashboard_access:true,is_active:true,licence_types:['Door Supervisor'],sia_licence_number:'SYNTHETIC',sia_expiry_date:'2099-01-01'};
        else if(url.pathname.endsWith('/users'))data={id:U,user_type:'guard'};
        else if(url.pathname.endsWith('/jobs'))data={id:J,job_title:'Synthetic free-access shift',venue_city:'London',start_date:'2099-01-01',hourly_rate:15,status:'open',sia_licence_required:true,required_licence_types:['Door Supervisor'],clients:{company_name:'Synthetic client'}};
        else if(!/\/admin_users$|\/clients$|\/subscriptions$|\/job_applications$/.test(url.pathname))data=[];
        return route.fulfill({status:200,headers,body:JSON.stringify(data)});
      });
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/guard/jobs/apply?id='+J);await expect(page.getByRole('heading',{name:'Apply for Job',exact:true})).toBeVisible();
      // Follow the first-visit consent flow before using controls beneath its banner.
      const essential=page.getByRole('button',{name:'Essential Only',exact:true});
      await essential.click();await expect(essential).not.toBeVisible();
      deny=true;await page.getByRole('button',{name:'Submit Application',exact:true}).click();await expect(page.getByText('Application access could not be confirmed. Please refresh or contact support.',{exact:true})).toBeVisible();assert.equal(submitted,0);assert.ok(!page.url().includes('/upgrade'));
      deny=false;await page.getByRole('button',{name:'Submit Application',exact:true}).click();await expect(page.getByText('Application submitted successfully!',{exact:true})).toBeVisible();assert.equal(submitted,1);assert.deepEqual(errors,[]);
      fs.mkdirSync('uat-results/free-guard-access',{recursive:true});await page.screenshot({path:`uat-results/free-guard-access/apply-${viewport.width}.png`,fullPage:true});
      console.log(`PASS ${viewport.width}px: retryable denial, successful free application after 50 submissions, no upgrade redirect or page errors; synthetic API only`);
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
