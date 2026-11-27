// Isolated browser audit. Synthetic fixtures only. Never connect to production.
const { chromium }=require("playwright");
const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webmanifest":"application/manifest+json",".svg":"image/svg+xml",".png":"image/png"};
let disconnectAdmin=false;
const server=http.createServer((req,res)=>{
 let url=new URL(req.url,"http://localhost");if(disconnectAdmin&&url.pathname==="/admin/"){req.socket.destroy();return;}let file=path.resolve(root,"."+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,"index.html");
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});fs.createReadStream(file).pipe(res);
});
const mock=String.raw`export function createClient(){
 let auth="none";const today=new Date().toISOString(),future=new Date(Date.now()+86400000).toISOString();
 const lead={id:"qa-lead",company_name:"QA Empresa",ruc:"QA-001",contact_name:"QA Contacto",email:"qa@example.invalid",phone:"",position_or_project:"QA Vacante",kind:"in_house",decision_status:"avanzar",status:"nuevo",contact_preference:"contactame",language:"es",intake_data:{work_mode:"remoto"},intake_version:2,created_at:today,meeting_at:future,meeting_mode:"virtual"};
 const inbound={id:"qa-mail",lead_id:lead.id,sender:"qa@example.invalid",recipients:["correo@christianarleo.com"],subject:"QA mensaje",body:"<img src=x onerror=alert(1)> QA texto",received_at:today,read_at:null,attachment_count:0,body_limited:false};
 const doc={id:"qa-cv",company_name:"QA Empresa",ruc:"QA-001",role_name:"QA Vacante",storage_path:"qa.pdf",original_filename:"qa.pdf",created_at:today,is_active:true,is_main:true,application_status:"preparado"};
 const tables={portfolio_cv_leads:[lead],portfolio_crm_inbound:[inbound],portfolio_cv_documents:[doc],portfolio_crm_mail:[],portfolio_cv_lead_activities:[]};
 function from(name){let rows=name==="portfolio_cv_admins"?(auth==="admin"?[{user_id:"qa-user"}]:[]):(tables[name]||[]).slice(),head=false,change=null;const q={
 select(c,o){head=!!o?.head;return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},is(k,v){rows=rows.filter(r=>r[k]===v);return q},in(k,v){rows=rows.filter(r=>v.includes(r[k]));return q},contains(k,v){rows=rows.filter(r=>v.every(x=>(r[k]||[]).includes(x)));return q},or(){return q},order(){return q},limit(n){rows=rows.slice(0,n);return q},range(a,b){rows=rows.slice(a,b+1);return q},update(v){change=v;return q},
 maybeSingle:async()=>{if(change)for(const r of rows)Object.assign(r,change);return {data:rows[0]||null,error:null}},
 then(resolve){if(change)for(const r of rows)Object.assign(r,change);return Promise.resolve({data:head?null:rows,error:null,count:rows.length}).then(resolve)}
 };return q;}
 return {from,auth:{getUser:async()=>({data:{user:auth==="none"?null:{id:"qa-user",email:"qa@example.invalid"}},error:null}),signInWithPassword:async({email})=>{auth=email.startsWith("admin")?"admin":"denied";return {error:null}},signOut:async()=>{auth="none";return {error:null}}},storage:{from:()=>({list:async()=>({data:["Christian_Arleo_Portfolio_EN.pdf","Christian_Arleo_Portafolio.pdf","Christian_Arleo_Portafolio_ES_A3.pdf","Christian_Arleo_Portfolio_EN_A3.pdf"].map(name=>({name})),error:null}),getPublicUrl:()=>({data:{publicUrl:"https://example.invalid/qa.pdf"}})})},functions:{invoke:async()=>{throw Error("QA prohibits real sending")}}};
}`;
let browser,failures=0,passes=0;
async function check(name,fn){try{await fn();passes++;console.log("PASS "+name)}catch(e){failures++;console.log("FAIL "+name+": "+String(e.message).slice(0,240))}}
(async()=>{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));const origin="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({headless:true});
 for(const [w,h] of [[320,720],[390,844],[768,1024],[1024,768],[1440,900]])for(const scheme of ["light","dark"]){
 const c=await browser.newContext({viewport:{width:w,height:h},colorScheme:scheme});const page=await c.newPage();page.setDefaultTimeout(8000);const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await c.route("**/*",async route=>{const u=route.request().url();if(u=== "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm")return route.fulfill({contentType:"text/javascript",body:mock,headers:{"Access-Control-Allow-Origin":"*"}});if(u.startsWith(origin+"/"))return route.continue();return route.abort();});
 const key=w+" "+scheme;
 try{
 await page.goto(origin+"/admin/");await page.locator("#loginPanel").waitFor({state:"visible"});
 await check(key+" anonymous restricted",async()=>assert(await page.locator("#app").isHidden()));
 if(w===390&&scheme==="light"){
 await page.locator("#email").fill("denied@example.invalid");await page.locator("#password").fill("fixture-only");await page.locator("#authForm button[type=submit]").click();await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("Acceso exclusivo"));
 await check("non-admin refused",async()=>assert(await page.locator("#app").isHidden()));
 }
 await page.locator("#email").fill("admin@example.invalid");await page.locator("#password").fill("fixture-only");await page.locator("#authForm button[type=submit]").click();
 await page.locator("#app").waitFor({state:"visible"});await page.waitForFunction(()=>document.getElementById("statPending").textContent==="0"&&document.getElementById("statUnreadMail").textContent==="1");
 await check(key+" authorized dashboard",async()=>assert.equal(await page.locator("#statPortfolios").textContent(),"4"));
 if(w===390&&scheme==="light"){
 await check("PWA manifest and icon decode",async()=>{const result=await page.evaluate(async()=>{const m=await(await fetch("/admin/manifest.webmanifest")).json();const imgs=await Promise.all([180,192,512].map(async n=>{const i=new Image();i.src="/admin/icons/cga-"+n+".png";await i.decode();return [i.naturalWidth,i.naturalHeight]}));return {scope:m.scope,display:m.display,imgs}});assert.equal(result.scope,"/admin/");assert.equal(result.display,"standalone");assert.deepEqual(result.imgs,[[180,180],[192,192],[512,512]]);});
 await check("real Chromium service worker registration",async()=>{await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:10000});assert((await page.evaluate(()=>navigator.serviceWorker.controller.scriptURL)).endsWith("/admin/sw.js"));});
 }
 for(const [tab,pane] of [["Overview","Overview"],["Leads","Leads"],["Mail","Mail"],["CV","CV"],["Portfolio","Portfolio"]]){
 await page.locator("#adminTab"+tab).click();await page.locator("#adminPane"+pane).waitFor({state:"visible"});
 await check(key+" "+pane+" viewport",async()=>{const dims=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,width:document.documentElement.scrollWidth,visible:[...document.querySelectorAll(".adminPane")].filter(x=>!x.hidden).length}));assert(dims.width<=dims.viewport+2,JSON.stringify(dims));assert.equal(dims.visible,1);});
 }
 await check(key+" four portfolio cards",async()=>assert.equal(await page.locator(".publicPortfolioCard").count(),4));
 await page.locator("#adminTabCV").click();await page.locator("#documentsFilter").fill("no-match");await check(key+" CV search",async()=>assert(await page.locator(".adminDocumentNoMatches").isVisible()));await page.locator("#documentsFilter").fill("");
 await page.locator("#newCVToggle").click();await check(key+" CV form visible",async()=>assert(await page.locator("#cvUploadForm").isVisible()));await page.locator("#cancelCVUpload").click();
 await page.locator("#adminTabMail").click();await page.locator(".mailRow").first().click();await check(key+" safe message reader",async()=>{assert((await page.locator(".mailReaderBody").textContent()).includes("<img"));assert.equal(await page.locator(".mailReaderBody img").count(),0)});
 await page.locator(".mailReplyAction").click();await page.locator("#mailComposerHost textarea").fill("QA borrador");await page.getByRole("button",{name:"Minimizar",exact:true}).click();if(w<1180)await page.locator(".mailReaderBack").click();await page.locator("#mailRefresh").click();await page.locator("#adminTabOverview").click();await page.locator("#adminTabMail").click();await page.locator("#mailResumeDraft").click();await check(key+" draft survives navigation",async()=>assert.equal(await page.locator("#mailComposerHost textarea").inputValue(),"QA borrador"));
 await page.getByRole("button",{name:"Minimizar",exact:true}).click();
 await page.locator("#adminTabLeads").click();await page.locator(".crmQueueItem").first().click();
 const crmBody=page.locator(".crmDirectMail").first().locator("xpath=..").locator("textarea").first();await crmBody.fill("QA borrador CRM");
 await page.locator("#reloadLeads").click();await page.waitForFunction(()=>[...document.querySelectorAll("#leads textarea")].some(x=>x.value==="QA borrador CRM"));
 await check(key+" CRM draft survives refresh",async()=>assert.equal(await crmBody.inputValue(),"QA borrador CRM"));
 await page.getByRole("button",{name:"Ver correos de esta solicitud"}).click();await check(key+" contextual CRM mailbox",async()=>assert(await page.locator("#mailContextBar").isVisible()));
 await check(key+" no JS runtime errors",async()=>assert.deepEqual(errors,[]));
 if(w===390&&scheme==="light"){
  await page.locator("#adminTabMail").click();await page.locator("#mailResumeDraft").click();await page.getByRole("button",{name:"Descartar",exact:true}).click();
  // Confirm discard through the existing modal; no real email.
  await page.locator("dialog[open] .cgaDialogConfirm").click();
  await page.locator("#adminLogoutHeader").click();await page.locator("dialog[open] .cgaDialogConfirm").click();await page.locator("#loginPanel").waitFor({state:"visible"});
  await check("logout hides admin",async()=>assert(await page.locator("#app").isHidden()));
  await check("logout removes private CV from DOM",async()=>assert(!await page.locator("#documents").textContent().then(t=>t.includes("QA Empresa"))));
  await check("service worker network failure fallback and empty CacheStorage",async()=>{assert(await page.evaluate(()=>!!navigator.serviceWorker.controller));disconnectAdmin=true;try{const response=await page.goto(origin+"/admin/");assert.equal(response.status(),503);assert(response.fromServiceWorker());await page.getByRole("heading",{name:"Sin conexión"}).waitFor({state:"visible"});assert.equal(await page.evaluate(async()=> (await caches.keys()).length),0);}finally{disconnectAdmin=false;}});
 }

 }catch(e){failures++;console.log("FAIL "+key+" journey: "+String(e.message).slice(0,240));}finally{await c.close();}
 }
 console.log(JSON.stringify({passes,failures,scope:"real Chromium, synthetic auth and data; no production, physical installation not tested"}));if(failures)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{await browser?.close();server.close()});
