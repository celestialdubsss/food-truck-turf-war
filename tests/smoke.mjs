// Plays a full online game with 3 real browser pages (host + 2 guests) over PeerJS, logging errors and screenshots.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const OUT='smoke-results';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const log=[];const L=(...a)=>{const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');console.log(s);log.push(s);};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(process.cwd(),p);
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':'application/octet-stream'});r.end(d);});}).listen(8080);
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-features=WebRtcHideLocalIpsWithMdns','--autoplay-policy=no-user-gesture-required']});
const errs={};
async function open(name,url){const ctx=await browser.newContext({viewport:{width:640,height:360}});const p=await ctx.newPage();errs[name]=[];
  p.on('pageerror',e=>{errs[name].push('pageerror: '+e.message);L(name,'PAGEERROR',e.message,(e.stack||'').split('\n').slice(0,3).join(' | '));});
  p.on('console',m=>{if(m.type()==='error'){errs[name].push(m.text());if(errs[name].length<30)L(name,'console.error',m.text().slice(0,300));}});
  await p.goto(url);await p.waitForFunction(()=>typeof L!=='undefined'&&L.stage==='name',null,{timeout:60000});
  // keep the simulation quick: draw only every 12th frame
  await p.evaluate(()=>{const r=renderer.render.bind(renderer);let n=0;renderer.render=(...a)=>{if(window.__draw||++n%12===0)r(...a);};});
  return p;}
const shot=async(p,n)=>{try{await p.evaluate(()=>window.__draw=1);await p.waitForTimeout(150);await p.screenshot({path:`${OUT}/${n}.png`});await p.evaluate(()=>window.__draw=0);}catch(e){L('shot fail',n,e.message);}};
const st=p=>p.evaluate(()=>JSON.stringify({ph:G.phase,stage:L.stage,leg:G.leg,eph:E.phase,team:G.team,seat:NET.seat,mode:NET.mode,code:NET.code,err:(document.getElementById('errBox')||{}).textContent||''}));
try{
  const H=await open('host','http://localhost:8080/index.html');
  await shot(H,'01-name');
  await H.fill('#playerName','Hosty');await H.click('#nameGo');await H.waitForTimeout(400);await shot(H,'02-mode');
  await H.click('#nHost');await H.waitForFunction(()=>NET.code,null,{timeout:30000});const code=await H.evaluate(()=>NET.code);L('room code',code);await shot(H,'03-pick-host');
  const G1=await open('guest1',`http://localhost:8080/index.html?room=${code}`);await G1.fill('#playerName','Gina');await G1.click('#nameGo');
  await G1.waitForFunction(()=>NET.mode==='client',null,{timeout:30000});
  const G2=await open('guest2',`http://localhost:8080/index.html?room=${code}`);await G2.fill('#playerName','Gus');await G2.click('#nameGo');
  await G2.waitForFunction(()=>NET.mode==='client',null,{timeout:30000});L('joined');
  await H.waitForTimeout(1000);
  await H.evaluate(()=>pickTruck(0));await H.waitForTimeout(800);await G1.evaluate(()=>pickTruck(0));await G1.waitForTimeout(800);await G2.evaluate(()=>pickTruck(2));await H.waitForTimeout(1500);
  for(const p of [H,G1,G2])L('picked',await st(p));
  await shot(G1,'04-team-guest1');
  for(const p of [H,G1])await p.evaluate(()=>{choose('style',2);choose('color','#E5483B');choose('accent','#F2B705');choose('mascot',7);});
  await G2.evaluate(()=>{choose('style',1);choose('color','#2F7FD8');choose('accent','#FFFFFF');choose('mascot',3);});
  await H.waitForTimeout(2500);
  await H.evaluate(()=>{document.getElementById('teamName2').value='Bus Stoppers';submitTeamName();});await H.waitForTimeout(1500);
  await G1.evaluate(()=>{const n=L.names;if(n&&n.pt){document.getElementById('th-pt-me').click();}});
  await G2.evaluate(()=>{document.getElementById('teamName2').value='Solo Squad';submitTeamName();});
  await H.waitForTimeout(3000);await shot(H,'05-team-host');
  for(const p of [H,G1,G2])L('agreed',await p.evaluate(()=>JSON.stringify(AG_FIELDS.map(([f])=>agreed(f)))));
  for(const p of [H,G1,G2])await p.evaluate(()=>{updateLockBtn();if(document.getElementById('lockBtn').dataset.ok!=='1')document.getElementById('lockBtn').dataset.ok='1';lockTeam();});
  await H.waitForTimeout(1200);await shot(G1,'06-custom-guest1');
  for(const p of [H,G1,G2])await p.evaluate(()=>document.getElementById('custNext').click());
  await H.waitForTimeout(4000);await shot(H,'07-wait');
  for(const p of [H,G1,G2])await p.evaluate(()=>document.getElementById('readyBtn').click());
  await H.waitForFunction(()=>G.phase==='countdown'||G.phase==='drive',null,{timeout:30000});L('race started');
  // autopilot for every page: drive, shop, plan, cook
  for(const p of [H,G1,G2])await p.evaluate(()=>{setInterval(()=>{try{
    const t=G.player;
    if(G.phase==='drive'&&t&&t.ctl==='local'&&!t.parked){if(!t.ai.path.length)aiPlan(t);aiDrive(t,.05);if(t.parked){if(G.leg==='store')startSwoop();else{const f=netEventSlotFor(t);claimSlot(f,t);onPlayerParkedAtEvent();}}}
    if(G.phase==='store'&&!S.done){S.__k=(S.__k||0)+1;if(S.__k%10===0){const s=S.slots.filter(x=>x.count>0&&x.price<=S.budget)[0];if(s&&S.mine.length<6){S.aim=s;grab();}else if(S.mine.length>=6)checkout();}}
    if(G.phase==='event'&&E.phase==='dishes'&&!E.openSent&&!window.__op){window.__op=setTimeout(()=>tryOpen(false),6000);}
    if(G.phase==='event'&&E.phase==='service'&&E.inKitchen&&!E.over){KT.__k=(KT.__k||0)+1;if(KT.__k%4)return;const h=KT.held;
      if(h&&h.type==='dish'){KT.aim={win:true};kInteract();return;}
      if(h&&h.type==='ticket'){const fg=freeGrill();if(fg){KT.aim={grill:fg.k};kInteract();}return;}
      if(h&&h.type==='ing'){const k=KT.grills.findIndex(g=>g.order&&!g.done&&g.cooking<=0&&orderNeeds(g.order).has(h.id));KT.aim=k>=0?{grill:k}:{ing:h.id};kInteract();return;}
      if(KT.skill){KT.skill.p=(KT.skill.plo+KT.skill.phi)/2;stopSkill();return;}
      for(const g of KT.grills){if(!g.order)continue;if(g.done){KT.aim={grill:g.k};kInteract();return;}if(g.cooking<=0&&orderComplete(g.order)){KT.aim={grill:g.k};kSpace();return;}
        if(g.cooking<=0){const need=[...orderNeeds(g.order)].filter(id=>(E.serv[G.team][id]||0)>0);if(need.length){KT.aim={ing:need[0]};kInteract();return;}}}
      if(freeGrill()&&myTeam().queue.some(q=>q.state==='wait'&&!q.order)){KT.aim={win:true};kInteract();}}
  }catch(e){console.error('autopilot',e.message);}},50);});
  const until=async(fn,ms,label)=>{const t0=Date.now();while(Date.now()-t0<ms){if(await H.evaluate(fn).catch(()=>false))return true;await H.waitForTimeout(1500);}L('TIMEOUT',label);return false;};
  await H.waitForTimeout(8000);await shot(H,'08-drive-host');await shot(G1,'09-drive-passenger');await shot(G2,'10-drive-guest2');
  await until(()=>G.phase==='store',240000,'host store');await H.waitForTimeout(3000);await shot(H,'11-store-host');await shot(G1,'12-store-guest1');
  for(const p of [H,G1,G2])L('store',await st(p));
  await until(()=>G.leg==='event',420000,'event leg');L('event leg');await H.waitForTimeout(5000);await shot(H,'13-event-drive');
  await until(()=>G.phase==='event'&&E.phase==='dishes',300000,'planning');await H.waitForTimeout(2000);await shot(H,'14-planning');
  await until(()=>E.phase==='service',120000,'service');await H.waitForTimeout(20000);await shot(H,'15-kitchen-host');await shot(G1,'16-kitchen-guest1');await shot(G2,'17-kitchen-guest2');
  for(const p of [H,G1,G2])L('service',await p.evaluate(()=>JSON.stringify({cust:(E.customers||[]).length,stats:E.teams.map(t=>t.served+'/$'+Math.round(t.rev))})));
  await H.waitForTimeout(60000);await shot(G1,'18-kitchen-guest1-later');
  await until(()=>E.phase==='final',240000,'final');await H.waitForTimeout(4000);await shot(H,'19-final-host');await shot(G2,'20-final-guest2');
  for(const p of [H,G1,G2])L('final',await p.evaluate(()=>JSON.stringify({ph:E.phase,stats:E.teams.map(t=>[t.team,t.served,Math.round(t.rev)])})));
}catch(e){L('SMOKE FAIL',e.message,(e.stack||'').split('\n').slice(0,4).join(' | '));}
L('errors',Object.fromEntries(Object.entries(errs).map(([k,v])=>[k,v.length])));
fs.writeFileSync(`${OUT}/log.txt`,log.join('\n'));fs.writeFileSync(`${OUT}/errors.json`,JSON.stringify(errs,null,1));
await browser.close();srv.close();process.exit(0);
