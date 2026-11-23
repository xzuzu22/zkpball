import { CFG } from './config.js';

// ---------- Profil (yerel önbellek; veritabanıyla eşitlenir) ----------
const COLORS=['#d63a2a','#2a62d6','#f2c230','#1f9d55','#ffffff','#111111','#ff7a1a','#7b3fd1','#18b6c9','#e64a8f','#7a1f2b','#0e2a5c'];
const NAME_COLORS=['#ffffff','#f2c230','#ff6b5a','#5ab8ff','#6bf28a','#d38bff','#ff9a3d','#7ff4ff'];
const PATTERNS=[['solid','Düz'],['stripes','Çizgili'],['half','Yarım'],['hoop','Bant'],['sash','Kuşak']];
const DEF={name:'',avatar:'10',nameColor:'#ffffff',team:'Antrenman',abbr:'SEN',p:'#d63a2a',s:'#ffffff',pat:'solid',size:1,diff:1,time:180,skin:'classic',ambOn:true,amb:60,cel:'none',cam:1,ball:'classic',trail:'none'};
const SLOT=(new URLSearchParams(location.search).get('u')||'').replace(/[^a-z0-9]/gi,'').slice(0,8);
let prof={...DEF};
try{const s=JSON.parse(localStorage.getItem('uzk-profile'+SLOT)||'null'); if(s) prof={...DEF,...s};}catch(e){}
const save=()=>{try{localStorage.setItem('uzk-profile'+SLOT,JSON.stringify(prof));}catch(e){}};

// ---------- Ekranlar ----------
const $=id=>document.getElementById(id);
const screens=['gate','main','roomScr','game'];
let curTab='rooms';
function show(id){screens.forEach(s=>$(s).hidden=s!==id);
  if(id==='main')showTab(curTab);
  if(id==='roomScr')renderRoom();
  if(id==='game'){const on=!!(G&&G.net);$('chatBtn').hidden=!on;$('emoteBtn').hidden=!on;$('emoteBar').hidden=true;$('gchat').hidden=!on;if(!on)closeChat();}}
function showTab(t){curTab=t;document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===t)));
  ['rooms','profile','team','league'].forEach(x=>$('tab-'+x).hidden=x!==t);
  if(t==='rooms'){renderOnline();renderDrills();loadFriends();renderTutBox();}if(t==='profile'){renderProfile();renderPush();}if(t==='team')renderTeam();if(t==='league')renderLeague();}
function showMain(t){if(t)curTab=t;show('main');}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$('meChip').onclick=()=>showTab('profile');

let OWN={items:new Set(),prem:null};
const owns=it=>OWN.items.has(it)||(!!OWN.prem&&/^(name_color|skin_|cel_)/.test(it));
const skinOk=k=>!k||k==='classic'||owns('skin_'+k);
const celOk=k=>!k||k==='none'||owns('cel_'+k);
function toast(t){let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.setAttribute('role','status');document.body.appendChild(el);}el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),3200);}
function lockMsg(w){toast(`🔒 ${w} kilitli. Mağazadan kodla açabilirsin.`);}
function enforceOwned(){let ch=false;
  if(!owns('name_color')&&prof.nameColor&&prof.nameColor!=='#ffffff'){prof.nameColor='#ffffff';ch=true;}
  if(!celOk(prof.cel)){prof.cel='none';ch=true;}
  if(!skinOk(prof.skin)){prof.skin='classic';ch=true;}
  if(ch)save();return ch;}
function markLocks(){
  ['optSkin','hsSkin'].forEach(id=>document.getElementById(id)?.querySelectorAll('.chip').forEach(c=>c.classList.toggle('locked',!skinOk(c.dataset.v))));
  document.getElementById('celChips')?.querySelectorAll('.chip').forEach(c=>c.classList.toggle('locked',!celOk(c.dataset.v)));
  [['optSkin','skin'],['celChips','cel']].forEach(([id,k])=>document.getElementById(id)?.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(String(prof[k])===c.dataset.v))));
  try{renderStore();}catch(e){}}
function bindChips(id,key,num=true,guard){
  const box=$(id);
  const sync=()=>box.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(String(prof[key])===c.dataset.v)));
  box.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{const v=num?Number(c.dataset.v):c.dataset.v;if(guard&&!guard(v))return;prof[key]=v;save();sync();});
  sync();
}
bindChips('optSize','size');bindChips('optDiff','diff');bindChips('optTime','time');bindChips('optSkin','skin',false,v=>skinOk(v)||(lockMsg('Bu saha'),false));
document.querySelectorAll('#hostPanel .htab').forEach(t=>t.onclick=()=>{document.querySelectorAll('#hostPanel .htab').forEach(x=>x.setAttribute('aria-selected',String(x===t)));document.querySelectorAll('#hostPanel .hgroup').forEach(g=>g.hidden=g.dataset.hg!==t.dataset.ht);});bindChips('celChips','cel',false,v=>celOk(v)||(lockMsg('Bu gol sevinci'),false));document.getElementById('celChips').addEventListener('click',()=>{try{pushTag();}catch(e){}});
['optSkin','hsSkin'].forEach(id=>document.getElementById(id)?.addEventListener('click',e=>{const c=e.target.closest('.chip');if(c)skinImg(c.dataset.v);}));
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// ---------- Renk yardımcıları ----------
function hex2rgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function lum(h){const [r,g,b]=hex2rgb(h);return (0.299*r+0.587*g+0.114*b)/255;}
function cdist(a,b){const x=hex2rgb(a),y=hex2rgb(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);}

// ---------- Disk çizimi (oyunda ve önizlemede ortak) ----------
function drawDisc(ctx,x,y,r,kit,text,opts={}){
  ctx.save();
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.closePath();
  ctx.save();ctx.clip();
  ctx.fillStyle=kit.p;ctx.fillRect(x-r,y-r,2*r,2*r);
  ctx.fillStyle=kit.s;
  if(kit.pat==='stripes'){const w=r*0.32;for(let i=-3;i<=3;i+=2)ctx.fillRect(x+i*w-w/2,y-r,w,2*r);}
  else if(kit.pat==='half'){ctx.fillRect(x-r,y-r,r,2*r);}
  else if(kit.pat==='hoop'){ctx.fillRect(x-r,y-r*0.3,2*r,r*0.6);}
  else if(kit.pat==='sash'){ctx.beginPath();ctx.moveTo(x-r,y+r*0.25);ctx.lineTo(x+r*0.25,y-r);ctx.lineTo(x+r*0.75,y-r);ctx.lineTo(x-r,y+r*0.95);ctx.closePath();ctx.fill();}
  ctx.restore();
  ctx.lineWidth=opts.kick?r*0.2:r*0.13;
  ctx.strokeStyle=opts.kick?'#ffffff':'#000000';
  ctx.beginPath();ctx.arc(x,y,r-ctx.lineWidth/2+0.5,0,Math.PI*2);ctx.stroke();
  if(text){
    const base=kit.pat==='half'?kit.p:(kit.pat==='solid'?kit.p:kit.p);
    const light=lum(base)>0.6;
    ctx.font=`800 ${text.length>1?r*0.82:r*1.0}px "Saira Condensed","Arial Narrow",sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=r*0.18;ctx.strokeStyle=light?'rgba(255,255,255,.7)':'rgba(0,0,0,.75)';
    ctx.strokeText(text,x,y+r*0.06);
    ctx.fillStyle=light?'#111':'#fff';ctx.fillText(text,x,y+r*0.06);
  }
  if(opts.name){
    ctx.font=`700 ${r*0.62}px Inter,system-ui,sans-serif`;ctx.textBaseline='top';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.65)';
    const tg=opts.tag?opts.tag+' ':'',wt=ctx.measureText(tg).width,wn=ctx.measureText(opts.name).width,x0=x-(wt+wn)/2;ctx.textAlign='left';
    if(tg){ctx.strokeText(tg,x0,y+r+3);ctx.fillStyle='#f2c230';ctx.fillText(tg,x0,y+r+3);}
    ctx.strokeText(opts.name,x0+wt,y+r+3);ctx.fillStyle=opts.nameColor||'#fff';ctx.fillText(opts.name,x0+wt,y+r+3);
  }
  ctx.restore();
}
const userKit=()=>({p:prof.p,s:prof.s,pat:prof.pat});


// ---------- Ses ----------
let ac=null;
function audio(){try{if(!ac)ac=new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();}catch(e){}}
// bazı sahalarda arka plan ortam sesi (döngü): yağmur, bahçe
const AMB_SRC={rain:['assets/rain-ambience.mp3',0.6],drizzle:['assets/drizzle-ambience.mp3',0.5],sakura:['assets/garden-ambience.mp3',0.5],snow:['assets/wind-ambience.mp3',0.5],beach:['assets/beach-ambience.mp3',0.5]};
const AMB={bufs:{},loading:{},src:null,gain:null,url:''};
function ambWanted(){if(!G||G.ended||G.state==='over'||document.hidden)return 0;const g=document.getElementById('game');if(!g||g.hidden)return 0;const a=AMB_SRC[G.skin];return a?a[1]*ambLevel():0;}
const ambLevel=()=>prof.ambOn===false?0:Math.max(0,Math.min(100,Number(prof.amb??60)))/60;
const hasAmb=()=>!!G&&!!AMB_SRC[G.skin];
async function ambTick(){
  let want=ambWanted();const url=want?AMB_SRC[G.skin][0]:'';
  if(AMB.src&&url!==AMB.url)want=0; // saha değişti: önce eskisini kapat
  if(want&&!AMB.src){
    audio();if(!ac)return;
    if(!AMB.bufs[url]){if(AMB.loading[url])return;AMB.loading[url]=true;try{const r=await fetch(url);AMB.bufs[url]=await ac.decodeAudioData(await r.arrayBuffer());}catch(e){console.warn('ortam sesi yüklenemedi',e);}AMB.loading[url]=false;if(!AMB.bufs[url]||!ambWanted())return;}
    const buf=AMB.bufs[url];AMB.url=url;
    const src=ac.createBufferSource();src.buffer=buf;src.loop=true;src.loopStart=0.06;src.loopEnd=buf.duration-0.06;
    const g=ac.createGain();g.gain.setValueAtTime(0,ac.currentTime);g.gain.linearRampToValueAtTime(want,ac.currentTime+1.5);
    src.connect(g).connect(ac.destination);src.start(0,0.06);AMB.src=src;AMB.gain=g;AMB.vol=want;
  }else if(AMB.src&&!want){
    const src=AMB.src,g=AMB.gain;AMB.src=null;AMB.gain=null;
    try{g.gain.cancelScheduledValues(ac.currentTime);g.gain.setValueAtTime(g.gain.value,ac.currentTime);g.gain.linearRampToValueAtTime(0,ac.currentTime+0.8);src.stop(ac.currentTime+0.9);}catch(e){}
  }else if(AMB.src&&want!==AMB.vol){AMB.vol=want;AMB.gain.gain.linearRampToValueAtTime(want,ac.currentTime+0.6);}
}
setInterval(ambTick,400);document.addEventListener('visibilitychange',ambTick);
function sKick(power=1){if(!ac)return;const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(60,t+0.09);g.gain.setValueAtTime(0.35*power,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+0.13);}
function sWhistle(len=0.35,times=1){if(!ac)return;for(let i=0;i<times;i++){const t=ac.currentTime+i*(len+0.08),o=ac.createOscillator(),l=ac.createOscillator(),lg=ac.createGain(),g=ac.createGain();o.type='square';o.frequency.value=2900;l.frequency.value=28;lg.gain.value=120;l.connect(lg).connect(o.frequency);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.06,t+0.02);g.gain.setValueAtTime(0.06,t+len-0.04);g.gain.linearRampToValueAtTime(0,t+len);o.connect(g).connect(ac.destination);o.start(t);l.start(t);o.stop(t+len);l.stop(t+len);}}
// gol sesi: kayıttan (assets/goal-sound.mp3); yüklenemezse eski uğultu çalar
const GOALSND={buf:null,loading:false};
function loadGoalSnd(){if(GOALSND.buf||GOALSND.loading||!ac)return;GOALSND.loading=true;fetch('assets/goal-sound.mp3').then(r=>r.arrayBuffer()).then(b=>ac.decodeAudioData(b)).then(b=>{GOALSND.buf=b;}).catch(()=>{}).finally(()=>{GOALSND.loading=false;});}
function sCrowd(){if(!ac)return;loadGoalSnd();
  if(GOALSND.buf){const s=ac.createBufferSource();s.buffer=GOALSND.buf;const g=ac.createGain();g.gain.value=0.9;s.connect(g).connect(ac.destination);s.start();return;}
  sCrowdNoise();}
function sCrowdNoise(){if(!ac)return;const t=ac.currentTime,len=1.6,buf=ac.createBuffer(1,ac.sampleRate*len,ac.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);const s=ac.createBufferSource();s.buffer=buf;const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=900;f.Q.value=0.6;const g=ac.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.25,t+0.15);g.gain.exponentialRampToValueAtTime(0.001,t+len);s.connect(f).connect(g).connect(ac.destination);s.start(t);}

// ---------- Saha ve fizik ----------
const PR=15,BR=10,POSTR=8;
// Haxball'un varsayılan haritaları: dış sınır (oyuncular), saha (top), kale ağzı yarısı, başlama çemberi
const MAPS={classic:{name:'Classic',bx:420,by:200,fw:370,fh:170,gh:64,kr:75},big:{name:'Big',bx:600,by:270,fw:550,fh:240,gh:80,kr:80},huge:{name:'Huge',bx:750,by:350,fw:700,fh:320,gh:100,kr:80}};
let FW,FH,GH,GD=30,KR,BX,BY,VW,VH,SPAWN;
const posts=[];
// Eğlence modları (derecesiz): fizik parametrelerini değiştirir
const MODES={normal:{n:'Normal',i:'⚽'},
  futsal:{n:'Futsal',i:'🥅',d:'Ağır top, az seken duvarlar: kısa pas ve top sürme',bd:0.978,kick:4.3,we:0.15},
  tek:{n:'Tek dokunuş',i:'☝️',d:'Topa üst üste iki kez vuramazsın, pas vermek zorunlu',one:1},
  dev:{n:'Dev kale',i:'🥅',d:'Kaleler 1,7 kat büyük, gol yağmuru',gh:1.7},
  buz:{n:'Buzlu zemin',i:'🧊',d:'Kaygan saha: hızlanmak kolay, durmak zor',pa:0.045,pd:0.988}};
let PH={pa:0.1,pak:0.07,pd:0.96,bd:0.99,kick:5,we:0.5,one:0,gh:1,mode:'normal'};
function setMode(k){const m=MODES[k]||MODES.normal;PH={pa:m.pa||0.1,pak:m.pa?m.pa*0.7:0.07,pd:m.pd||0.96,bd:m.bd||0.99,kick:m.kick||5,we:m.we??0.5,one:m.one||0,gh:m.gh||1,mode:MODES[k]?k:'normal'};}
const cleanMode=k=>MODES[k]?k:'normal';
function setMap(k){const m=MAPS[k];FW=m.fw;FH=m.fh;GH=Math.round(m.gh*(PH.gh||1));KR=m.kr;BX=m.bx;BY=m.by;VW=BX;VH=BY;SPAWN=Math.min(400,0.75*FW);
  posts.length=0;for(const sx of[-1,1])for(const sy of[-1,1])posts.push({x:sx*FW,y:sy*GH,r:POSTR,im:0,vx:0,vy:0,team:sx<0?0:1});}
setMap('classic');
window.__uzk={G:()=>G,step:()=>step(),keys:()=>keys};
// Haxball varsayılanları: acceleration .1, kickingAcceleration .07, damping/kickingDamping .96, top damping .99, kickStrength 5
const P_ACC=0.1,P_ACC_K=0.07,P_DAMP=0.96,B_DAMP=0.99,KICK=5;
const DIFF=[{acc:0.82,react:14,noise:0.55,kick:0.25},{acc:0.94,react:7,noise:0.28,kick:0.55},{acc:1.0,react:3,noise:0.12,kick:0.85}];
const BOT_NAMES=['Kaan','Mert','Efe','Arda','Deniz','Barış','Ozan','Emir','Can','Umut'];
let G=null;if(location.hash==="#dbg"){window.__G=()=>G;window.__N=()=>NET;window.__F=()=>({FW,FH});window.__wx=()=>bolt;window.__amb=()=>AMB;} // yerel test için


// Haxball gibi: herkes kendi yarısında SPAWN çizgisinde, 0, +55, -55, +110 ... dizilir
function formation(n){const ys=[0,55,-55,110,-110];return Array.from({length:n},(_,i)=>[-SPAWN,ys[i]]);}

function mkPlayer(t,i,o){return {x:0,y:0,vx:0,vy:0,r:PR,im:0.5,team:t,idx:i,pid:o.pid||('p'+t+i),human:!!o.human,local:!!o.local,remote:!!o.remote,gk:!!o.gk,
  avatar:o.avatar,name:o.name,nameColor:o.nameColor||'#ffffff',tag:cleanTag(o.tag),cel:cleanCel(o.cel),trail:cleanTrail(o.trail),sr:cleanTier(o.sr),g:0,a:0,kick:false,armed:true,ix:0,iy:0,tick:Math.floor(Math.random()*10),tx:0,ty:0,wantKick:false};}
function startMatch(opt={}){
  audio();
  const players=[];let size,training=false,kits;setMode(opt.drill?'normal':cleanMode(opt.mode));
  if(opt.roster){
    setMap(opt.map||'classic');kits=opt.kits;const cnt=[0,0];
    opt.roster.forEach(r=>{const i=cnt[r.team]++;players.push(mkPlayer(r.team,i,r));});
    size=Math.max(cnt[0],cnt[1],1);
    for(const t of[0,1]){const tp=players.filter(p=>p.team===t);if(tp.length>=2){const lb=[...tp].reverse().find(p=>!p.human);if(lb)lb.gk=true;}}
  } else {
    size=opt.size??prof.size;setMap(size<=2?'classic':size<=4?'big':'huge');training=size===0;
    const uk=userKit();
    let rk=opt.rival||null;
    if(!rk){const base=cdist(uk.p,'#2a62d6')<140?{p:'#d63a2a',s:'#ffffff'}:{p:'#2a62d6',s:'#ffffff'};rk={name:'Bot FK',abbr:'BOT',p:base.p,s:base.s,pat:'solid'};}
    else if(cdist(uk.p,rk.p)<110){rk={...rk,p:rk.s,s:rk.p};}
    kits=[{...uk,name:prof.team,abbr:prof.abbr},{...rk}];
    const names=[...BOT_NAMES].sort(()=>Math.random()-0.5);
    for(let t=0;t<2;t++){
      if(training&&t===1)continue;
      formation(training?1:size).forEach((pos,i)=>{
        const human=t===0&&i===0;
        players.push(mkPlayer(t,i,{human,local:human,gk:size>=2&&i===size-1,avatar:human?prof.avatar:String(i+1),name:human?prof.name:names.pop(),nameColor:human?prof.nameColor:'#ffffff',tag:human?myTag():'',cel:human?prof.cel:'',trail:human?prof.trail:'',sr:human?bestTier():''}));
      });
    }
    if(training)size=1;
  }
  G={size,training,diff:DIFF[opt.diff??prof.diff],time:opt.time||prof.time,clock:opt.time||prof.time,score:[0,0],kits,
    players,ball:{x:0,y:0,vx:0,vy:0,r:BR,im:1},
    kickoff:true,kickTeam:training?0:(Math.random()<0.5?0:1),state:'play',stateT:0,golden:false,paused:false,opt,
    net:opt.net||null,skin:opt.skin||prof.skin,mapKey:opt.map||'classic',myTeam:opt.myTeam??0,goalLimit:opt.goals||0,kseq:0,gseq:0,lastGoal:-1,gi:-1,ai:-1,t1:null,t2:null,bubbles:{},tick:0,rec:[],goals:[],pend:null,pip:null};
  CELFX=[];preloadCels();loadGoalSnd();
  resetPositions();
  show('game');$('endOv').hidden=true;$('pauseOv').hidden=true;{const ex=$('endExtra');if(ex){ex.innerHTML='';ex.hidden=true;}}
  $('againBtn').textContent=G.net?'Odaya dön':'Rövanş';$('endMenu').textContent=G.net?'Odadan çık':'Menü';
  $('resumeBtn').textContent='Devam';$('quitBtn').textContent=G.net?'Maçı bitir, odaya dön':'Maçı bırak';
  resize();renderHud();if(!opt.silent)sWhistle(0.45,1);
  last=performance.now();acc=0;
  if(G.net&&G.net.role==='host')ensureBgTicker();
}
// ---------- Antrenman görevleri ----------
const DRILLS={
  shoot:{name:'Şut Ustası',desc:'10 top, her biri için 6 saniye. Kaleye ne kadar çok gol atarsan.',unit:'gol',medals:[4,7,9],higher:true},
  slalom:{name:'Slalom',desc:'Topu sırayla 6 kapıdan geçir, sonra gole çevir. Ne kadar hızlı o kadar iyi.',unit:'sn',medals:[75,50,35],higher:false},
  keeper:{name:'Kaleciyi Geç',desc:'Bot kaleciye karşı 10 deneme, her biri 7 saniye.',unit:'gol',medals:[3,5,7],higher:true},
};
const MEDALS=['Bronz','Gümüş','Altın'],MEDAL_C=['#c98a55','#c9d1d9','#f2c230'];
function drillMedal(kind,v){const D=DRILLS[kind];let m=-1;D.medals.forEach((t,i)=>{if(D.higher?v>=t:v<=t)m=i;});return m;}
function startDrill(kind){
  if(kind==='tut')return startTut();
  const D=DRILLS[kind];if(!D)return;
  const roster=[{pid:'me',team:0,human:true,local:true,avatar:prof.avatar,name:prof.name,nameColor:prof.nameColor,tag:myTag(),cel:prof.cel,trail:prof.trail,sr:bestTier()}];
  if(kind==='keeper')roster.push({pid:'gk',team:1,human:false,avatar:'1',name:'Kaleci',nameColor:'#ffffff'});
  const uk=userKit();startMatch({roster,map:'classic',kits:[{...uk,name:prof.team,abbr:prof.abbr},{name:'Bot',abbr:'BOT',p:'#2a62d6',s:'#ffffff',pat:'solid'}],time:600,goals:0,skin:prof.skin,diff:prof.diff});
  G.training=true;G.drill={kind,n:0,score:0,t:0,att:0,gate:0,max:kind==='slalom'?1:10,limit:kind==='shoot'?360:kind==='keeper'?420:120*60,res:[]};
  if(kind==='keeper'){const k=G.players[1];k.gk=true;k.role='gk';}
  if(kind==='slalom'){const gs=[];for(let i=0;i<6;i++){const x=-FW*0.62+i*(FW*1.24/5),y=(i%2?1:-1)*FH*0.42;gs.push({x,y,h:46});}G.drill.gates=gs;}
  drillNext(true);renderHud();
}
// ---------- Yeni oyuncu rehberi ----------
const TOUCH=matchMedia('(pointer:coarse)').matches;
const TUT=[
  {t:TOUCH?'Ekranın sol yarısına dokunup sürükle: sarı noktaya yürü':'Yön tuşları ya da WASD ile sarı noktaya git',k:'go',x:-0.45,y:-0.5},
  {t:'Güzel! Şimdi diğer noktaya git',k:'go',x:0.1,y:0.55},
  {t:'Topa çarparak sürebilirsin. Topu sarı alana getir',k:'dribble',x:0.35,y:-0.35},
  {t:TOUCH?'Topa yaklaş ve sağdaki ŞUT düğmesine bas: kaleye gol at':'Topa yaklaş, Boşluk ya da X ile şut çek: kaleye gol at',k:'goal'},
  {t:TOUCH?'Sol üstteki 🎥 kamera düğmesine dokunup kamerayı değiştir':'1–7 tuşlarıyla kamera açısını değiştir (Haxball\'daki gibi)',k:'cam'},
];
function startTut(){
  const roster=[{pid:'me',team:0,human:true,local:true,avatar:prof.avatar,name:prof.name,nameColor:prof.nameColor,tag:myTag(),cel:prof.cel,trail:prof.trail,sr:bestTier()}];
  const uk=userKit();startMatch({roster,map:'classic',kits:[{...uk,name:prof.team,abbr:prof.abbr},{name:'Bot',abbr:'BOT',p:'#2a62d6',s:'#ffffff',pat:'solid'}],time:600,goals:0,skin:'classic',diff:0});
  G.training=true;G.drill={kind:'tut',step:0,t:0,score:0,res:[]};const me=G.players[0];me.x=-FW*0.75;me.y=0;G.ball.x=-FW*0.2;G.ball.y=FH*0.2;G.kickoff=false;renderHud();
}
function tutNext(){const d=G.drill;d.step++;d.t=0;sKick(0.7);
  if(d.step>=TUT.length){d.done=true;G.state='over';prof.tut=1;save();$('banner').classList.remove('on');
    $('endScore').textContent='Hazırsın!';$('endLbl').textContent='Eğitim tamamlandı';$('endMsg').textContent='Gerçek maç için Hızlı eşleş\'e bas; seni hemen bir odaya atar. Antrenman görevleriyle de pratik yapabilirsin.';
    $('endStats').innerHTML='';$('endGoals').hidden=true;document.querySelectorAll('#endOv .rdelta').forEach(e=>e.remove());$('againBtn').textContent='Hızlı eşleş';$('endMenu').textContent='Menü';$('endOv').hidden=false;renderTutBox();return;}
  const st=TUT[d.step];if(st.k==='goal'){G.ball.x=FW*0.45;G.ball.y=0;G.ball.vx=G.ball.vy=0;}if(st.k==='cam')d.cam0=camMode();renderHud();}
function tutTick(){const d=G.drill,st=TUT[d.step];if(!st||G.state!=='play')return;d.t++;const me=G.players[0],b=G.ball;
  if(st.k==='go'&&Math.hypot(me.x-st.x*FW,me.y-st.y*FH)<26)tutNext();
  else if(st.k==='dribble'&&Math.hypot(b.x-st.x*FW,b.y-st.y*FH)<40)tutNext();
  else if(st.k==='cam'&&camMode()!==d.cam0)tutNext();
  if(d.t%15===0)renderHud();}
function tutGoal(team){const b=G.ball;b.vx=b.vy=0;
  if(TUT[G.drill.step].k==='goal'&&team===0){sCrowd();goalBanner('GOL!',-1,-1);G.state='goal';G.stateT=60;G.drill.after=true;return;}
  b.x=Math.sign(b.x)*(FW*0.5);b.y=0;}
function tutHud(){const d=G.drill;return `<span class="tutstep">${Math.min(d.step+1,TUT.length)}/${TUT.length}</span> ${esc(TUT[d.step]?TUT[d.step].t:'')}`;}
function drawTut(){const d=G.drill,st=TUT[d.step];if(!st)return;const t=performance.now()/300;
  if(st.k==='go'||st.k==='dribble'){const x=st.x*FW,y=st.y*FH,r=(st.k==='go'?22:36)+Math.sin(t)*3;ctx.fillStyle='rgba(242,194,48,.22)';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f2c230';ctx.lineWidth=3;ctx.setLineDash([6,5]);ctx.stroke();ctx.setLineDash([]);}
  if(st.k==='goal'){ctx.fillStyle=`rgba(242,194,48,${0.15+0.1*Math.sin(t)})`;ctx.fillRect(FW,-GH,GD,2*GH);}
  if(st.k==='dribble'||st.k==='goal'){const b=G.ball;ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,b.r+6+Math.sin(t*1.5)*2,0,Math.PI*2);ctx.stroke();}
}
function renderTutBox(){const box=$('tutBox');if(!box)return;box.hidden=!!prof.tut||!!NET.room;if(box.hidden)return;box.innerHTML='';
  const t=document.createElement('span');t.textContent='Zkpball\'a hoş geldin! Oynamayı 1 dakikada öğren: hareket, top sürme, şut ve kamera.';
  const b=document.createElement('button');b.className='big';b.textContent='Eğitime başla';b.onclick=()=>startTut();
  const x=document.createElement('button');x.className='chip';x.textContent='Biliyorum, geç';x.onclick=()=>{prof.tut=1;save();renderTutBox();};box.append(t,b,x);}
function drillNext(first){
  const d=G.drill,b=G.ball,me=G.players[0];if(!first&&d.kind!=='slalom')d.att++;
  if(d.kind!=='slalom'&&d.att>=d.max){drillEnd();return;}
  d.t=0;b.vx=b.vy=0;me.vx=me.vy=0;G.kickoff=false;G.t1=G.t2=null;
  if(d.kind==='shoot'){b.x=FW*(0.1+Math.random()*0.5);b.y=(Math.random()*2-1)*FH*0.7;me.x=b.x-55;me.y=b.y+(Math.random()*2-1)*20;}
  else if(d.kind==='keeper'){b.x=FW*0.35;b.y=(Math.random()*2-1)*FH*0.5;me.x=b.x-50;me.y=b.y;const k=G.players[1];k.x=FW-28;k.y=0;k.vx=k.vy=0;}
  else{if(d.back){d.back=false;b.x=Math.sign(b.x||1)*(FW-80);b.y=0;return;}if(!first){drillEnd();return;}b.x=-FW*0.78;b.y=0;me.x=b.x-42;me.y=0;d.gate=0;}
}
function drillTick(){
  if(G.drill.kind==='tut')return tutTick();
  const d=G.drill,b=G.ball;if(G.state!=='play')return;d.t++;
  if(d.kind==='slalom'){
    const g=d.gates[d.gate];
    if(g&&Math.abs(b.y-g.y)<g.h&&((d.lx??b.x)<g.x)!==(b.x<g.x)){d.gate++;sKick(0.5);}
    d.lx=b.x;
    if(d.t>d.limit){d.score=0;drillEnd(true);return;}
    if(d.t%15===0)renderHud();return;}
  if(d.t>d.limit||(d.t>90&&Math.hypot(b.vx,b.vy)<0.05&&b.x<FW*0.05)){d.res.push(0);drillNext();renderHud();return;}
  if(d.t%15===0)renderHud();
}
function drillGoal(team){
  if(G.drill.kind==='tut')return tutGoal(team);
  const d=G.drill;
  if(d.kind==='slalom'){
    if(team!==0||d.gate<d.gates.length){G.ball.vx=G.ball.vy=0;G.ball.x=Math.sign(G.ball.x)*(FW-30);goalBanner(d.gate<d.gates.length?`ÖNCE KAPILAR (${d.gate}/${d.gates.length})`:'YANLIŞ KALE',-1,-1);G.state='goal';G.stateT=50;d.back=true;return;}
    d.score=Math.round(d.t/6)/10;sCrowd();goalBanner('BİTTİ! '+d.score.toFixed(1)+' sn',-1,-1);G.state='goal';G.stateT=70;return;}
  if(team===0){d.score++;d.res.push(1);sCrowd();goalBanner('GOL!',-1,-1);}else{d.res.push(0);goalBanner('KENDİ KALENE',-1,-1);}
  G.state='goal';G.stateT=55;renderHud();
}
function drillEnd(fail){
  const d=G.drill,D=DRILLS[d.kind];G.state='over';$('banner').classList.remove('on');
  const v=d.kind==='slalom'?(fail?999:d.score):d.score;const m=fail?-1:drillMedal(d.kind,v);
  prof.drills=prof.drills||{};const old=prof.drills[d.kind];const better=!fail&&(!old||(D.higher?v>old.best:v<old.best));
  if(better){prof.drills[d.kind]={best:v,medal:Math.max(m,old?old.medal:-1)};save();}
  $('endScore').textContent=fail?'Süre doldu':(d.kind==='slalom'?v.toFixed(1)+' sn':v+' / '+d.max);$('endLbl').textContent='Antrenman · '+D.name;
  $('endMsg').textContent=(m>=0?MEDALS[m]+' madalya! ':fail?'':'Madalya için biraz daha. ')+(better&&old?'Yeni rekor!':old?'Rekorun: '+(d.kind==='slalom'?old.best.toFixed(1)+' sn':old.best):'');
  const box=$('endStats');box.innerHTML='';const md=document.createElement('div');md.className='medalrow';
  D.medals.forEach((t,i)=>{const e=document.createElement('span');e.className='medal'+(m>=i?' on':'');e.style.setProperty('--mc',MEDAL_C[i]);e.textContent=MEDALS[i]+' · '+(d.kind==='slalom'?'≤'+t+' sn':t+'+');md.appendChild(e);});
  box.appendChild(md);$('endGoals').hidden=true;document.querySelectorAll('#endOv .rdelta').forEach(e=>e.remove());
  $('againBtn').textContent='Tekrar dene';$('endMenu').textContent='Menü';$('endOv').hidden=false;renderDrills();
  if(!fail&&['shoot','slalom','keeper'].includes(d.kind))DB.submitDrill(d.kind,v).then(b=>{if(!b||!b.me||!G||!G.drill)return;const e=document.createElement('div');e.className='rdelta up';
    e.textContent=`🏆 Haftalık tabloda ${b.me.pos}. sıradasın (${b.count} kişi)`+(b.me.pos===1?' · şu an haftanın birincisisin!':'');$('endStats').before(e);renderDrillBoard(d.kind);}).catch(()=>{});
}
function drillHud(){const d=G.drill,D=DRILLS[d.kind];if(d.kind==='tut')return tutHud();
  if(d.kind==='slalom')return `<span class="kit" style="background:${G.kits[0].p}"></span>${D.name.toUpperCase()} · KAPI ${Math.min(d.gate,d.gates.length)}/${d.gates.length}<span class="clock">${(d.t/60).toFixed(1)}</span>`;
  return `<span class="kit" style="background:${G.kits[0].p}"></span>${D.name.toUpperCase()} · ${d.score} GOL · TOP ${Math.min(d.att+1,d.max)}/${d.max}<span class="clock">${Math.max(0,Math.ceil((d.limit-d.t)/60))}</span>`;}
function drawDrill(){
  if(G.drill.kind==='tut')return drawTut();
  const d=G.drill;
  if(d.kind==='slalom'){d.gates.forEach((g,i)=>{const done=i<d.gate,next=i===d.gate;
      ctx.strokeStyle=done?'rgba(127,224,170,.5)':next?'rgba(242,194,48,.9)':'rgba(255,255,255,.35)';ctx.lineWidth=next?4:2;ctx.setLineDash(next?[]:[6,6]);
      ctx.beginPath();ctx.moveTo(g.x,g.y-g.h);ctx.lineTo(g.x,g.y+g.h);ctx.stroke();ctx.setLineDash([]);
      for(const yy of[g.y-g.h,g.y+g.h]){ctx.fillStyle=done?'#2fbf71':next?'#f2c230':'#ff7a1a';ctx.beginPath();ctx.moveTo(g.x,yy-11);ctx.lineTo(g.x+8,yy+7);ctx.lineTo(g.x-8,yy+7);ctx.closePath();ctx.fill();}
      ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='800 16px Inter,system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),g.x,g.y+(g.y<0?-g.h-24:g.h+24));});
    if(d.gate>=d.gates.length){ctx.fillStyle='rgba(242,194,48,.18)';ctx.fillRect(FW,-GH,GD,2*GH);}
    return;}
  // hedef kale vurgusu + deneme noktaları
  ctx.fillStyle='rgba(242,194,48,.14)';ctx.fillRect(FW,-GH,GD,2*GH);
  const n=d.max,w=14;for(let i=0;i<n;i++){const x=-((n-1)*w)/2+i*w,y=-FH-18;ctx.fillStyle=i<d.res.length?(d.res[i]?'#2fbf71':'#e0483e'):i===d.res.length?'#f2c230':'rgba(255,255,255,.25)';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();}
  if(d.t<200&&d.kind!=='slalom'){const a=Math.max(0,1-d.t/200);ctx.fillStyle=`rgba(255,255,255,${0.6*a})`;ctx.font='700 14px Inter,system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('Şut: Boşluk / X',G.ball.x,G.ball.y-34);}
}
function renderDrills(){const box=$('drillList');if(!box)return;box.innerHTML='';const st=prof.drills||{};setTimeout(()=>renderDrillBoard(),0);
  for(const [k,D] of Object.entries(DRILLS)){const b=document.createElement('button');b.className='drill';const r=st[k];
    const m=r?r.medal:-1;b.style.setProperty('--mc',m>=0?MEDAL_C[m]:'rgba(255,255,255,.18)');
    b.innerHTML='<i></i><b></b><span></span><em></em>';b.querySelector('i').textContent=m>=0?'★':'☆';b.querySelector('b').textContent=D.name;b.querySelector('span').textContent=D.desc;
    b.querySelector('em').textContent=r?(m>=0?MEDALS[m]+' · ':'')+'Rekor: '+(k==='slalom'?r.best.toFixed(1)+' sn':r.best+' gol'):'Henüz denemedin';
    b.onclick=()=>startDrill(k);box.appendChild(b);}}
function resetPositions(){
  const f=formation(G.size);
  G.players.forEach(p=>{const s=p.team===0?1:-1;const [fx,fy]=f[p.idx];p.x=fx*s;p.y=fy*s;p.vx=p.vy=0;p.armed=true;});
  G.ball.x=G.ball.y=G.ball.vx=G.ball.vy=0;G.kickoff=true;G.t1=G.t2=null;
}
// topa son dokunan ve ondan önceki: gol ve asist hesabı için
function touch(p){if(G.t1!==p){G.t2=G.t1;G.t1=p;}}

function collide(a,b,bounce){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),rs=a.r+b.r;
  if(d>=rs||d===0)return false;
  const nx=dx/d,ny=dy/d,pen=rs-d,im=a.im+b.im;if(im===0)return false;
  a.x-=nx*pen*a.im/im;a.y-=ny*pen*a.im/im;b.x+=nx*pen*b.im/im;b.y+=ny*pen*b.im/im;
  const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(rv<0){const j=-(1+bounce)*rv/im;a.vx-=j*nx*a.im;a.vy-=j*ny*a.im;b.vx+=j*nx*b.im;b.vy+=j*ny*b.im;}
  return true;
}
function ballWalls(b){
  // duvar: top 0.5 × duvar 1 = 0.5 sekme; sadece duvara doğru giden hız yansır
  const r=b.r,E=PH.we;let hit=false;
  if(Math.abs(b.y)>GH-2){ if(Math.abs(b.x)>FW-r){const s=Math.sign(b.x);b.x=s*(FW-r);if(b.vx*s>0)b.vx*=-E;hit=true;} }
  else if(Math.abs(b.x)>FW-1){
    if(Math.abs(b.y)>GH-r){const s=Math.sign(b.y);b.y=s*(GH-r);if(b.vy*s>0)b.vy*=-0.05;}
    if(Math.abs(b.x)>FW+GD-r){const s=Math.sign(b.x);b.x=s*(FW+GD-r);if(b.vx*s>0)b.vx*=-0.05;}
  }
  if(Math.abs(b.y)>FH-r){const s=Math.sign(b.y);b.y=s*(FH-r);if(b.vy*s>0)b.vy*=-E;hit=true;}
  return hit;
}

// ---------- Girdi ----------
const keys={};
const isTyping=e=>{const t=e.target;return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA');};
addEventListener('keydown',e=>{if(isTyping(e))return;if(e.key==='Enter'&&G&&G.net&&!$('game').hidden){e.preventDefault();openChat();return;}keys[e.code]=true;if(G&&!$('game').hidden&&(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)||KICK_KEYS.includes(e.code)))e.preventDefault();if(e.code==='Escape'&&G&&!$('game').hidden)togglePause();});
addEventListener('keyup',e=>{if(isTyping(e))return;keys[e.code]=false;});
const joy={id:null,ox:0,oy:0,x:0,y:0};let kickTouch=false;let mouseKick=false;
// Klavye ghosting: çoğu klavye iki ok + Boşluk'u aynı anda okuyamaz. Bu yüzden ok tuşlarından farklı bölgedeki tuşlar ve fare tıklaması da şut sayılır.
const KICK_KEYS=['Space','KeyX','KeyC','KeyZ','ShiftLeft','ShiftRight','Numpad0','Slash','Period'];
addEventListener('pointerup',e=>{if(e.pointerType==='mouse'&&e.button===0)mouseKick=false;});addEventListener('pointercancel',e=>{if(e.pointerType==='mouse')mouseKick=false;});addEventListener('blur',()=>{for(const k in keys)keys[k]=false;mouseKick=false;});
const gameEl=$('game');
gameEl.addEventListener('pointerdown',e=>{
  audio();
  if(e.target.closest('button'))return;
  if(e.pointerType==='mouse'){if(e.button===0&&!e.target.closest('.overlay,input,textarea,a')){mouseKick=true;e.preventDefault();}return;}
  if(e.clientX<innerWidth*0.55&&joy.id===null){joy.id=e.pointerId;joy.ox=e.clientX;joy.oy=e.clientY;joy.x=joy.y=0;}
  else if(e.clientX>=innerWidth*0.55){kickTouch=true;e.target.dataset.kp=e.pointerId;}
});
gameEl.addEventListener('pointermove',e=>{if(e.pointerId===joy.id){let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const m=Math.hypot(dx,dy),R=50;if(m>R){joy.ox+= (dx/m)*(m-R);joy.oy+=(dy/m)*(m-R);dx=e.clientX-joy.ox;dy=e.clientY-joy.oy;}joy.x=dx/R;joy.y=dy/R;}});
const endPtr=e=>{if(e.pointerId===joy.id){joy.id=null;joy.x=joy.y=0;} if(e.target&&e.target.dataset&&e.target.dataset.kp==String(e.pointerId)){kickTouch=false;delete e.target.dataset.kp;}};
gameEl.addEventListener('pointerup',endPtr);gameEl.addEventListener('pointercancel',endPtr);
const kb=$('kickBtn');
kb.addEventListener('pointerdown',e=>{e.preventDefault();audio();kickTouch=true;kb.classList.add('down');try{kb.setPointerCapture(e.pointerId);}catch(_){}});
const kup=()=>{kickTouch=false;kb.classList.remove('down');};
kb.addEventListener('pointerup',kup);kb.addEventListener('pointercancel',kup);

function humanInput(p){
  let x=0,y=0;
  if(keys.ArrowLeft||keys.KeyA)x-=1;if(keys.ArrowRight||keys.KeyD)x+=1;if(keys.ArrowUp||keys.KeyW)y-=1;if(keys.ArrowDown||keys.KeyS)y+=1;
  if(joy.id!==null){const m=Math.hypot(joy.x,joy.y);if(m>0.18){x=joy.x;y=joy.y;}}
  const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}
  p.ix=x;p.iy=y;p.kick=!!(KICK_KEYS.some(k=>keys[k])||mouseKick||kickTouch);
}

// ---------- Yapay zekâ ----------
function aiAssign(team){
  const ps=G.players.filter(p=>p.team===team),b=G.ball;
  const d=p=>Math.hypot(p.x-b.x,p.y-b.y);
  const human=ps.find(p=>p.human);
  const field=ps.filter(p=>!p.human&&!p.gk).sort((a,c)=>d(a)-d(c));
  ps.forEach(p=>{if(!p.human)p.role=p.gk?'gk':'sup';});
  if(field.length){ if(!human||d(field[0])<d(human)-10) field[0].role='chase'; }
}
function aiThink(p){
  const D=G.diff,b=G.ball,dir=p.team===0?1:-1;
  p.tick++;
  if(p.tick%D.react===0){
    const ownX=-dir*FW;
    const dGoalBall=Math.hypot(b.x-ownX,b.y);
    let role=p.role;
    if(role==='gk'&&dGoalBall<170)role='chase';
    if(role==='sup'&&G.players.filter(q=>q.team===p.team&&q.role==='chase').length===0)role='chase';
    if(role==='chase'){
      const gx=dir*(FW+10),gy=(Math.random()-0.5)*GH*1.2;
      let ax=gx-b.x,ay=gy-b.y;const am=Math.hypot(ax,ay)||1;ax/=am;ay/=am;
      const n=(Math.random()-0.5)*D.noise,c=Math.cos(n),s=Math.sin(n);[ax,ay]=[ax*c-ay*s,ax*s+ay*c];
      const tbx=b.x-p.x,tby=b.y-p.y;
      const along=tbx*ax+tby*ay;const perp=Math.abs(-tbx*ay+tby*ax);
      const bx=b.x-ax*(PR+BR+3),by=b.y-ay*(PR+BR+3);
      if(along>0&&perp<11){p.tx=b.x+ax*12;p.ty=b.y+ay*12;
        const close=Math.hypot(tbx,tby)<PR+BR+6, distGoal=Math.hypot(gx-b.x,gy-b.y);
        p.wantKick=close&&(distGoal<430||Math.random()<0.08)&&Math.random()<D.kick+0.3;}
      else{ const side=Math.sign(-tbx*ay+tby*ax)||1;
        if(along<=0){p.tx=bx-ay*side*38;p.ty=by+ax*side*38;}else{p.tx=bx;p.ty=by;}
        p.wantKick=false;
        // tehlike: top kendi kalesine yakın ve önündeysek uzaklaştır
        if(dGoalBall<120&&Math.hypot(tbx,tby)<PR+BR+6&&Math.random()<D.kick){p.wantKick=(b.x-p.x)*dir>-4;}
      }
    } else if(role==='gk'){
      p.tx=ownX+dir*28;p.ty=Math.max(-GH+6,Math.min(GH-6,b.y*0.55));p.wantKick=false;
    } else {
      const sp=(p.idx%2?-1:1)*(90+45*Math.floor(p.idx/2));p.tx=Math.max(-FW+30,Math.min(FW-30,b.x-dir*(90+20*p.idx)));p.ty=Math.max(-FH+30,Math.min(FH-30,b.y+sp));p.wantKick=false;
    }
    p.tx=Math.max(-BX+PR,Math.min(BX-PR,p.tx));p.ty=Math.max(-BY+PR,Math.min(BY-PR,p.ty));
  }
  let dx=p.tx-p.x,dy=p.ty-p.y;const m=Math.hypot(dx,dy);
  if(m>4){p.ix=dx/m*D.acc;p.iy=dy/m*D.acc;}else{p.ix=dx/8;p.iy=dy/8;}
  p.kick=p.wantKick&&p.armed;
  if(!p.armed)p.wantKick=false;
}

// ---------- Simülasyon adımı ----------
function step(){
  if(G.state==='goal'){G.stateT--;if(G.stateT<=0){if(G.drill){$('banner').classList.remove('on');G.state='play';if(G.drill.kind==='tut'){if(G.drill.after){G.drill.after=false;tutNext();}return;}drillNext();return;}if(G.over){endMatch();return;}resetPositions();G.state='play';$('banner').classList.remove('on');}
    // Gol sonrası: oyuncular serbestçe koşup sevinebilir, şut yok; top ağda yavaşlayıp durur ve itilemez
    if(G.drill){integrate(false);return;}
    G.tick=(G.tick||0)+1;readInputs();integrate(true,true);return;}
  if(G.tick%10===0){aiAssign(0);aiAssign(1);}
  G.tick=(G.tick||0)+1;
  readInputs();
  integrate(true);
  if(G.net&&G.net.role==='host'&&G.tick%30===0)afkCheck();
  if(!G.kickoff&&!G.golden&&!G.training){G.clock-=1/60;if(G.clock<=0){G.clock=0;if(G.score[0]!==G.score[1]){sWhistle(0.5,3);endMatch();return;}else{G.golden=true;}}}
  if(G.drill){drillTick();if(!G||G.state==='over')return;}
  if(Math.abs(G.ball.x)>FW+G.ball.r&&Math.abs(G.ball.y)<GH){if(G.drill)drillGoal(G.ball.x>0?0:1);else goal(G.ball.x>0?0:1);}
  if(G.tick%15===0)renderHud();
}
function readInputs(){
  const NI=G.net?netHostInputs():null;
  for(const p of G.players){if(p.local)humanInput(p);else if(p.human){const i=NI&&NI[p.pid];if(Array.isArray(i)){const ik=i.join();if(ik!==p.lastKey){p.lastKey=ik;p.lastActTick=G.tick;}p.ix=Math.max(-1,Math.min(1,Number(i[0])/10||0));p.iy=Math.max(-1,Math.min(1,Number(i[1])/10||0));p.kick=!!i[2];}else{p.ix=p.iy=0;p.kick=false;}}else aiThink(p);}
}
function integrate(live,after=false){
  // Haxball sırası: 1) girdi + şut  2) hareket + sürtünme  3) çarpışmalar (önce top)
  const b=G.ball,ps=G.players;
  for(const p of ps){
    if(live){
      const a=p.kick?PH.pak:PH.pa;p.vx+=p.ix*a;p.vy+=p.iy*a;
      if(p.kick&&p.armed&&!after){
        const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy);
        if(d>0&&d-p.r-b.r<4&&!(PH.one&&G.lastKicker===p&&G.t1===p)){b.vx+=dx/d*PH.kick*b.im;b.vy+=dy/d*PH.kick*b.im;p.armed=false;G.kickoff=false;sKick(1);G.kseq++;touch(p);G.lastKicker=p;}
      }
    }
    if(!p.kick)p.armed=true;
  }
  for(const p of ps){p.x+=p.vx;p.y+=p.vy;p.vx*=PH.pd;p.vy*=PH.pd;}
  b.x+=b.vx;b.y+=b.vy;const bd=after?0.86:PH.bd;b.vx*=bd;b.vy*=bd;if(after&&Math.hypot(b.vx,b.vy)<0.05)b.vx=b.vy=0;
  // sekme katsayısı iki cismin katsayılarının çarpımı: oyuncu 0.5 × top 0.5 = 0.25
  if(!after)for(const p of ps){if(collide(p,b,0.25)){G.kickoff=false;touch(p);}}
  for(const q of posts){if(collide(q,b,0.25))sKick(0.4);}
  ballWalls(b);
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)collide(ps[i],ps[j],0.25);
  for(const q of posts)for(const p of ps)collide(q,p,0.25);
  for(const p of ps){
    const mx=BX-PR,my=BY-PR;
    if(Math.abs(p.x)>mx){p.x=Math.sign(p.x)*mx;p.vx=0;}if(Math.abs(p.y)>my){p.y=Math.sign(p.y)*my;p.vy=0;}
    if(G.kickoff&&G.state==='play'){
      const s=p.team===0?-1:1;if(p.x*s<p.r-1){p.x=s*(p.r-1);p.vx=0;}
      if(p.team!==G.kickTeam){const d=Math.hypot(p.x,p.y);if(d<KR+p.r){p.x=p.x/d*(KR+p.r);p.y=p.y/d*(KR+p.r);}}
    }
  }
}
function goal(team){
  G.score[team]++;G.state='goal';G.stateT=110;G.kickTeam=G.training?0:1-team;G.gseq++;G.lastGoal=team;
  const sc=G.t1,as=G.t2;G.gi=G.ai=-1;
  if(sc&&sc.team===team){sc.g=(sc.g||0)+1;G.gi=G.players.indexOf(sc);if(as&&as.team===team&&as!==sc){as.a=(as.a||0)+1;G.ai=G.players.indexOf(as);}}
  startCel(G.players[G.gi],team);
  goalBanner((G.training||G.myTeam<0||team===G.myTeam)?'GOL!':'GOL YEDİK',G.gi,G.ai,sc&&sc.team!==team?G.players.indexOf(sc):-1);
  sCrowd();renderHud();repGoal(team,G.gi,G.ai,sc&&sc.team!==team?G.players.indexOf(sc):-1);
  if(G.golden||(G.goalLimit&&G.score[team]>=G.goalLimit)){G.over=true;}
}
// ---------- Gol sevinçleri (premium efektler) ----------
const CELS={none:'Yok',confetti:'Konfeti',fireworks:'Havai fişek',fire:'Ateş izi',banner:'Altın pankart'};
function cleanCel(c){return typeof c==='string'&&CELS[c]&&c!=='none'?c:'';}
const CEL_IMG={};const celImg=k=>{if(!CEL_IMG[k]){const im=new Image();im.src='assets/cel-'+k+'.webp';CEL_IMG[k]=im;}return CEL_IMG[k];};
const imgOk=im=>im&&im.complete&&im.naturalWidth>0;
let CELFX=[];
function preloadCels(){if(!G)return;const need=new Set(G.players.map(p=>p.cel).filter(Boolean));
  if(need.has('confetti'))celImg('confetti');if(need.has('fireworks')){celImg('firework');celImg('sparks');}if(need.has('fire')){celImg('flame');celImg('sparks');}if(need.has('banner'))celImg('banner');}
function startCel(p,team){
  if(!p||!p.cel||!G)return;if(window.__celLog)window.__celLog.push(p.name+":"+p.cel);const t0=performance.now(),k=p.cel,kit=G.kits[p.team]||{p:'#fff',s:'#fff'};
  if(k==='confetti'){const parts=[];for(let i=0;i<90;i++){const a=Math.random()*Math.PI*2,v=2+Math.random()*6;parts.push({x:p.x,y:p.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,f:i%10,r:Math.random()*6.28,vr:(Math.random()-.5)*0.4,s:9+Math.random()*7,ph:Math.random()*6.28});}
    CELFX.push({k,t0,dur:3200,parts});}
  else if(k==='fireworks'){const sx=team===0?1:-1,bursts=[];for(let i=0;i<6;i++)bursts.push({x:sx*(FW*(0.55+Math.random()*0.35)),y:(Math.random()*2-1)*FH*0.75,d:i*240+Math.random()*120,s:FH*(0.9+Math.random()*0.5),rot:Math.random()*6.28,hue:i});
    CELFX.push({k,t0,dur:2600,bursts});}
  else if(k==='fire'){CELFX.push({k,t0,dur:3500,p,parts:[]});}
  else if(k==='banner'){CELFX.push({k,t0,dur:2800,name:p.name,num:p.avatar,col:kit.p});}
}
const TINTS=[null,'#ff6a4a','#59c3ff','#8cff7a','#ff7ad9'];
function drawCel(layer){
  if(!CELFX.length)return;const now=performance.now();
  CELFX=CELFX.filter(fx=>now-fx.t0<fx.dur);
  for(const fx of CELFX){const t=(now-fx.t0)/1000,life=(now-fx.t0)/fx.dur;
    if(fx.k==='fire'&&layer==='under'){const p=fx.p,fl=celImg('flame'),sp=celImg('sparks');
      if(life<0.85)for(let i=0;i<2;i++)fx.parts.push({x:p.x+(Math.random()-.5)*p.r*1.2,y:p.y+(Math.random()-.5)*p.r*1.2,vx:(Math.random()-.5)*0.6,vy:(Math.random()-.5)*0.6,b:now,sz:p.r*(1.6+Math.random()*0.8),sp:Math.random()<0.25,f:Math.floor(Math.random()*10),rot:Math.random()*6.28});
      fx.parts=fx.parts.filter(q=>now-q.b<650);ctx.save();ctx.globalCompositeOperation='lighter';
      for(const q of fx.parts){const a=1-(now-q.b)/650;q.x+=q.vx;q.y+=q.vy;const sz=q.sz*(q.sp?0.5:0.4+a*0.6);ctx.globalAlpha=a*(q.sp?1:0.85);
        if(q.sp&&imgOk(sp)){ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot);ctx.drawImage(sp,q.f*64,0,64,64,-sz/2,-sz/2,sz,sz);ctx.restore();}
        else if(imgOk(fl))ctx.drawImage(fl,q.x-sz/2,q.y-sz*0.62,sz,sz);
        else{ctx.fillStyle='rgba(255,140,40,.6)';ctx.beginPath();ctx.arc(q.x,q.y,sz*0.3,0,Math.PI*2);ctx.fill();}}
      ctx.restore();}
    if(layer!=='over')continue;
    if(fx.k==='confetti'){const im=celImg('confetti');const fade=life>0.75?1-(life-0.75)/0.25:1;ctx.save();ctx.globalAlpha=fade;
      for(const q of fx.parts){q.vx*=0.95;q.vy*=0.95;q.x+=q.vx+Math.sin(t*3+q.ph)*0.25;q.y+=q.vy+0.25;q.r+=q.vr;const sq=Math.abs(Math.cos(t*4+q.ph));
        ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.r);ctx.scale(1,0.35+0.65*sq);
        if(imgOk(im))ctx.drawImage(im,q.f*72,0,72,72,-q.s/2,-q.s/2,q.s,q.s);else{ctx.fillStyle=['#e33','#fd3','#39f','#f6c','#fff'][q.f%5];ctx.fillRect(-q.s/3,-q.s/5,q.s*0.66,q.s*0.4);}
        ctx.restore();}
      ctx.restore();}
    else if(fx.k==='fireworks'){const im=celImg('firework');ctx.save();ctx.globalCompositeOperation='lighter';
      for(const b of fx.bursts){const e=(now-fx.t0-b.d)/1000;if(e<0||e>1.3)continue;const grow=1-Math.pow(1-Math.min(1,e/0.45),3),a=e<0.45?1:Math.max(0,1-(e-0.45)/0.85),sz=b.s*(0.25+0.75*grow);
        ctx.globalAlpha=a;ctx.save();ctx.translate(b.x,b.y+e*12);ctx.rotate(b.rot);
        if(imgOk(im))ctx.drawImage(im,-sz/2,-sz/2,sz,sz);else{ctx.strokeStyle='#ffd27a';ctx.beginPath();ctx.arc(0,0,sz/2,0,Math.PI*2);ctx.stroke();}
        const tint=TINTS[b.hue%TINTS.length];if(tint){ctx.globalCompositeOperation='source-atop';}
        ctx.restore();
        if(tint&&e<0.9){const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,sz*0.5);g.addColorStop(0,tint+'66');g.addColorStop(1,tint+'00');ctx.fillStyle=g;ctx.globalAlpha=a*0.9;ctx.beginPath();ctx.arc(b.x,b.y,sz*0.5,0,Math.PI*2);ctx.fill();}
        if(e<0.12){ctx.globalAlpha=(0.12-e)/0.12*0.5;ctx.fillStyle='#fff6dc';ctx.beginPath();ctx.arc(b.x,b.y,sz*0.18,0,Math.PI*2);ctx.fill();}}
      ctx.restore();}
    else if(fx.k==='banner'){const im=celImg('banner');ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
      const W=Math.min(innerWidth*0.62,620),H=W*282/900,cx=innerWidth/2,cy=innerHeight*0.7;
      const pop=t<0.35?1-Math.pow(1-t/0.35,3)*1:1,sc=t<0.35?0.4+0.75*pop-(t>0.25?0.15*(t-0.25)/0.1:0):1,a=life>0.82?1-(life-0.82)/0.18:Math.min(1,t/0.15);
      ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.scale(sc,sc);
      if(imgOk(im))ctx.drawImage(im,-W/2,-H/2,W,H);else{ctx.fillStyle='#d9a93a';ctx.fillRect(-W*0.35,-H*0.2,W*0.7,H*0.4);}
      ctx.textAlign='center';ctx.textBaseline='middle';const fs=Math.round(H*0.22);
      ctx.font=`800 ${fs}px "Saira Condensed",Impact,sans-serif`;const txt=(fx.num?fx.num+' · ':'')+String(fx.name||'').toLocaleUpperCase('tr-TR');
      ctx.fillStyle='rgba(60,35,0,.55)';ctx.fillText(txt,2,-H*0.035+2);ctx.fillStyle='#fffbea';ctx.fillText(txt,0,-H*0.035);
      // parıltı
      const sh=((t*0.9)%1.4)-0.2;ctx.globalCompositeOperation='lighter';const g=ctx.createLinearGradient(-W*0.3+sh*W*0.6-40,0,-W*0.3+sh*W*0.6+40,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,250,220,.35)');g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g;ctx.fillRect(-W*0.33,-H*0.22,W*0.66,H*0.36);ctx.restore();}
  }
}
function goalBanner(txt,gi,ai,og=-1){
  const bn=$('banner');bn.textContent=txt;const P=G.players;let sub='';
  if(P[gi]&&P[gi].cel==='banner')sub='';else if(P[gi])sub=P[gi].name+(P[ai]?' · asist '+P[ai].name:'');else if(P[og])sub='Kendi kalesine: '+P[og].name;
  if(sub){const s=document.createElement('span');s.className='bsub';s.textContent=sub;bn.appendChild(s);}
  bn.classList.add('on');
}
function renderEndStats(){
  const box=$('endStats');box.innerHTML='';if(!G||G.training)return;
  const rows=G.players.filter(p=>p.human||(p.g||0)+(p.a||0)>0).sort((x,y)=>(y.g||0)-(x.g||0)||(y.a||0)-(x.a||0));
  for(const p of rows){const d=document.createElement('div');const n=nickEl(p.tag,p.name+(p.human?'':' (bot)'),p.local?'var(--flood)':p.nameColor,'span');
    const e=document.createElement('em');e.textContent=`${p.g||0} gol · ${p.a||0} asist`;d.append(n,e);box.appendChild(d);}
}
async function recordMyMatch(){
  if(!G||!G.net||G.recorded)return;const me=G.players.find(p=>p.local);if(!me)return;
  const humans=G.players.filter(p=>p.human).length;if(humans<2)return; // tek başına botlara karşı maçlar sayılmaz
  if(!G.mid)return;G.recorded=true;
  if(PH.mode!=='normal'){const el=document.createElement('div');el.className='rdelta';el.textContent=`${MODES[PH.mode].i} ${MODES[PH.mode].n} modu eğlence maçıdır; beceri puanı ve istatistiklere sayılmaz.`;$('endStats').before(el);return;}
  if(G.anomFlag){const el=document.createElement('div');el.className='rdelta dn';el.textContent='Bu maçta şüpheli hareket tespit edildiği için sonucu onaylamadın; oyuncuların çoğunluğu da onaylamazsa maç sayılmaz.';$('endStats').before(el);return;}
  const before=MYR.r,wasPl=MYR.g<5,mid=G.mid;
  const show=st=>{if(!st)return;document.querySelectorAll('#endOv .rdelta').forEach(e=>e.remove());const el=document.createElement('div');
    if(st.mismatch){el.className='rdelta dn';el.textContent='Bildirdiğin skor diğer oyuncularınkiyle uyuşmadı; bu maç sana sayılmadı.';}
    else if(st.applied&&typeof st.rating==='number'){const d=st.delta|0;MYR.r=st.rating;MYR.g++;el.className='rdelta '+(d>=0?'up':'dn');
      el.append(document.createTextNode(`Beceri puanı ${d>=0?'+':''}${d} → ${st.rating} `),rankEl(st.rating,MYR.g));
      if(MYR.g<5)el.append(document.createTextNode(` · yerleşmeye ${5-MYR.g} maç`));else if(wasPl)el.append(document.createTextNode(' · lige yerleştin!'));pushLobby();if(NET.room)pushRoom();afterApplied(mid);}
    else{el.className='rdelta';el.textContent='Skor diğer oyuncuların onayını bekliyor…';}
    $('endStats').before(el);};
  let st=null;
  try{st=await DB.reportResult(mid,me.team,G.score[0],G.score[1],me.g||0,me.a||0,humans,G.mapKey||'classic');G.reported=true;renderMvp();show(st);}catch(e){console.warn('sonuç bildirilemedi',e);return;}
  for(let k=0;k<6&&st&&!st.applied&&!st.mismatch;k++){await new Promise(r=>setTimeout(r,2500));try{st=await DB.resultStatus(mid);if(st&&(st.applied||st.mismatch))show(st);}catch(e){}}
}
function endMatch(){
  G.state='over';$('banner').classList.remove('on');
  if(G.net){netHostPublish();showEnd();return;}
  adAfterMatch();
  const [a,c]=G.score;
  $('endScore').textContent=`${a} – ${c}`;
  $('endLbl').textContent=`${G.kits[0].abbr||'SEN'} · ${G.kits[1].abbr}`;
  $('endMsg').textContent=a>c?'Kazandın. Bir zorluk seviyesi yukarı çıkmayı dene.':a<c?'Bu sefer olmadı. Rövanşta görüşürüz.':'Berabere.';
  renderEndStats();renderEndGoals();$('endOv').hidden=false;
}
function renderHud(){
  if(!G)return;
  const m=Math.floor(G.clock/60),s=Math.floor(G.clock%60);
  const k=G.kits;
  if(G.drill){$('hud').innerHTML=drillHud();return;}
  if(G.training){$('hud').innerHTML=`<span class="kit" style="background:${k[0].p}"></span>ANTRENMAN · GOL ${G.score[0]}<span class="clock">${G.score[1]?'KENDİ KALENE '+G.score[1]:'∞'}</span>`;return;}
  const sn=G.net?specCount():0;
  $('hud').innerHTML=`<span class="kit" style="background:${k[0].p}"></span>${esc(k[0].abbr||'SEN')} ${G.score[0]} – ${G.score[1]} ${esc(k[1].abbr)}<span class="kit" style="background:${k[1].p}"></span><span class="clock">${G.golden?'ALTIN GOL':m+':'+String(s).padStart(2,'0')}</span>${sn?`<span class="specn" title="İzleyici">👁 ${sn}</span>`:''}${G.net&&G.net.role==='client'&&NET.ping?`<span class="ping ${pingCls(NET.ping)}" title="Oda sahibine gecikme">${NET.ping} ms</span>`:''}`;
  $('specBadge').hidden=!(G.net&&G.myTeam<0);
}

// ---------- Çizim ----------
const cv=$('cv'),ctx=cv.getContext('2d');let scale=1,dpr=1;
function resize(){dpr=Math.min(devicePixelRatio||1,2,Math.sqrt(3.4e6/Math.max(1,innerWidth*innerHeight)));cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;scale=Math.min(innerWidth/(2*VW),(innerHeight-40)/(2*VH));}
addEventListener('resize',()=>{if(G)resize();});
// ---------- Saha görünümleri (premium) ----------
const SKINS={classic:{name:'Klasik',price:''},night:{name:'Gece Işıkları',price:'19,90 TL'},beach:{name:'Plaj',price:'19,90 TL'},snow:{name:'Kar Fırtınası',price:'34,90 TL'},rain:{name:'Sağanak',price:'34,90 TL'},drizzle:{name:'Çisenti',price:'34,90 TL'},sakura:{name:'Kiraz Bahçesi',price:'34,90 TL'}};
const curSkin=()=>{const s=(G&&G.skin)||prof.skin;return SKINS[s]?s:'classic';};
const SKIN_PAL={classic:{bg:'#163019',out:'#2f6630',a:'#3d7c39',b:'#43853f',line:'rgba(243,241,232,.85)'},
  night:{bg:'#050d07',out:'#0b1f10',a:'#143a1a',b:'#18421e',line:'rgba(243,241,232,.72)'},
  snow:{bg:'#5f7f97',out:'#8fa9bd',a:'#2f7a34',b:'#37853b',line:'rgba(255,255,255,.95)'},
  rain:{bg:'#030706',out:'#0a170d',a:'#12321a',b:'#163b1e',line:'rgba(215,228,222,.62)'},
  drizzle:{bg:'#030706',out:'#0a170d',a:'#12321a',b:'#163b1e',line:'rgba(215,228,222,.66)'},
  beach:{bg:'#0e5a78',out:'#d8bd80',a:'#e4cc93',b:'#ebd6a2',line:'rgba(255,255,255,.92)'},
  sakura:{bg:'#24361f',out:'#36522c',a:'#3b6a31',b:'#417336',line:'rgba(240,238,228,.78)'}};
const hash=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};
// görsel tabanlı sahalar: çizgileri silinmiş resim, saha dikdörtgeni oyundaki sahaya oturtulur; çizgi ve kaleyi oyun çizer
const SKIN_IMG={sakura:{src:'assets/pitch-sakura.webp',L:400/2576,R:2173/2576,T:206/1438,B:1237/1438},
  snow:{src:'assets/pitch-snow.webp',L:102/1024,R:921/1024,T:54/572,B:530/572},
  rain:{src:'assets/pitch-rain.webp',L:96/1024,R:928/1024,T:33/572,B:540/572}};
SKIN_IMG.drizzle=SKIN_IMG.rain;
// HD görseller yalnızca o saha seçilince indirilir
function skinImg(k){const SI=SKIN_IMG[k];if(!SI)return null;if(!SI.img){const im=new Image();im.decoding='async';im.src=SI.src;SI.img=im;}return SI.img;}
// ---------- Kamera (1-7 tuşları / telefonda kamera düğmesi) ----------
const CAMS={1:'Tüm saha',2:'Top takibi',3:'Oyuncu takibi',4:'Yakın plan',5:'Akıllı kamera',6:'Yayın kamerası',7:'Sinematik'};
const CAM={x:0,y:0,z:1,vx:0,vy:0,mode:0};
const camMode=()=>CAMS[prof.cam]?Number(prof.cam):1;
function camUpdate(){
  if(!G){CAM.x=CAM.y=0;CAM.z=1;return;}
  const m=camMode(),b=G.ball,me=G.players.find(p=>p.local&&p.team>=0)||null,tgt=me||b;
  const bvx=(b.x-(CAM.bx??b.x)),bvy=(b.y-(CAM.by??b.y));CAM.bx=b.x;CAM.by=b.y;
  CAM.vx=CAM.vx*0.9+bvx*0.1;CAM.vy=CAM.vy*0.9+bvy*0.1; // topun yumuşatılmış hızı
  let tx=0,ty=0,tz=1,ease=0.14;
  if(m===2){tx=b.x;ty=b.y;tz=1.3;}
  else if(m===3){tx=tgt.x;ty=tgt.y;tz=1.3;}
  else if(m===4){tx=tgt.x;ty=tgt.y;tz=1.75;}
  else if(m===5){ // oyuncu ve topu birlikte kadraja alır, aralarındaki mesafeye göre yakınlaşır
    tx=tgt.x*0.45+b.x*0.55;ty=tgt.y*0.45+b.y*0.55;
    const dx=Math.abs(tgt.x-b.x)+140,dy=Math.abs(tgt.y-b.y)+110;
    tz=Math.max(1,Math.min(2,Math.min(VW/dx,VH/dy)));ease=0.08;}
  else if(m===6){ // yayın: yatay kaydırma, topun gidişine göre önden bakar
    tx=b.x+CAM.vx*26;ty=b.y*0.3;tz=1.4;ease=0.06;}
  else if(m===7){ // sinematik: kaleye yaklaştıkça yakınlaşır, orta sahada uzaklaşır
    const gd=Math.max(0,1-Math.abs(FW-Math.abs(b.x))/(FW*0.55));
    tx=b.x+CAM.vx*18+Math.sign(b.x)*gd*40;ty=b.y*(0.5+0.4*gd);tz=1.2+0.85*gd*gd;ease=0.045;}
  if(CAM.mode!==m){CAM.mode=m;}
  CAM.z+=(tz-CAM.z)*Math.min(1,ease*0.9);
  // görüş alanını sahanın dışına taşırma
  const hw=innerWidth/(2*scale*CAM.z),hh=(innerHeight-24)/(2*scale*CAM.z);
  const lx=Math.max(0,VW+30-hw),ly=Math.max(0,VH+30-hh);
  tx=Math.max(-lx,Math.min(lx,tx));ty=Math.max(-ly,Math.min(ly,ty));
  CAM.x+=(tx-CAM.x)*ease;CAM.y+=(ty-CAM.y)*ease;
}
// yakın kameralarda kendi oyuncun ekran dışındaysa kenarda yönünü gösteren ok
function drawOffMe(){
  const me=G&&G.players.find(p=>p.local&&p.team>=0);if(!me||CAM.z<1.05)return;
  const z=scale*dpr*CAM.z,sx=cv.width/2+(me.x-CAM.x)*z,sy=cv.height/2+16*dpr+(me.y-CAM.y)*z,m=34*dpr;
  if(sx>m&&sx<cv.width-m&&sy>m+40*dpr&&sy<cv.height-m)return;
  const cx=Math.max(m,Math.min(cv.width-m,sx)),cy=Math.max(m+40*dpr,Math.min(cv.height-m,sy)),a=Math.atan2(sy-cy,sx-cx);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.translate(cx,cy);
  const kit=G.kits[me.team]||{p:'#fff'};ctx.fillStyle=kit.p;ctx.strokeStyle='#fff';ctx.lineWidth=2*dpr;
  ctx.beginPath();ctx.arc(0,0,11*dpr,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.rotate(a);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(19*dpr,0);ctx.lineTo(12*dpr,-6*dpr);ctx.lineTo(12*dpr,6*dpr);ctx.fill();
  ctx.restore();
}
function setCam(m){if(!CAMS[m])return;prof.cam=m;save();const t=$('camToast');if(t){t.textContent=m+' · '+CAMS[m];t.classList.remove('on');void t.offsetWidth;t.classList.add('on');}const bt=$('camBtn');if(bt)bt.textContent='🎥 '+m;}
addEventListener('keydown',e=>{if(isTyping(e)||!G||$('game').hidden)return;const m=/^(Digit|Numpad)([1-7])$/.exec(e.code);if(m){e.preventDefault();setCam(Number(m[2]));}});
function drawField(){
  const sk=curSkin(),P=SKIN_PAL[sk];
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=P.bg;ctx.fillRect(0,0,cv.width,cv.height);
  camUpdate();const z=scale*dpr*CAM.z;
  ctx.setTransform(z,0,0,z,cv.width/2-CAM.x*z,cv.height/2+16*dpr-CAM.y*z);
  const SI=SKIN_IMG[sk];
  const SIm=SI&&skinImg(sk);
  if(SIm&&SIm.complete&&SIm.naturalWidth){const w=2*FW/(SI.R-SI.L),h=2*FH/(SI.B-SI.T);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(SIm,-FW-SI.L*w,-FH-SI.T*h,w,h);return P.line;}
  if(sk==='beach'){ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=6;ctx.strokeRect(-VW-4,-VH-4,2*VW+8,2*VH+8);}
  ctx.fillStyle=P.out;ctx.fillRect(-VW,-VH,2*VW,2*VH);
  const sw=2*FW/10;for(let i=0;i<10;i++){ctx.fillStyle=i%2?P.a:P.b;ctx.fillRect(-FW+i*sw,-FH,sw,2*FH);}
  if(sk==='beach'){for(let i=0;i<120;i++){ctx.fillStyle='rgba(150,110,50,.12)';ctx.beginPath();ctx.arc(-FW+hash(i)*2*FW,-FH+hash(i+50)*2*FH,1.5+hash(i+9)*2,0,Math.PI*2);ctx.fill();}}
  if(sk==='snow'){ // çimde hafif beyazlıklar; çizgiler temiz kalır
    for(let i=0;i<18;i++){ctx.fillStyle='rgba(240,246,250,'+(0.07+hash(i+200)*0.08)+')';ctx.beginPath();ctx.ellipse(-FW*0.85+hash(i+300)*1.7*FW,-FH*0.8+hash(i+400)*1.6*FH,10+hash(i+500)*18,5+hash(i+600)*8,hash(i+700)*3,0,Math.PI*2);ctx.fill();}}
  if(sk==='rain'){ // ıslak zemin: ışık vuran su birikintileri
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<16;i++){const x=-FW*0.85+hash(i+800)*1.7*FW,y=-FH*0.85+hash(i+900)*1.7*FH,r=14+hash(i+950)*30,near=Math.min(1,(Math.abs(x)/FW+Math.abs(y)/FH)/1.4),
      g=ctx.createRadialGradient(x-r*0.2,y-r*0.15,0,x,y,r);g.addColorStop(0,`rgba(190,220,225,${0.05+near*0.16})`);g.addColorStop(0.6,`rgba(120,160,165,${0.03+near*0.06})`);g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,r,r*0.62,hash(i+990)*3,0,Math.PI*2);ctx.fill();}
    ctx.restore();}
  if(sk==='night'){ // saha kenarında projektör direkleri
    const poles=[[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1]];
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const [px,py] of poles){const lx=px*(FW+20),ly=py*(FH+16),R=px?440:300,gr=ctx.createRadialGradient(lx,ly,0,lx,ly,R);gr.addColorStop(0,'rgba(255,244,214,.34)');gr.addColorStop(.5,'rgba(140,170,140,.08)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(-VW,-VH,2*VW,2*VH);}
    ctx.restore();
    for(const [px,py] of poles){const lx=px*(FW+20),ly=py*(FH+16);ctx.fillStyle='#1c2420';ctx.beginPath();ctx.arc(lx,ly,7,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.translate(lx,ly);ctx.rotate(Math.atan2(-ly,-lx));ctx.fillStyle='#2b332e';ctx.fillRect(2,-9,8,18);ctx.fillStyle='#fff6da';ctx.shadowColor='#fff3c4';ctx.shadowBlur=14;ctx.fillRect(9,-7,3,14);ctx.restore();}}
  if(sk==='snow')drawSnowBanks();
  if(sk==='sakura')drawSakura();
  if(sk==='rain'){ctx.save();ctx.globalCompositeOperation='lighter';
    for(const [px,py] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const lx=px*(VW+30),ly=py*(VH+30),gr=ctx.createRadialGradient(lx,ly,0,lx,ly,FW*0.75);gr.addColorStop(0,'rgba(210,235,240,.42)');gr.addColorStop(.35,'rgba(150,190,200,.13)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(-VW,-VH,2*VW,2*VH);}
    ctx.restore();}
  return P.line;
}
// kiraz bahçesi: çakıl yollar, taşlar, bank, köşelerde çiçek açmış ağaçlar, yerde yapraklar
function drawSakura(){
  const ox=VW-FW,oy=VH-FH;
  // çimde güneş huzmesi ve hafif doku
  ctx.save();ctx.globalCompositeOperation='lighter';
  const g=ctx.createLinearGradient(-FW*0.9,-FH,-FW*0.1,FH*0.4);g.addColorStop(0,'rgba(255,240,190,.10)');g.addColorStop(.5,'rgba(255,240,190,.05)');g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-FW*0.95,-VH);ctx.lineTo(-FW*0.55,-VH);ctx.lineTo(-FW*0.05,FH*0.5);ctx.lineTo(-FW*0.45,FH*0.5);ctx.fill();ctx.restore();
  // kalelerin arkasında çakıl yol
  ctx.fillStyle='#7d8178';for(const sx of[-1,1]){ctx.fillRect(sx>0?FW+GD:-VW,-GH-14,ox-GD,2*GH+28);}
  ctx.fillStyle='rgba(255,255,255,.12)';for(let i=0;i<60;i++){const sx=i%2?1:-1;ctx.fillRect(sx*(FW+GD+hash(i)*(ox-GD))-1,-GH-12+hash(i+70)*(2*GH+24),2,2);}
  // yosunlu taşlar ve taş fenerler kenarlarda
  for(let i=0;i<10;i++){const sx=i%2?1:-1,y=(hash(i+120)*2-1)*(FH-20);if(Math.abs(y)<GH+30)continue;const x=sx*(FW+ox*0.55);
    ctx.fillStyle='#5f625c';ctx.beginPath();ctx.ellipse(x,y,9+hash(i+130)*6,7+hash(i+140)*4,hash(i)*3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#5b7f3a';ctx.beginPath();ctx.ellipse(x-2,y-2,6,4,0,0,Math.PI*2);ctx.fill();}
  for(const [x,y] of [[-FW*0.25,-(FH+oy*0.55)],[FW*0.3,FH+oy*0.55]]){ctx.fillStyle='#6d5038';ctx.fillRect(x-22,y-5,44,10);ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(x-22,y+3,44,2);}
  for(const [x,y] of [[-FW*0.55,-(FH+oy*0.5)],[FW*0.6,FH+oy*0.5],[-(FW+ox*0.5),FH*0.62],[FW+ox*0.5,-FH*0.62]]){ctx.fillStyle='#8d918a';ctx.fillRect(x-7,y-7,14,14);ctx.fillStyle='#5d615a';ctx.fillRect(x-4,y-4,8,8);ctx.fillStyle='rgba(255,220,150,.5)';ctx.fillRect(x-1.5,y-1.5,3,3);}
  // yere düşmüş yapraklar
  for(let i=0;i<Math.round(FW*FH/600);i++){const x=(hash(i+3000)*2-1)*VW,y=(hash(i+3100)*2-1)*VH;ctx.fillStyle=hash(i+3200)<0.25?'rgba(255,245,248,.7)':'rgba(240,170,196,.65)';
    ctx.beginPath();ctx.ellipse(x,y,1.9,1.1,hash(i+3300)*3,0,Math.PI*2);ctx.fill();}
  // ağaçlar: önce gölge, sonra taç
  const trees=[[-1,-1,1],[1,-1,1],[-1,1,1],[1,1,1],[-0.42,-1,0.8],[0.5,-1,0.75],[-0.5,1,0.75],[0.42,1,0.8]].map(([px,py,k],i)=>{
    const corner=Math.abs(px)===1,r=(corner?Math.max(62,FW*0.15):Math.max(40,FW*0.1))*k;return {x:corner?px*(VW-ox*0.3):px*FW,y:corner?py*(VH-oy*0.2):py*(VH+r*0.25),r,i,white:i%3===1};});
  for(const t of trees){const gr=ctx.createRadialGradient(t.x+t.r*0.25,t.y+t.r*0.3,t.r*0.2,t.x+t.r*0.25,t.y+t.r*0.3,t.r*1.25);gr.addColorStop(0,'rgba(0,10,0,.32)');gr.addColorStop(1,'rgba(0,10,0,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(t.x+t.r*0.25,t.y+t.r*0.3,t.r*1.25,0,Math.PI*2);ctx.fill();}
  for(const t of trees){const base=t.white?['#d9c7cd','#eadde1','#f7f0f2','#ffffff']:['#c86a8e','#df86a8','#ee9fbd','#f6b9cf','#fbd3e1'];
    // dallar
    ctx.strokeStyle='#4a3326';ctx.lineCap='round';
    for(let k=0;k<6;k++){const a=hash(t.i*30+k+900)*Math.PI*2;ctx.lineWidth=t.r*0.06;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(t.x+Math.cos(a)*t.r*0.8,t.y+Math.sin(a)*t.r*0.8);ctx.stroke();}
    // katman katman çiçek kümeleri: koyudan açığa
    for(let layer=0;layer<base.length;layer++){ctx.fillStyle=base[layer];const n=60-layer*8,sh=layer*0.06;
      for(let k=0;k<n;k++){const id=t.i*1000+layer*100+k,a=hash(id)*Math.PI*2,d=Math.sqrt(hash(id+37))*t.r*(1-layer*0.1),rr=t.r*(0.07+hash(id+71)*0.08);
        ctx.beginPath();ctx.arc(t.x+Math.cos(a)*d-t.r*sh,t.y+Math.sin(a)*d-t.r*sh,rr,0,Math.PI*2);ctx.fill();}}
  }
}
// saha çizgilerinin dışında kar yığınları, köşelerde daha fazla; bir kardan adam
function drawSnowBanks(){
  const ox=VW-FW,oy=VH-FH,blob=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  ctx.fillStyle='#c9d8e3';
  let i=0;
  for(let x=-VW;x<=VW;x+=13){i++;const r=oy*0.45+hash(i)*oy*0.35;blob(x,-VH+r*0.3,r+2);blob(x,VH-r*0.3,r+2);}
  for(let y=-VH;y<=VH;y+=13){i++;if(Math.abs(y)<GH+26)continue;const r=ox*0.32+hash(i)*ox*0.22;blob(-VW+r*0.4,y,r+2);blob(VW-r*0.4,y,r+2);}
  ctx.fillStyle='#f4f8fb';i=0;
  for(let x=-VW;x<=VW;x+=13){i++;const r=oy*0.45+hash(i)*oy*0.35;blob(x,-VH+r*0.3,r);blob(x,VH-r*0.3,r);}
  for(let y=-VH;y<=VH;y+=13){i++;if(Math.abs(y)<GH+26)continue;const r=ox*0.32+hash(i)*ox*0.22;blob(-VW+r*0.4,y,r);blob(VW-r*0.4,y,r);}
  for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]])for(let k=0;k<5;k++)blob(sx*(VW-6-hash(k+40)*18),sy*(VH-6-hash(k+50)*14),12+hash(k+60)*10);
  // kardan adam (sol alt köşe, saha dışı)
  const x=-FW-ox*0.5,y=FH-24;
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(x+3,y+14,13,5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffffff';ctx.strokeStyle='#b7c6d1';ctx.lineWidth=1;
  for(const [dy,r] of [[6,11],[-9,8]]){ctx.beginPath();ctx.arc(x,y+dy,r,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.fillStyle='#b73a2e';ctx.fillRect(x-7,y-3,14,3);ctx.fillRect(x+3,y-3,3,8);
  ctx.fillStyle='#2b3d66';ctx.beginPath();ctx.arc(x,y-14,6,Math.PI,0);ctx.fill();ctx.fillRect(x-7,y-14,14,2);
  ctx.fillStyle='#222';ctx.fillRect(x-3,y-11,1.6,1.6);ctx.fillRect(x+1.5,y-11,1.6,1.6);ctx.fillRect(x-0.8,y+3,1.6,1.6);ctx.fillRect(x-0.8,y+7,1.6,1.6);
  ctx.fillStyle='#ee7a1f';ctx.beginPath();ctx.moveTo(x,y-9);ctx.lineTo(x+6,y-8);ctx.lineTo(x,y-7);ctx.fill();
  ctx.strokeStyle='#5a3b22';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-8,y+3);ctx.lineTo(x-15,y-2);ctx.moveTo(x+8,y+3);ctx.lineTo(x+15,y-3);ctx.stroke();
}
let flakes=null,drops=null,splashes=[],wxKey='',bolt={next:0,t:-1,seq:[]};
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function sThunder(delay){if(!ac)return;const lv=ambLevel();if(!lv)return;const t=ac.currentTime+delay,len=2.8,buf=ac.createBuffer(1,ac.sampleRate*len,ac.sampleRate),d=buf.getChannelData(0);let last=0;
  for(let i=0;i<d.length;i++){last=(last+0.02*(Math.random()*2-1))/1.02;d[i]=last*3.5;}
  const s=ac.createBufferSource();s.buffer=buf;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=160;const g=ac.createGain();
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.55*Math.min(1.6,lv),t+0.12);g.gain.exponentialRampToValueAtTime(0.001,t+len);s.connect(f).connect(g).connect(ac.destination);s.start(t);}
function drawWeather(){
  const sk=curSkin(),key=sk+VW+'x'+VH;
  if(wxKey!==key){wxKey=key;flakes=drops=null;splashes=[];bolt.next=performance.now()+6000+Math.random()*6000;bolt.t=-1;}
  const t=performance.now()/1000;
  if(sk==='snow'){
    if(!flakes)flakes=Array.from({length:Math.round(VW*VH/1300)},(_,i)=>({x:(hash(i)*2-1)*VW,y:(hash(i+1000)*2-1)*VH,r:0.8+hash(i+2000)*2.2,s:0.22+hash(i+3000)*0.55,ph:hash(i+4000)*6.28}));
    ctx.fillStyle='rgba(255,255,255,.85)';
    for(const f of flakes){f.y+=f.s;f.x+=0.12+Math.sin(t*0.9+f.ph)*0.45;if(f.y>VH+10){f.y=-VH-10;f.x=(Math.random()*2-1)*VW;}if(f.x>VW+10)f.x=-VW-10;if(f.x<-VW-10)f.x=VW+10;
      ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();}
    return;}
  if(sk==='sakura'){
    if(!flakes)flakes=Array.from({length:Math.round(VW*VH/2600)},(_,i)=>({x:(hash(i)*2-1)*VW,y:(hash(i+1000)*2-1)*VH,s:0.35+hash(i+3000)*0.55,ph:hash(i+4000)*6.28,sz:2.2+hash(i+5000)*2.4,w:hash(i+6000)<0.25,k:0.2+hash(i+7000)*1.4,sp:0}));
    // ara ara rüzgâr: bazı yapraklar savrulur, döner
    const gc=t%9,gust=gc<3?Math.sin(gc/3*Math.PI)**2:0;
    for(const f of flakes){f.y+=f.s*(1-gust*0.3*f.k);f.x+=0.35+Math.sin(t*1.1+f.ph)*0.5+gust*f.k*3.2;f.y+=gust*f.k*Math.sin(t*3+f.ph)*0.9;f.sp+=0.02+gust*f.k*0.12;
      if(f.y>VH+10){f.y=-VH-10;f.x=(Math.random()*2-1)*VW;}if(f.x>VW+10){f.x=-VW-10;f.y=(Math.random()*2-1)*VH;}
      const rot=t*1.6+f.ph+f.sp,sq=Math.abs(Math.cos(t*2.2+f.ph+f.sp*1.5));
      ctx.fillStyle='rgba(0,0,0,.12)';ctx.beginPath();ctx.ellipse(f.x+5,f.y+6,f.sz,f.sz*0.55*sq+0.3,rot,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=f.w?'rgba(255,246,249,.95)':'rgba(248,170,198,.95)';ctx.beginPath();ctx.ellipse(f.x,f.y,f.sz,f.sz*0.55*sq+0.3,rot,0,Math.PI*2);ctx.fill();}
    return;}
  if(sk!=='rain'&&sk!=='drizzle')return;
  const heavy=sk==='rain';
  if(!drops)drops=Array.from({length:Math.round(VW*VH/(heavy?430:1300))},(_,i)=>heavy?{x:(hash(i)*2-1)*VW,y:(hash(i+1000)*2-1)*VH,l:10+hash(i+2000)*16,s:10+hash(i+3000)*8,a:0.24+hash(i+4000)*0.36}
    :{x:(hash(i)*2-1)*VW,y:(hash(i+1000)*2-1)*VH,l:3+hash(i+2000)*5,s:4+hash(i+3000)*3,a:0.14+hash(i+4000)*0.22});
  ctx.lineWidth=1;ctx.lineCap='round';
  for(const d of drops){d.y+=d.s;d.x+=d.s*0.12;if(d.y>VH+20){d.y=-VH-20-Math.random()*40;d.x=(Math.random()*2.2-1.1)*VW;}
    ctx.strokeStyle=`rgba(205,225,240,${d.a})`;ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-d.l*0.12,d.y-d.l);ctx.stroke();}
  // yere düşen damlaların halkaları
  for(let k=0;k<(heavy?4:(Math.random()<0.5?1:0));k++)splashes.push({x:(Math.random()*2-1)*FW,y:(Math.random()*2-1)*FH,t:0});
  ctx.lineWidth=0.8;
  splashes=splashes.filter(p=>{p.t++;const r=1+p.t*0.45,a=0.32*(1-p.t/22);if(a<=0)return false;ctx.strokeStyle=`rgba(210,232,240,${a})`;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*0.55,0,0,Math.PI*2);ctx.stroke();return true;});
  // şimşek: arada bir ekran hafifçe aydınlanır
  const now=performance.now();
  if(heavy&&now>bolt.next&&bolt.t<0){bolt.t=now;bolt.seq=[[0,1],[90,0.35],[160,0.8]];bolt.next=now+9000+Math.random()*14000;sThunder(0.4+Math.random()*0.9);}
  if(bolt.t>=0){const dt=now-bolt.t;let a=0;for(const [st,amp] of bolt.seq){const e=dt-st;if(e>=0)a=Math.max(a,amp*Math.exp(-e/(st?140:90)));}
    if(dt>1400)bolt.t=-1;
    a*=reduceMotion?0.12:0.32;
    if(a>0.01){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=`rgba(225,235,255,${a})`;ctx.fillRect(0,0,cv.width,cv.height);ctx.restore();}}
}
// ---------- Görünüm: top desenleri, iz efektleri, emojiler, arma ----------
const BALLS={classic:'Klasik',football:'Futbol topu',gold:'Altın',neon:'Neon',fire:'Ateş',beach:'Plaj topu',galaxy:'Galaksi'};
const TRAILS={none:'Yok',sparks:'Kıvılcım',smoke:'Duman',rainbow:'Gökkuşağı',comet:'Kuyruklu yıldız',stars:'Yıldız tozu'};
const LOCKS={trail:{stars:5},ball:{galaxy:15}};let QSTARS=0;
const EMOTES=['😂','😎','🔥','👏','😡','😭','🤝','⚽'];
const cleanTrail=t=>TRAILS[t]?t:'none';
const isEmote=t=>EMOTES.includes(t);
const BTRAIL=[];
function drawBall(c,x,y,r,skin,live){
  skin=BALLS[skin]?skin:'classic';
  if(live&&(skin==='fire'||skin==='neon')){BTRAIL.push([x,y]);if(BTRAIL.length>14)BTRAIL.shift();
    for(let i=0;i<BTRAIL.length-1;i++){const [tx,ty]=BTRAIL[i],k=i/BTRAIL.length;c.globalAlpha=k*0.55;c.fillStyle=skin==='fire'?`hsl(${20+k*30},100%,${50+k*10}%)`:'#3ff';c.beginPath();c.arc(tx,ty,r*(0.4+k*0.6),0,Math.PI*2);c.fill();}c.globalAlpha=1;}
  c.save();
  if(skin==='neon'||skin==='fire'){c.shadowColor=skin==='neon'?'#3ff':'#ff7a1a';c.shadowBlur=r*1.6;}
  let fill='#fff';
  if(skin==='gold'){const g=c.createRadialGradient(x-r*.35,y-r*.35,r*.1,x,y,r);g.addColorStop(0,'#fff6c8');g.addColorStop(.45,'#f2c230');g.addColorStop(1,'#a8740a');fill=g;}
  else if(skin==='neon')fill='#c9ffff';
  else if(skin==='galaxy'){const g=c.createRadialGradient(x-r*.3,y-r*.3,r*.1,x,y,r);g.addColorStop(0,'#5a4fd6');g.addColorStop(.6,'#1b1660');g.addColorStop(1,'#07051f');fill=g;}
  else if(skin==='fire'){const g=c.createRadialGradient(x,y,r*.1,x,y,r);g.addColorStop(0,'#fff3b0');g.addColorStop(.5,'#ffb020');g.addColorStop(1,'#e8400c');fill=g;}
  c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.shadowBlur=0;
  if(skin==='football'){c.save();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();c.fillStyle='#111';
    const pent=(cx,cy,rr,rot)=>{c.beginPath();for(let i=0;i<5;i++){const a=rot+i*Math.PI*2/5;c.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}c.closePath();c.fill();};
    pent(x,y,r*.36,-Math.PI/2);for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;pent(x+Math.cos(a)*r*.95,y+Math.sin(a)*r*.95,r*.32,a+Math.PI);}c.restore();}
  if(skin==='beach'){const cols=['#e0483e','#f2c230','#2a62d6','#ffffff','#1f9d55','#ff7a1a'];for(let i=0;i<6;i++){c.fillStyle=cols[i];c.beginPath();c.moveTo(x,y);c.arc(x,y,r,i*Math.PI/3,(i+1)*Math.PI/3);c.closePath();c.fill();}
    c.fillStyle='#fff';c.beginPath();c.arc(x,y,r*.22,0,Math.PI*2);c.fill();}
  if(skin==='galaxy'){c.fillStyle='#fff';[[.3,-.2,.09],[-.35,.25,.07],[.05,.45,.06],[-.15,-.45,.05],[.5,.2,.05]].forEach(([a,b2,s2])=>{c.beginPath();c.arc(x+a*r,y+b2*r,r*s2,0,Math.PI*2);c.fill();});}
  if(skin==='gold'){c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.ellipse(x-r*.35,y-r*.4,r*.28,r*.14,-0.6,0,Math.PI*2);c.fill();}
  c.lineWidth=2;c.strokeStyle=skin==='neon'?'#0aa':'#000';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();
  c.restore();
}
function drawTrails(){
  const now=performance.now();
  for(const p of G.players){const t=p.trail;if(!t||t==='none')continue;
    p.trl=p.trl||[];const sp=Math.hypot(p.x-(p.lx??p.x),p.y-(p.ly??p.y));p.lx=p.x;p.ly=p.y;
    if(sp>0.6)p.trl.push({x:p.x,y:p.y,t:now,h:(now/6)%360});
    while(p.trl.length&&now-p.trl[0].t>(t==='smoke'?700:420))p.trl.shift();
    const L=p.trl.length;if(!L)continue;const life=t==='smoke'?700:420;
    if(t==='rainbow'||t==='comet'){ctx.lineCap='round';for(let i=1;i<L;i++){const a=p.trl[i-1],b=p.trl[i],k=1-(now-b.t)/life;
        ctx.strokeStyle=t==='rainbow'?`hsla(${b.h},90%,60%,${k*0.8})`:hexA(G.kits[p.team].p,k*0.7);ctx.lineWidth=p.r*1.1*k;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
    else for(let i=0;i<L;i+=t==='sparks'?1:2){const q=p.trl[i],k=1-(now-q.t)/life;
      if(t==='stars'){ctx.save();ctx.translate(q.x+((i*53)%13-6),q.y+((i*31)%11-5));ctx.rotate(i);ctx.fillStyle=`rgba(${200+((i*17)%55)},${220+((i*7)%35)},255,${k})`;const R=2+k*3;ctx.beginPath();for(let j=0;j<10;j++){const a=j*Math.PI/5,rr=j%2?R*.45:R;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.restore();}
      else if(t==='sparks'){ctx.fillStyle=`hsla(${40+((i*37)%30)},100%,${60+k*20}%,${k})`;const j=((i*73)%11-5)*1.2;ctx.beginPath();ctx.arc(q.x+j,q.y-j*0.7,1.5+k*2.5,0,Math.PI*2);ctx.fill();}
      else{ctx.fillStyle=`rgba(210,215,210,${k*0.28})`;ctx.beginPath();ctx.arc(q.x,q.y,p.r*(1.2-k*0.6),0,Math.PI*2);ctx.fill();}}
  }
}
function hexA(h,a){const n=parseInt(String(h).slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${Math.max(0,a)})`;}
function drawBadge(cv,kit){const c=cv.getContext('2d'),W=cv.width,H=cv.height,b=kit&&kit.badge;c.clearRect(0,0,W,H);
  if(!b){miniKit(cv,kit);return;}
  const x=W/2,y=H/2,r=Math.min(W,H)/2-2;c.save();c.beginPath();
  if(b.s==='shield'){c.moveTo(x-r*.85,y-r*.85);c.lineTo(x+r*.85,y-r*.85);c.lineTo(x+r*.85,y+r*.05);c.quadraticCurveTo(x+r*.8,y+r*.7,x,y+r);c.quadraticCurveTo(x-r*.8,y+r*.7,x-r*.85,y+r*.05);c.closePath();}
  else if(b.s==='hex'){for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3;c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}c.closePath();}
  else if(b.s==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.55:r;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();}
  else c.arc(x,y,r,0,Math.PI*2);
  c.fillStyle=kit.p;c.fill();c.lineWidth=Math.max(2,r*.12);c.strokeStyle=kit.s;c.stroke();
  c.font=`${Math.round(r*(b.s==='star'?0.8:1.05))}px system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(b.i,x,y+(b.s==='shield'?-r*.05:r*.04));c.restore();}
function badgeEl(kit,size=20){const cv=document.createElement('canvas');cv.width=size*2;cv.height=size*2;cv.style.cssText=`width:${size}px;height:${size}px;vertical-align:middle;margin-right:6px`;drawBadge(cv,cleanKit(kit||{}));return cv;}
function renderLooks(){
  const bx=$('ballChips');if(bx&&!bx.childElementCount)for(const [k,n] of Object.entries(BALLS)){const b=document.createElement('button');b.className='chip lookchip';b.dataset.v=k;const cv=document.createElement('canvas');cv.width=44;cv.height=44;
    const c=cv.getContext('2d');c.fillStyle='#2f6b34';c.fillRect(0,0,44,44);drawBall(c,22,22,13,k,false);b.append(cv,document.createTextNode(n+(LOCKS.ball[k]?` · ${LOCKS.ball[k]}★`:'')));b.onclick=()=>{if(LOCKS.ball[k]&&QSTARS<LOCKS.ball[k]){$('saveState').textContent=`${n} topu için ${LOCKS.ball[k]} görev yıldızı gerekiyor (sende ${QSTARS}).`;return;}prof.ball=k;save();renderLooks();};bx.appendChild(b);}
  const tx=$('trailChips');if(tx&&!tx.childElementCount)for(const [k,n] of Object.entries(TRAILS)){const b=document.createElement('button');b.className='chip';b.dataset.v=k;b.textContent=n+(LOCKS.trail[k]?` · ${LOCKS.trail[k]}★`:'');b.onclick=()=>{if(LOCKS.trail[k]&&QSTARS<LOCKS.trail[k]){$('saveState').textContent=`${n} izi için ${LOCKS.trail[k]} görev yıldızı gerekiyor (sende ${QSTARS}).`;return;}prof.trail=k;save();renderLooks();pushTag();};tx.appendChild(b);}
  bx&&bx.querySelectorAll('.chip').forEach(c=>{c.setAttribute('aria-pressed',String(c.dataset.v===(prof.ball||'classic')));c.classList.toggle('locked',!!LOCKS.ball[c.dataset.v]&&QSTARS<LOCKS.ball[c.dataset.v]);});
  tx&&tx.querySelectorAll('.chip').forEach(c=>c.classList.toggle('locked',!!LOCKS.trail[c.dataset.v]&&QSTARS<LOCKS.trail[c.dataset.v]));
  tx&&tx.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(c.dataset.v===(prof.trail||'none'))));
}
function badgePicker(kit,onPick){
  const w=document.createElement('div');w.className='bpick';const k={...kit};
  const prev=document.createElement('canvas');prev.width=112;prev.height=112;prev.style.cssText='width:56px;height:56px';
  const sh=document.createElement('div');sh.className='row';const ic=document.createElement('div');ic.className='row';
  const upd=()=>{drawBadge(prev,k);onPick({...k});sh.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String((k.badge?k.badge.s:'none')===c.dataset.v)));ic.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(!!k.badge&&k.badge.i===c.dataset.v)));};
  [['none','Arma yok'],['shield','Kalkan'],['circle','Yuvarlak'],['hex','Altıgen'],['star','Yıldız']].forEach(([v,l])=>{const b=document.createElement('button');b.type='button';b.className='chip';b.dataset.v=v;b.textContent=l;b.onclick=()=>{k.badge=v==='none'?undefined:{s:v,i:(k.badge&&k.badge.i)||'⚽'};upd();};sh.appendChild(b);});
  BADGE_IC.forEach(i=>{const b=document.createElement('button');b.type='button';b.className='chip';b.dataset.v=i;b.textContent=i;b.onclick=()=>{k.badge={s:(k.badge&&k.badge.s)||'shield',i};upd();};ic.appendChild(b);});
  const lb=document.createElement('div');lb.className='lbl';lb.textContent='Takım arması';
  w.append(lb,prev,sh,ic);setTimeout(upd);return w;
}

// ---------- Gol tekrarı ----------
// Son ~5 saniyeyi 30 karede bir kaydeder; her golde kısa bir klip saklanır.
const REC_HZ=30,REC_KEEP=REC_HZ*5,REC_TAIL=REC_HZ*1;
function recTick(t){
  if(!G||G.paused||G.state==='over'&&!G.pend)return;
  if(t-(G.recAt||0)<1000/REC_HZ-2)return;G.recAt=t;
  const f={p:G.players.map(p=>[Math.round(p.x),Math.round(p.y),p.kick?1:0]),b:[Math.round(G.ball.x),Math.round(G.ball.y)]};
  G.rec.push(f);if(G.rec.length>REC_KEEP)G.rec.shift();
  if(G.pend){G.pend.frames.push(f);if(--G.pend.tail<=0){G.goals.push(G.pend);G.pend=null;}}
}
function repGoal(team,gi,ai,og){
  if(!G)return;if(G.pend){G.goals.push(G.pend);G.pend=null;}
  const P=G.players;
  G.pend={team,gi,ai,og,score:[...G.score],scorer:P[gi]?P[gi].name:P[og]?P[og].name+' (k.k.)':'',assist:P[ai]?P[ai].name:'',frames:G.rec.slice(),cut:G.rec.length,tail:REC_TAIL};
  if(!G.training&&G.rec.length>20&&prof.pip!==false)G.pip={frames:G.rec.slice(-Math.round(REC_HZ*1.7)),t0:performance.now()+350};
}
function allGoals(){return G?[...G.goals,...(G.pend?[G.pend]:[])]:[];}
// klibin bir karesini verilen bölgeye çizer (ekran kordinatı)
function drawRepFrame(c,x0,y0,w,h,f,kits,plist,opt={}){
  const mx=FW+GD+14,my=FH+14;let sc=Math.min(w/(2*mx),h/(2*my)),cx=0,cy=0;
  if(opt.zoom&&opt.zoom>1){sc*=opt.zoom;const hx=mx-w/sc/2,hy=my-h/sc/2;cx=hx>0?Math.max(-hx,Math.min(hx,opt.cx||0)):0;cy=hy>0?Math.max(-hy,Math.min(hy,opt.cy||0)):0;}
  c.save();c.beginPath();c.rect(x0,y0,w,h);c.clip();
  c.fillStyle='#2f6b34';c.fillRect(x0,y0,w,h);
  c.translate(x0+w/2,y0+h/2);c.scale(sc,sc);c.translate(-cx,-cy);
  const sw=(2*FW)/10;for(let i=0;i<10;i+=2){c.fillStyle='rgba(255,255,255,.045)';c.fillRect(-FW+i*sw,-FH,sw,2*FH);}
  c.strokeStyle='rgba(243,241,232,.85)';c.lineWidth=3;c.strokeRect(-FW,-FH,2*FW,2*FH);
  c.beginPath();c.moveTo(0,-FH);c.lineTo(0,FH);c.stroke();c.beginPath();c.arc(0,0,KR,0,Math.PI*2);c.stroke();
  for(const s2 of[-1,1]){const a=s2*FW,b=s2*(FW+GD);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(Math.min(a,b),-GH,GD,2*GH);c.strokeStyle='#f3f1e8';c.beginPath();c.moveTo(a,-GH);c.lineTo(b,-GH);c.lineTo(b,GH);c.lineTo(a,GH);c.stroke();}
  for(const q of posts){c.fillStyle=kits[q.team].p;c.beginPath();c.arc(q.x,q.y,q.r,0,Math.PI*2);c.fill();c.lineWidth=2;c.strokeStyle='#000';c.stroke();}
  plist.forEach((p,i)=>{const v=f.p[i];if(!v)return;
    if(opt.hi===i){c.strokeStyle='rgba(242,194,48,.95)';c.lineWidth=3;c.beginPath();c.arc(v[0],v[1],p.r+7,0,Math.PI*2);c.stroke();}
    drawDisc(c,v[0],v[1],p.r,kits[p.team],p.avatar,{kick:!!v[2],name:opt.names?p.name:'',nameColor:p.nameColor,tag:opt.names?p.tag:''});});
  if(opt.trail){c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=3;c.beginPath();opt.trail.forEach((b,k)=>k?c.lineTo(b[0],b[1]):c.moveTo(b[0],b[1]));c.stroke();}
  drawBall(c,f.b[0],f.b[1],G.ball.r,prof.ball,false);
  c.restore();
}
function drawPip(){
  const P=G.pip;if(!P)return;const now=performance.now();if(now<P.t0)return;
  const n=P.frames.length,el=(now-P.t0)/1000*REC_HZ*0.7,i=Math.floor(el);
  if(i>=n+8){G.pip=null;return;}
  const f=P.frames[Math.min(n-1,i)];if(!f||!f.p){G.pip=null;return;}
  const w=Math.min(300,innerWidth*0.42),h=w*0.6,x=innerWidth-w-12,y=54;
  const a=Math.min(1,(now-P.t0)/200,(n+8-el)/6);
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=a;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(x-3,y-3,w+6,h+22);
  drawRepFrame(ctx,x,y,w,h,f,G.kits,G.players,{zoom:1.7,cx:f.b[0],cy:f.b[1],hi:-1});
  ctx.fillStyle='#f2c230';ctx.font='800 12px Inter,system-ui,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText('▶ TEKRAR · YAVAŞ ÇEKİM',x+4,y+h+9);
  ctx.restore();
}
function renderEndGoals(){
  const box=$('endGoals');if(!box)return;box.innerHTML='';const gs=allGoals().filter(g=>g.frames.length>10);
  if(!G||G.training||!gs.length){box.hidden=true;return;}box.hidden=false;
  const h=document.createElement('div');h.className='eglbl';h.textContent='Maçın golleri';box.appendChild(h);
  const row=document.createElement('div');row.className='egrow';
  gs.forEach((g,i)=>{const b=document.createElement('button');b.className='egbtn';b.style.setProperty('--k',G.kits[g.team].p);
    const sp=document.createElement('span');sp.textContent=`${g.score[0]}–${g.score[1]}`;const nm=document.createElement('small');nm.textContent=g.scorer||'Gol';
    b.append('▶ ',sp,nm);b.onclick=()=>openReplay(i);row.appendChild(b);});
  box.appendChild(row);
}
const RP={i:0,t:0,play:true,speed:1,last:0,raf:0,rec:null};
function openReplay(i){if(!G)return;const gs=allGoals().filter(g=>g.frames.length>10);if(!gs.length)return;RP.list=gs;RP.kits=G.kits;RP.pl=G.players.map(p=>({...p}));
  RP.i=(i+gs.length)%gs.length;RP.t=0;RP.play=true;$('repOv').hidden=false;repLabel();cancelAnimationFrame(RP.raf);RP.last=performance.now();RP.raf=requestAnimationFrame(repLoop);}
function repLabel(){const g=RP.list[RP.i];$('repLbl').textContent=`Gol ${RP.i+1}/${RP.list.length} · ${g.score[0]}–${g.score[1]}${g.scorer?' · '+g.scorer:''}${g.assist?' (asist '+g.assist+')':''}`;
  $('repSpeed').textContent=RP.speed===1?'1x':'0.5x';$('repPlay').textContent=RP.play?'❚❚':'▶';}
function repLoop(now){
  if($('repOv').hidden){RP.raf=0;return;}RP.raf=requestAnimationFrame(repLoop);
  const g=RP.list[RP.i],n=g.frames.length;const dt=Math.min(.1,(now-RP.last)/1000);RP.last=now;
  // gole yakın anlar otomatik yavaşlar
  const near=Math.abs(RP.t-g.cut)<REC_HZ*0.6?0.45:1;
  if(RP.play)RP.t+=dt*REC_HZ*RP.speed*near;
  if(RP.t>=n-1){if(RP.rec){RP.rec.stop();RP.rec=null;}RP.t=0;}
  const cv2=$('repCv'),c=cv2.getContext('2d');const W=cv2.clientWidth,H=cv2.clientHeight,d=Math.min(2,devicePixelRatio||1);
  if(cv2.width!==Math.round(W*d)||cv2.height!==Math.round(H*d)){cv2.width=Math.round(W*d);cv2.height=Math.round(H*d);}
  c.setTransform(d,0,0,d,0,0);
  const i0=Math.floor(RP.t),fr=RP.t-i0,a=g.frames[i0],b=g.frames[Math.min(n-1,i0+1)];if(!a||!b||!a.p)return;
  const f={p:a.p.map((v,k)=>{const w=b.p[k]||v;return [v[0]+(w[0]-v[0])*fr,v[1]+(w[1]-v[1])*fr,v[2]];}),b:[a.b[0]+(b.b[0]-a.b[0])*fr,a.b[1]+(b.b[1]-a.b[1])*fr]};
  const trail=g.frames.slice(Math.max(0,i0-24),i0+1).map(x=>x.b);
  const z=RP.zoom?1.8:1;
  drawRepFrame(c,0,0,W,H,f,RP.kits,RP.pl,{names:true,hi:g.gi,trail,zoom:z,cx:f.b[0],cy:f.b[1]});
  c.fillStyle='rgba(0,0,0,.4)';c.fillRect(0,H-4,W,4);c.fillStyle='#f2c230';c.fillRect(0,H-4,W*(RP.t/(n-1)),4);
  if(RP.t>g.cut-1){c.fillStyle='rgba(242,194,48,'+Math.max(0,0.9-(RP.t-g.cut)/REC_HZ)+')';c.font='900 '+Math.round(H*0.16)+'px "Saira Condensed",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('GOL!',W/2,H/2);}
  if(RP.rec){c.fillStyle='#e0483e';c.beginPath();c.arc(14,14,6,0,Math.PI*2);c.fill();}
}
function repSave(){
  const cv2=$('repCv');if(!cv2.captureStream||typeof MediaRecorder==='undefined'){$('repMsg').textContent='Bu tarayıcı video kaydını desteklemiyor.';return;}
  const types=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'];const type=types.find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))||'';
  try{const rec=new MediaRecorder(cv2.captureStream(30),type?{mimeType:type,videoBitsPerSecond:4e6}:undefined);const parts=[];
    rec.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data);};
    rec.onstop=async()=>{const blob=new Blob(parts,{type:rec.mimeType||'video/webm'});const ext=/mp4/.test(blob.type)?'mp4':'webm';
      const file=new File([blob],`zkpball-gol-${RP.i+1}.${ext}`,{type:blob.type});
      if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'Zkpball golü',text:'Şu gole bak! ⚽ zkpball.com'});$('repMsg').textContent='Paylaşıldı.';return;}catch(e){if(e&&e.name==='AbortError'){$('repMsg').textContent='';return;}}}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`zkpball-gol-${RP.i+1}.${ext}`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);$('repMsg').textContent='Video hazır.';};
    RP.t=0;RP.play=true;RP.speed=1;repLabel();rec.start();RP.rec=rec;$('repMsg').textContent='Kaydediliyor… klip bitince iner.';}catch(e){$('repMsg').textContent='Video kaydedilemedi.';}
}
$('repClose').onclick=()=>{if(RP.rec){try{RP.rec.stop();}catch(e){}RP.rec=null;}$('repOv').hidden=true;$('repMsg').textContent='';};
$('repPrev').onclick=()=>{RP.i=(RP.i-1+RP.list.length)%RP.list.length;RP.t=0;repLabel();};
$('repNext').onclick=()=>{RP.i=(RP.i+1)%RP.list.length;RP.t=0;repLabel();};
$('repPlay').onclick=()=>{RP.play=!RP.play;repLabel();};
$('repSpeed').onclick=()=>{RP.speed=RP.speed===1?0.5:1;repLabel();};
$('repZoom').onclick=()=>{RP.zoom=!RP.zoom;$('repZoom').setAttribute('aria-pressed',String(!!RP.zoom));};
$('repSave').onclick=repSave;try{if(navigator.canShare&&navigator.canShare({files:[new File([''],'a.mp4',{type:'video/mp4'})]}))$('repSave').textContent='Videoyu paylaş';}catch(e){}

function draw(){
  ctx.strokeStyle=drawField();ctx.lineWidth=3;
  ctx.strokeRect(-FW,-FH,2*FW,2*FH);
  ctx.beginPath();ctx.moveTo(0,-FH);ctx.lineTo(0,FH);ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,KR,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='rgba(243,241,232,.85)';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();
  // kaleler
  for(const s of[-1,1]){
    const x0=s*FW,x1=s*(FW+GD);
    ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(Math.min(x0,x1),-GH,GD,2*GH);
    ctx.strokeStyle='rgba(243,241,232,.25)';ctx.lineWidth=1;
    for(let y=-GH;y<=GH;y+=10){ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();}
    for(let k=0;k<=GD;k+=10){ctx.beginPath();ctx.moveTo(x0+s*k,-GH);ctx.lineTo(x0+s*k,GH);ctx.stroke();}
    ctx.strokeStyle='#f3f1e8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x0,-GH);ctx.lineTo(x1,-GH);ctx.lineTo(x1,GH);ctx.lineTo(x0,GH);ctx.stroke();
  }
  for(const q of posts){ctx.fillStyle=G.kits[q.team].p;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#000';ctx.stroke();}
  if(G.drill)drawDrill();
  drawTrails();
  drawCel('under');
  // oyuncular
  for(const p of G.players){
    if(PH.one&&(G.net&&G.net.role==='client'?G.lk===G.players.indexOf(p):G.lastKicker===p&&G.t1===p)){ctx.strokeStyle='rgba(230,70,70,.95)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.r+3,0,Math.PI*2);ctx.stroke();}
    if(p.local){ctx.strokeStyle='rgba(242,194,48,.9)';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(p.x,p.y,p.r+6,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    if(p.sr==='elmas'||p.sr==='usta')drawAura(p);
    drawDisc(ctx,p.x,p.y,p.r,G.kits[p.team],p.avatar,{kick:p.kick,name:p.name,nameColor:p.nameColor,tag:p.tag});
  }
  const b=G.ball;drawBall(ctx,b.x,b.y,b.r,prof.ball,true);
  drawWeather();
  drawCel('over');
  drawOffMe();
  drawBubbles();
  drawPip();
  if(G.paused&&G.net){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,0,innerWidth,innerHeight);ctx.fillStyle='#f2c230';ctx.font='800 42px "Saira Condensed",sans-serif';ctx.textAlign='center';ctx.fillText('DURAKLATILDI',innerWidth/2,innerHeight/2);}
  // joystick
  if(joy.id!==null){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(joy.ox,joy.oy,50,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.arc(joy.ox+joy.x*50,joy.oy+joy.y*50,22,0,Math.PI*2);ctx.fill();}
}

let last=performance.now(),acc=0;
// Oda sahibinin sekmesi arka plana geçince requestAnimationFrame durur; maç bir Worker zamanlayıcısıyla sürer.
let bgWorker=null;
function ensureBgTicker(){
  if(bgWorker)return;
  try{bgWorker=new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),16)'],{type:'text/javascript'})));
    bgWorker.onmessage=()=>{if(!document.hidden||!G||!G.net||G.net.role!=='host')return;
      const t=performance.now(),dt=Math.min(0.1,(t-last)/1000);last=t;
      if(!G.paused&&G.state!=='over'){acc+=dt;while(acc>=1/60){step();acc-=1/60;if(!G||G.state==='over')break;}}
      if(G)netHostPublish();};}catch(e){}
}
function loop(t){
  requestAnimationFrame(loop);
  if(!G){last=t;return;}
  const dt=Math.min(0.1,(t-last)/1000);last=t;
  if(G.net&&G.net.role==='client'){if(!$('game').hidden){clientFrame();if(G){recTick(t);draw();}}return;}
  const host=G.net&&G.net.role==='host';
  if($('game').hidden&&!host)return;
  if(!G.paused&&G.state!=='over'){acc+=dt;while(acc>=1/60){step();acc-=1/60;if(!G||G.state==='over')break;}}
  if(host&&G)netHostPublish();
  if(G)recTick(t);
  if(G&&!$('game').hidden)draw();
}
requestAnimationFrame(loop);

// ---------- Oyun düğmeleri ----------
function togglePause(){if(!G||G.state==='over')return;if(G.net&&G.net.role==='client'){$('resumeBtn').textContent='Oyuna dön';$('quitBtn').textContent='Oda ekranına git';$('pauseOv').hidden=!$('pauseOv').hidden;return;}G.paused=!G.paused;$('pauseOv').hidden=!G.paused;}
$('pauseBtn').onclick=togglePause;$('resumeBtn').onclick=()=>{if(G&&G.net&&G.net.role==='client'){$('pauseOv').hidden=true;return;}togglePause();};
$('specBack').onclick=()=>{NET.watch=false;show('roomScr');renderRoom();};
$('quitBtn').onclick=async()=>{if(G&&G.net){if(G.net.role==='host'&&inRankedMatch()){if(!confirmLeave())return;await penalizeLeave();}$('pauseOv').hidden=true;if(G&&G.net&&G.net.role==='host'){G.paused=false;hostBackToRoom();}else show('roomScr');return;}G=null;showMain('rooms');};
$('endMenu').onclick=()=>{clearRanked('end');if(G&&G.net){if(G.net.role==='host')hostBackToRoom();G=null;leaveRoom(false);return;}G=null;showMain('rooms');};
$('againBtn').onclick=()=>{if(G&&G.drill&&G.drill.kind==='tut'){G=null;showMain('rooms');$('quickBtn').click();return;}if(G&&G.drill){startDrill(G.drill.kind);return;}if(G&&G.net){if(G.net.role==='host')hostBackToRoom();else{G=null;show('roomScr');}return;}startMatch(G?G.opt:{});};
$('playBtn').onclick=()=>startMatch({});
$('rotateOk').onclick=()=>{$('rotate').style.display='none';};
// ortam sesi: aç/kapa ve ses yüksekliği (yağmurlu sahalarda görünür)
function syncAmbUI(){const b=$('ambBtn');if(!b)return;b.hidden=!hasAmb();const on=prof.ambOn!==false&&Number(prof.amb??60)>0;b.textContent=on?'🔊 Ortam':'🔇 Ortam';
  $('ambOn').checked=prof.ambOn!==false;$('ambVol').value=prof.amb??60;$('ambVolTxt').textContent='%'+($('ambVol').value);}
$('ambBtn').onclick=()=>{$('ambPanel').hidden=!$('ambPanel').hidden;syncAmbUI();};
$('ambOn').onchange=e=>{prof.ambOn=e.target.checked;save();syncAmbUI();ambTick();};
$('ambVol').onchange=e=>e.target.blur();
$('ambVol').oninput=e=>{prof.amb=Number(e.target.value);if(prof.amb>0&&prof.ambOn===false)prof.ambOn=true;save();syncAmbUI();ambTick();};
setInterval(()=>{const b=$('ambBtn');if(b&&b.hidden===hasAmb())syncAmbUI();if(!hasAmb())$('ambPanel').hidden=true;},500);
$('camBtn').onclick=()=>setCam(camMode()%7+1);$('camBtn').textContent='🎥 '+camMode();
$('fsBtn').onclick=async()=>{try{if(!document.fullscreenElement){await document.documentElement.requestFullscreen();try{await screen.orientation.lock('landscape');}catch(e){}}else await document.exitFullscreen();}catch(e){$('fsBtn').textContent='Tam ekran yok';}};


// =====================================================================
// ---------- Arka uç: Supabase (canlı) ya da yerel deneme ----------
// =====================================================================
const LIVE=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey);
const TAB=Math.random().toString(36).slice(2,10);
let sb=null,uid=null,isAnon=true,userEmail='';
const cleanStr=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,n);
const cleanCol=c=>/^#[0-9a-f]{6}$/i.test(c)?c:'#ffffff';
const cleanKit=k=>{const o={p:cleanCol(k&&k.p),s:cleanCol(k&&k.s),pat:PATTERNS.some(x=>x[0]===(k&&k.pat))?k.pat:'solid'};const b=k&&k.badge;if(b&&BADGE_SH.includes(b.s)&&BADGE_IC.includes(b.i))o.badge={s:b.s,i:b.i};return o;};
const BADGE_SH=['shield','circle','hex','star'],BADGE_IC=['⚽','🦅','🐺','🦁','⚡','🔥','👑','⭐','🐉','🌙','⚓','🗡️'];

// ---------- Alan adı taşıma: eski adres oyuncuyu hesabıyla birlikte zkpball.com'a gönderir ----------
const NEW_HOME='https://zkpball.com',OLD_HOSTS=['xzuzu22.github.io'],MOVE_LIVE=true;
(function moveHome(){if(!MOVE_LIVE||!OLD_HOSTS.includes(location.hostname))return;
  let tok='',pj='';try{const k=Object.keys(localStorage).find(x=>/^sb-.*-auth-token$/.test(x));const v=k&&JSON.parse(localStorage.getItem(k));tok=v&&v.refresh_token||'';}catch(e){}
  try{const p=localStorage.getItem('uzk-profile');if(p&&p.length<1500)pj=btoa(unescape(encodeURIComponent(p))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}catch(e){}
  location.replace(NEW_HOME+'/'+(location.search||'')+(tok&&/^[A-Za-z0-9_\-.]+$/.test(tok)?'#mig='+tok+(pj?'&p='+pj:''):''));})();
async function backendInit(){
  if(LIVE){
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb=createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{realtime:{params:{eventsPerSecond:40}}});
    // eski adresten (xzuzu22.github.io) taşınan oyuncu: hesabını yeni adreste sürdür
    const mg=/^#mig=([A-Za-z0-9_\-.]+)(?:&p=([A-Za-z0-9_\-]+))?/.exec(location.hash);
    if(mg){history.replaceState(null,'',location.pathname+location.search);
      try{if(mg[2]){const pj=JSON.parse(decodeURIComponent(escape(atob(mg[2].replace(/-/g,'+').replace(/_/g,'/')))));if(pj&&typeof pj==="object"){Object.assign(prof,pj);save();}}}catch(e){}
      try{const r=await sb.auth.refreshSession({refresh_token:mg[1]});if(r.error)console.warn('taşıma oturumu açılamadı',r.error.message);}catch(e){}}
    let {data:{session}}=await sb.auth.getSession();
    if(!session){const r=await sb.auth.signInAnonymously();if(r.error)throw r.error;session=r.data.session;}
    uid=session.user.id;isAnon=!!session.user.is_anonymous;userEmail=session.user.email||'';
  } else {
    try{uid=localStorage.getItem('uzk-uid'+SLOT);}catch(e){}
    if(!uid){uid='u'+Math.random().toString(36).slice(2,10);try{localStorage.setItem('uzk-uid'+SLOT,uid);}catch(e){}}
  }
}
async function googleSignIn(){
  if(!LIVE){alertMsg('Google girişi canlı sitede çalışır.');return;}
  const opts={provider:'google',options:{redirectTo:location.origin+location.pathname}};
  const r=isAnon&&uid?await sb.auth.linkIdentity(opts):await sb.auth.signInWithOAuth(opts);
  if(r.error)alertMsg(/provider is not enabled|Unsupported provider|not enabled/i.test(r.error.message)?'Google girişi henüz açılmadı. Şimdilik nick ile devam et.':'Google bağlantısı başarısız: '+r.error.message);
}
function alertMsg(t){const el=curTab&&!$('main').hidden?$('netMsg'):$('gateMsg');if(el)el.textContent=t;}

// ---------- Veritabanı (profil, takım, lig) ----------
const MOCKDB={load(){try{return JSON.parse(localStorage.getItem('uzk-db')||'')||null;}catch(e){return null;}},
  get(){return this.load()||{profiles:{},teams:{},members:[]};},put(d){try{localStorage.setItem('uzk-db',JSON.stringify(d));}catch(e){}}};
const rcode=()=>Math.random().toString(36).slice(2,8);
const DB={
  async getProfile(){
    if(!LIVE){const d=MOCKDB.get();return d.profiles[uid]||null;}
    const {data,error}=await sb.from('profiles').select('nick,avatar,name_color,jersey_cards').eq('id',uid).maybeSingle();if(error)throw error;return data;},
  async useJerseyCard(n){
    if(!LIVE){const d=MOCKDB.get();const p=d.profiles[uid];const c=p.jersey_cards??1;if(c<1)throw new Error('no jersey cards');p.avatar=n;p.jersey_cards=c-1;MOCKDB.put(d);return c-1;}
    const {data,error}=await sb.rpc('use_jersey_card',{p_num:n});if(error)throw error;return data;},
  async myItems(){
    if(!LIVE){const d=MOCKDB.get();return {items:(d.items||{})[uid]||[],premium_until:null};}
    const {data,error}=await sb.rpc('my_items');if(error)throw error;return data||{};},
  async redeemCode(c){
    if(!LIVE){const d=MOCKDB.get();const r=(d.codes||[]).find(x=>x.code===c);if(!r||r.used)throw new Error('invalid code');if(r.exp<Date.now())throw new Error('code expired');r.used=uid;r.used_at=Date.now();
      d.items=d.items||{};const L=d.items[uid]=d.items[uid]||[];const add=i=>{if(!L.includes(i))L.push(i);};const p=d.profiles[uid];
      if(r.item==='jersey_card'||r.item==='starter'){p.jersey_cards=(p.jersey_cards??1)+(r.item==='starter'?2:1);if(r.item==='starter')add('name_color');}
      else if(r.item==='skins_all')['skin_night','skin_beach','skin_snow','skin_rain','skin_drizzle','skin_sakura'].forEach(add);
      else if(r.item==='team_premium'){const t=Object.values(d.teams).find(t=>t.owner===uid);if(!t)throw new Error('not captain');t.premium=true;}
      else add(r.item);MOCKDB.put(d);return {item:r.item};}
    const {data,error}=await sb.rpc('redeem_code',{p_code:c});if(error)throw error;return data;},
  async buyJerseyCard(){
    if(!LIVE){const d=MOCKDB.get();const p=d.profiles[uid];const c=p.jersey_cards??1;if(c>=5)throw new Error('too many cards');p.jersey_cards=c+1;MOCKDB.put(d);return c+1;}
    const {data,error}=await sb.rpc('buy_jersey_card');if(error)throw error;return data;},
  async saveProfile(){
    const row={nick:cleanStr(prof.name,14)||'Oyuncu',avatar:cleanStr(prof.avatar,2)||'10',name_color:cleanCol(prof.nameColor)};
    if(!LIVE){const d=MOCKDB.get();const o=d.profiles[uid];d.profiles[uid]=o?{...o,...row,avatar:o.avatar,jersey_cards:o.jersey_cards??1}:{...row,jersey_cards:1};MOCKDB.put(d);return;}
    const {error}=await sb.from('profiles').upsert({id:uid,...row,updated_at:new Date().toISOString()});if(error)throw error;},
  async myTeam(){
    if(!LIVE){const d=MOCKDB.get();const m=d.members.find(m=>m.user_id===uid);return m?{role:m.role,team:d.teams[m.team_id]}:null;}
    const {data,error}=await sb.from('team_members').select('role,teams(id,name,abbr,kit,tier,points,played,won,drawn,lost,gf,ga,owner,xp,premium)').eq('user_id',uid).maybeSingle();
    if(error)throw error;return data&&data.teams?{role:data.role,team:data.teams}:null;},
  async teams(){
    if(!LIVE){return Object.values(MOCKDB.get().teams);}
    const {data,error}=await sb.from('teams').select('id,name,abbr,kit,tier,points,played,won,drawn,lost,gf,ga,xp').order('tier').order('points',{ascending:false}).limit(600);if(error)throw error;return data;},
  async leagueTick(){
    if(!LIVE)return null;
    const {data,error}=await sb.rpc('league_tick');if(error)throw error;return data;},
  async leagueInfo(teamId){
    if(!LIVE){const d=MOCKDB.get();return {titles:d.titles||[],hist:(d.lhist||[]).filter(h=>h.team_id===teamId)};}
    const [a,b]=await Promise.all([sb.from('team_titles').select('team_id,season,tier').limit(1000),
      teamId?sb.from('league_history').select('*').eq('team_id',teamId).order('season',{ascending:false}).limit(1):Promise.resolve({data:[]})]);
    if(a.error)throw a.error;return {titles:a.data||[],hist:b.data||[]};},
  async members(teamId){
    if(!LIVE){const d=MOCKDB.get();return d.members.filter(m=>m.team_id===teamId).map(m=>({...m,...(d.profiles[m.user_id]||{nick:'?'})}));}
    const {data,error}=await sb.from('team_members').select('user_id,role,joined_at').eq('team_id',teamId).order('joined_at');if(error)throw error;
    const ids=data.map(m=>m.user_id);let ps=[];if(ids.length){const r=await sb.from('profiles').select('id,nick,avatar,name_color').in('id',ids);ps=r.data||[];}
    return data.map(m=>({...m,...(ps.find(p=>p.id===m.user_id)||{nick:'?'})}));},
  async createTeam(name,abbr,kit){
    if(!LIVE){const d=MOCKDB.get();if(d.members.some(m=>m.user_id===uid))throw new Error('Zaten bir takımdasın.');
      if(Object.values(d.teams).some(t=>t.name.toLowerCase()===name.toLowerCase()))throw new Error('Bu isimde bir takım var.');
      const id='t'+rcode();d.teams[id]={id,name,abbr,kit,tier:6,points:0,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,owner:uid,join_code:rcode()};
      d.members.push({team_id:id,user_id:uid,role:'kaptan',joined_at:Date.now()});MOCKDB.put(d);return id;}
    const {data,error}=await sb.rpc('create_team',{p_name:name,p_abbr:abbr,p_kit:kit});if(error)throw error;return data;},
  async joinTeam(code){
    if(!LIVE){const d=MOCKDB.get();const t=Object.values(d.teams).find(t=>t.join_code===code);if(!t)throw new Error('Bu kodla bir takım yok.');
      if(d.members.some(m=>m.user_id===uid))throw new Error('Zaten bir takımdasın.');d.members.push({team_id:t.id,user_id:uid,role:'oyuncu',joined_at:Date.now()});MOCKDB.put(d);return t.id;}
    const {data,error}=await sb.rpc('join_team',{p_code:code});if(error)throw error;return data;},
  async leaveTeam(){
    if(!LIVE){const d=MOCKDB.get();const m=d.members.find(m=>m.user_id===uid);if(!m)return;d.members=d.members.filter(x=>x!==m);
      const rest=d.members.filter(x=>x.team_id===m.team_id);if(!rest.length)delete d.teams[m.team_id];else if(m.role==='kaptan'){rest[0].role='kaptan';d.teams[m.team_id].owner=rest[0].user_id;}MOCKDB.put(d);return;}
    const {error}=await sb.rpc('leave_team');if(error)throw error;},
  async kick(teamId,userId){
    if(!LIVE){const d=MOCKDB.get();d.members=d.members.filter(m=>!(m.team_id===teamId&&m.user_id===userId));MOCKDB.put(d);return;}
    const {error}=await sb.from('team_members').delete().eq('team_id',teamId).eq('user_id',userId);if(error)throw error;},
  async teamCode(teamId){
    if(!LIVE){return MOCKDB.get().teams[teamId]?.join_code||'';}
    const {data,error}=await sb.rpc('team_code',{p_team:teamId});if(error)throw error;return data;},
  async reportResult(mid,team,red,blue,goals,assists,humans,map){
    if(!LIVE){const gf=team?blue:red,ga=team?red:blue;await this.recordMatch(goals,assists,gf,ga,map);const before=((MOCKDB.get().ratings||{})[uid]||{rating:1000}).rating;const nr=await this.recordRating(1000,1000,gf,ga);return {final:true,applied:true,delta:nr-before,rating:nr};}
    const {data,error}=await sb.rpc('report_result',{p_mid:mid,p_team:team,p_red:red,p_blue:blue,p_goals:goals,p_assists:assists,p_humans:humans,p_map:map});if(error)throw error;return data;},
  async resultStatus(mid){
    if(!LIVE)return null;
    const {data,error}=await sb.rpc('result_status',{p_mid:mid});if(error)throw error;return data;},
  async recordMatch(goals,assists,gf,ga,map){
    if(!LIVE){const d=MOCKDB.get();(d.matches=d.matches||[]).push({user_id:uid,played_at:new Date().toISOString(),goals,assists,gf,ga,result:gf>ga?'W':gf===ga?'D':'L',map});MOCKDB.put(d);return;}
    const {error}=await sb.rpc('record_match',{p_goals:goals,p_assists:assists,p_gf:gf,p_ga:ga,p_map:map});if(error)throw error;},
  async playerSummary(u){
    if(!LIVE){const d=MOCKDB.get();const ms=(d.matches||[]).filter(m=>m.user_id===u).reverse();
      return {played:ms.length,goals:ms.reduce((s,m)=>s+m.goals,0),assists:ms.reduce((s,m)=>s+m.assists,0),won:ms.filter(m=>m.result==='W').length,rating:((d.ratings||{})[u]||{}).rating,rgames:((d.ratings||{})[u]||{}).games,last:ms.slice(0,10)};}
    const {data,error}=await sb.rpc('player_summary',{p_user:u});if(error)throw error;return data;},
  async adminRpc(fn,args){
    if(!LIVE){const d=MOCKDB.get();d.admins=d.admins||[];
      if(fn==='is_admin')return d.admins.includes(uid);
      if(fn==='claim_admin'){if(args.p_code==='UZK-TEST'){d.admins.push(uid);MOCKDB.put(d);return true;}return false;}
      if(!d.admins.includes(uid))throw new Error('not admin');
      const nick=id=>(d.profiles[id]||{}).nick||'?';
      if(fn==='admin_make_code'){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';for(let i=0;i<6;i++)c+=A[Math.floor(Math.random()*32)];const t=Math.max(5,Math.min(300,args.p_ttl||15));(d.codes=d.codes||[]).push({code:c,item:args.p_item,exp:Date.now()+t*1000,at:Date.now()});MOCKDB.put(d);return {code:c,item:args.p_item,expires_at:new Date(Date.now()+t*1000).toISOString(),ttl:t};}
      if(fn==='admin_shop_codes')return (d.codes||[]).slice(-20).reverse().map(x=>({code:x.code,item:x.item,created_at:new Date(x.at).toISOString(),expires_at:new Date(x.exp).toISOString(),used_at:x.used_at?new Date(x.used_at).toISOString():null,used_nick:x.used?nick(x.used):null}));
      if(fn==='admin_overview'){const g={};(d.reports||[]).forEach(r=>{const x=g[r.target]=g[r.target]||{id:r.target,nick:nick(r.target),total:0,rs:new Set(),reasons:new Set(),contexts:[],last_at:new Date(r.at).toISOString()};x.total++;x.rs.add(r.reporter);x.reasons.add(r.reason);if(r.ctx)x.contexts.push(r.ctx);});
        return {reports:Object.values(g).map(x=>({...x,reporters:x.rs.size,reasons:[...x.reasons]})),leavers:(d.mockLeavers||[]),bans:(d.mockBans||[]),stats:{players:Object.keys(d.profiles).length,new24:2,matches24:(d.matches||[]).length,teams:Object.keys(d.teams).length}};}
      if(fn==='admin_search')return Object.entries(d.profiles).filter(([,p])=>(p.nick||'').toLowerCase().includes(String(args.p_q).toLowerCase())).map(([id,p])=>({id,nick:p.nick,avatar:p.avatar,rating:((d.ratings||{})[id]||{}).rating,reports:(d.reports||[]).filter(r=>r.target===id).length,leaves:0,banned_until:null}));
      if(fn==='admin_ban'){d.mockBans=(d.mockBans||[]).filter(b=>b.id!==args.p_user);d.mockBans.push({id:args.p_user,nick:nick(args.p_user),until:new Date(Date.now()+args.p_minutes*6e4).toISOString(),reason:args.p_reason});MOCKDB.put(d);return;}
      if(fn==='admin_unban'){d.mockBans=(d.mockBans||[]).filter(b=>b.id!==args.p_user);MOCKDB.put(d);return;}
      if(fn==='admin_bugs')return (d.bugs||[]).filter(b=>b.status===(args&&args.p_status||'open'));
      if(fn==='admin_bug_set'){(d.bugs||[]).forEach(b=>{if(b.id===args.p_id)b.status=args.p_status;});MOCKDB.put(d);return;}
      if(fn==='admin_usage'){const t=new Date();const day=i=>{const x=new Date(t);x.setDate(x.getDate()-i);return x.toISOString().slice(0,10);};
        return {today:day(0),wau:41,mau:96,dau:Array.from({length:30},(_,i)=>({day:day(29-i),users:Math.round(8+i*0.9+6*Math.sin(i/1.3)),new:Math.round(2+3*Math.abs(Math.sin(i))),matches:Math.round(14+i*1.4+9*Math.sin(i/1.7))})),
          hours:Array.from({length:24},(_,h)=>({h,avg:+(Math.max(0.3,9*Math.exp(-((h-21)**2)/10)+2*Math.exp(-((h-14)**2)/8))).toFixed(1),today:h<=t.getHours()?Math.round(Math.max(0,8*Math.exp(-((h-21)**2)/10))):0})),
          retention:Array.from({length:10},(_,i)=>({day:day(i+1),size:4+(i*3)%7,d1:Math.round((4+(i*3)%7)*0.45),d7:i>=7?Math.round((4+(i*3)%7)*0.2):0}))};}
      if(fn==='admin_dismiss'){d.reports=(d.reports||[]).filter(r=>r.target!==args.p_user);MOCKDB.put(d);return;}return;}
    const {data,error}=await sb.rpc(fn,args||{});if(error)throw error;return data;},
  async submitBug(body,ctx){
    if(!LIVE){const d=MOCKDB.get();d.bugs=d.bugs||[];d.bugs.unshift({id:d.bugs.length+1,user_id:uid,nick:prof.name,body,ctx,status:'open',created_at:new Date().toISOString()});MOCKDB.put(d);return d.bugs.length;}
    const {data,error}=await sb.rpc('submit_bug',{p_body:body,p_ctx:ctx});if(error)throw error;return data;},
  async pushKey(){if(!LIVE)return 'BJHK8caDR8Jdsc2ssY2gGrzC72WgdIfXC23Wx1eXdAnhvMHTVgUutKpY-YpTht4H2EeuKxYFZURNHyQGbSLuGgQ';const {data,error}=await sb.rpc('vapid_public_key');if(error)throw error;
    if(!data){await sb.functions.invoke('push-send',{body:{}}).catch(()=>{});const r=await sb.rpc('vapid_public_key');return r.data;}return data;},
  async savePush(sub,prefs){const j=sub.toJSON();if(!LIVE){localStorage.setItem('uzk-pushmock',JSON.stringify(prefs));return;}const {error}=await sb.rpc('save_push',{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_prefs:prefs});if(error)throw error;},
  async deletePush(ep){if(!LIVE)return;await sb.rpc('delete_push',{p_endpoint:ep});},
  async pushInvite(to,code,room){if(!LIVE)return;const {error}=await sb.rpc('push_invite',{p_to:to,p_code:code,p_room:room||''});if(!error)sb.functions.invoke('push-send',{body:{}}).catch(()=>{});},
  async playerExtra(u){if(!LIVE){const d=MOCKDB.get();return d.extra||{streak:0,today:false,freeze:true,mvp:0,promo:null,promo_evt:null,team_xp:null};}const {data,error}=await sb.rpc('player_extra',{p_user:u});if(error)throw error;return data||{};},
  async myRivals(){if(!LIVE)return MOCKDB.get().rivals||[];const {data,error}=await sb.rpc('my_rivals',{p_limit:8});if(error)throw error;return data||[];},
  async voteMvp(mid,t){if(!LIVE){const d=MOCKDB.get();d.mvp=d.mvp||{};d.mvp[mid]=d.mvp[mid]||{};d.mvp[mid][uid]=t;MOCKDB.put(d);const c={};Object.values(d.mvp[mid]).forEach(x=>c[x]=(c[x]||0)+1);return c;}
    const {data,error}=await sb.rpc('vote_mvp',{p_mid:mid,p_target:t});if(error)throw error;return data||{};},
  async mvpStatus(mid){if(!LIVE){const d=MOCKDB.get();const m=(d.mvp||{})[mid]||{};const c={};Object.values(m).forEach(x=>c[x]=(c[x]||0)+1);return {votes:c,mine:m[uid]||null};}
    const {data,error}=await sb.rpc('mvp_status',{p_mid:mid});if(error)throw error;return data||{votes:{}};},
  async submitDrill(k,v){if(!LIVE){const d=MOCKDB.get();d.dboard=d.dboard||{};const b=d.dboard[k]=d.dboard[k]||{};const lo=k==='slalom';if(b[uid]==null||(lo?v<b[uid].score:v>b[uid].score))b[uid]={nick:prof.name,score:v};MOCKDB.put(d);return this.drillBoard(k);}
    const {data,error}=await sb.rpc('submit_drill',{p_kind:k,p_score:v});if(error)throw error;return data;},
  async drillBoard(k){if(!LIVE){const d=MOCKDB.get();const b=(d.dboard||{})[k]||{};const lo=k==='slalom';const arr=Object.entries(b).map(([u,v])=>({...v,u})).sort((a,c)=>lo?a.score-c.score:c.score-a.score);
      const mi=arr.findIndex(x=>x.u===uid);return {count:arr.length,top:arr.slice(0,10).map((x,i)=>({nick:x.nick,score:x.score,pos:i+1,me:x.u===uid})),me:mi>=0?{score:arr[mi].score,pos:mi+1}:null,last:(d.dlast||{})[k]||null,titles:0};}
    const {data,error}=await sb.rpc('drill_board',{p_kind:k});if(error)throw error;return data;},
  async pingActive(){if(!LIVE)return;await sb.rpc('ping_active');},
  async questStatus(){
    if(!LIVE){const d=MOCKDB.get();const n=new Date(),day=n.toISOString().slice(0,10);const ms=(d.matches||[]).filter(m=>m.user_id===uid);const agg=a=>({played:a.length,goals:a.reduce((s,m)=>s+m.goals,0),assists:a.reduce((s,m)=>s+m.assists,0),won:a.filter(m=>m.result==='W').length});
      return {day,week:'W',d:agg(ms.filter(m=>m.played_at.slice(0,10)===day)),w:agg(ms),stars:d.qstars||0,claimed:d.qclaimed||[]};}
    const {data,error}=await sb.rpc('quest_status');if(error)throw error;return data;},
  async claimQuest(kind){
    if(!LIVE){const d=MOCKDB.get();const q=await this.questStatus();const per=(kind==='daily'?'d:'+q.day:'w:'+q.week);d.qclaimed=[...(d.qclaimed||[]),per];d.qstars=(d.qstars||0)+(kind==='daily'?1:3);MOCKDB.put(d);return d.qstars;}
    const {data,error}=await sb.rpc('claim_quest',{p_kind:kind});if(error)throw error;return data;},
  async friends(){
    if(!LIVE){const d=MOCKDB.get();return (d.friends||[]).filter(f=>f.a===uid||f.b===uid).map(f=>{const id=f.a===uid?f.b:f.a;const p=d.profiles[id]||{};return {id,status:f.status,incoming:f.status==='pending'&&f.requester!==uid,nick:p.nick,avatar:p.avatar,name_color:p.name_color};});}
    const {data,error}=await sb.rpc('my_friends');if(error)throw error;return data||[];},
  async friendReq(u){
    if(!LIVE){const d=MOCKDB.get();d.friends=d.friends||[];const f=d.friends.find(f=>(f.a===uid&&f.b===u)||(f.b===uid&&f.a===u));if(f){if(f.status==='pending'&&f.requester!==uid)f.status='accepted';MOCKDB.put(d);return f.status;}d.friends.push({a:uid,b:u,requester:uid,status:'pending'});MOCKDB.put(d);return 'pending';}
    const {data,error}=await sb.rpc('friend_request',{p_user:u});if(error)throw error;return data;},
  async friendRespond(u,ok){
    if(!LIVE){const d=MOCKDB.get();const f=(d.friends||[]).find(f=>(f.a===u&&f.b===uid)||(f.b===u&&f.a===uid));if(f){if(ok)f.status='accepted';else d.friends=d.friends.filter(x=>x!==f);}MOCKDB.put(d);return;}
    const {error}=await sb.rpc('friend_respond',{p_user:u,p_accept:ok});if(error)throw error;},
  async friendRemove(u){
    if(!LIVE){const d=MOCKDB.get();d.friends=(d.friends||[]).filter(f=>!((f.a===u&&f.b===uid)||(f.b===u&&f.a===uid)));MOCKDB.put(d);return;}
    const {error}=await sb.rpc('friend_remove',{p_user:u});if(error)throw error;},
  async leaderboard(){
    if(!LIVE){const d=MOCKDB.get();const rs=Object.entries(d.ratings||{}).filter(([,r])=>r.games>=5).sort((a,b)=>b[1].rating-a[1].rating);
      const top=rs.map(([id,r],i)=>({pos:i+1,id,rating:r.rating,games:r.games,nick:(d.profiles[id]||{}).nick,avatar:(d.profiles[id]||{}).avatar,name_color:(d.profiles[id]||{}).name_color,tag:(d.mockTags||{})[id]||null,best:(d.mockBest||{})[id]||null}));
      const me=top.find(x=>x.id===uid);const n=new Date();return {season:`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`,top:top.slice(0,50),me:me?{pos:me.pos,rating:me.rating}:null,total:top.length};}
    const {data,error}=await sb.rpc('leaderboard');if(error)throw error;return data;},
  async claimRewards(){
    if(!LIVE){return (MOCKDB.get().rewards||{})[uid]||[];}
    const {data,error}=await sb.rpc('claim_season_rewards');if(error)throw error;return data||[];},
  async myRating(){
    if(!LIVE){const d=MOCKDB.get();return (d.ratings||{})[uid]||{rating:1000,games:0};}
    const {data,error}=await sb.from('player_ratings').select('rating,games,season').eq('user_id',uid).maybeSingle();if(error)throw error;
    const n=new Date(),cur=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;return data&&data.season===cur?data:{rating:1000,games:0};},
  async recordRating(team,opp,gf,ga){
    if(!LIVE){const d=MOCKDB.get();d.ratings=d.ratings||{};const r=d.ratings[uid]||{rating:1000,games:0};const k=r.games<10?40:24;const e=1/(1+Math.pow(10,(opp-team)/400));const s2=gf>ga?1:gf===ga?.5:0;
      const dd=Math.round(k*(s2-e)+(s2!==.5?Math.max(-3,Math.min(3,gf-ga)):0));r.rating=Math.max(100,r.rating+dd);r.games++;d.ratings[uid]=r;MOCKDB.put(d);return r.rating;}
    const {data,error}=await sb.rpc('record_rating',{p_team:team,p_opp:opp,p_gf:gf,p_ga:ga});if(error)throw error;return data;},
  async matchBegin(key){
    if(!LIVE){const d=MOCKDB.get();if(d.active&&d.active.k!==key)mockLeave(d);d.active={k:key,at:Date.now()};MOCKDB.put(d);return;}
    const {error}=await sb.rpc('match_begin',{p_key:key});if(error)throw error;},
  async matchDone(reason){
    if(!LIVE){const d=MOCKDB.get();if(d.active){if(reason==='leave')mockLeave(d);else d.active=null;}MOCKDB.put(d);return;}
    const {error}=await sb.rpc('match_done',{p_reason:reason});if(error)throw error;},
  async report(target,reason,ctx){
    if(!LIVE){const d=MOCKDB.get();(d.reports=d.reports||[]).push({reporter:uid,target,reason,ctx,at:Date.now()});MOCKDB.put(d);return;}
    const {error}=await sb.rpc('report_player',{p_target:target,p_reason:reason,p_ctx:ctx});if(error)throw error;},
  async restrictions(){
    if(!LIVE){const d=MOCKDB.get();return {leave_ban_until:d.leaveBan&&d.leaveBan>Date.now()?new Date(d.leaveBan).toISOString():null,leaves_total:d.leaves||0};}
    const {data,error}=await sb.rpc('my_restrictions');if(error)throw error;return data||{};},
  async cupTick(){
    if(!LIVE){const d=MOCKDB.get();d.cups=d.cups||[];if(!d.cups.length){const t=new Date();t.setDate(t.getDate()+((6-t.getDay()+7)%7));t.setHours(21,0,0,0);if(t<new Date())t.setDate(t.getDate()+7);d.cups.push({id:'cup1',name:'Hafta Sonu Kupası',starts_at:t.toISOString(),status:'open',size:8,winner:null,entries:[],matches:[]});MOCKDB.put(d);}return d.cups[d.cups.length-1].id;}
    const {data,error}=await sb.rpc('cup_tick');if(error)throw error;return data;},
  async cup(id){
    if(!LIVE){const c=(MOCKDB.get().cups||[]).find(c=>c.id===id);return c?{cup:c,entries:c.entries.map(t=>({team_id:t})),matches:c.matches}:null;}
    const [a,b,c]=await Promise.all([sb.from('cups').select('*').eq('id',id).maybeSingle(),sb.from('cup_entries').select('team_id,joined_at').eq('cup_id',id).order('joined_at'),sb.from('cup_matches').select('*').eq('cup_id',id).order('round').order('slot')]);
    if(a.error)throw a.error;return a.data?{cup:a.data,entries:b.data||[],matches:c.data||[]}:null;},
  async cupRpc(fn,args){
    if(!LIVE){const d=MOCKDB.get();const c=(d.cups||[]).find(c=>c.id===args.p_cup)||(d.cups||[]).find(c=>c.matches.some(m=>m.id===args.p_match));const my=d.members.find(m=>m.user_id===uid);
      if(fn==='cup_join'){if(!my||my.role!=='kaptan')throw new Error('only captains can register');c.entries=args.p_join?[...new Set([...c.entries,my.team_id])]:c.entries.filter(t=>t!==my.team_id);}
      else{const m=c.matches.find(m=>m.id===args.p_match);if(fn==='cup_report'){if(args.p_home===args.p_away)throw new Error('cup matches need a winner');Object.assign(m,{status:'reported',home_score:args.p_home,away_score:args.p_away,reported_by:my&&my.team_id});}
        else if(fn==='cup_confirm'){if(!args.p_ok)Object.assign(m,{status:'ready',home_score:null,away_score:null,reported_by:null});else{m.status='played';m.winner=m.home_score>m.away_score?m.home:m.away;const R=Math.round(Math.log2(c.size));if(m.round>=R){c.status='done';c.winner=m.winner;}else{const nx=c.matches.find(x=>x.round===m.round+1&&x.slot===Math.floor(m.slot/2));nx[m.slot%2?'away':'home']=m.winner;if(nx.home&&nx.away)nx.status='ready';}}}}
      MOCKDB.put(d);return;}
    const {error}=await sb.rpc(fn,args);if(error)throw error;},
  async leagueMatches(){
    if(!LIVE){return (MOCKDB.get().lm||[]).slice();}
    const since=new Date(Date.now()-14*864e5).toISOString();
    const {data,error}=await sb.from('league_matches').select('*').or(`status.in.(proposed,accepted,reported),updated_at.gte.${since}`).order('scheduled_at').limit(300);if(error)throw error;return data;},
  async leagueRpc(fn,args){
    if(!LIVE){const d=MOCKDB.get();d.lm=d.lm||[];const my=d.members.find(m=>m.user_id===uid);const myT=my&&my.team_id,cap=my&&my.role==='kaptan'?myT:null;const now=new Date().toISOString();
      const m=args.p_match&&d.lm.find(x=>x.id===args.p_match);
      if(fn==='propose_league_match'){if(!cap)throw new Error('only captains can propose');const t1=d.teams[cap],t2=d.teams[args.p_opp];if(!t2||t1.tier!==t2.tier)throw new Error('teams are in different tiers');
        if(d.lm.some(x=>['proposed','accepted','reported'].includes(x.status)&&[x.home,x.away].includes(cap)&&[x.home,x.away].includes(args.p_opp)))throw new Error('there is already an open match between these teams');
        d.lm.push({id:'m'+rcode()+rcode(),home:cap,away:args.p_opp,tier:t1.tier,scheduled_at:args.p_when,status:'proposed',home_score:null,away_score:null,reported_by:null,updated_at:now});}
      else if(!m)throw new Error('no such match');
      else if(fn==='respond_league_match'){if(m.away!==cap)throw new Error('only the invited captain can respond');m.status=args.p_accept?'accepted':'declined';}
      else if(fn==='cancel_league_match'){if(![m.home,m.away].includes(cap))throw new Error('only captains of these teams can cancel');m.status='cancelled';}
      else if(fn==='report_league_result'){if(![m.home,m.away].includes(myT)||m.status!=='accepted')throw new Error('match is not open for a result');Object.assign(m,{status:'reported',home_score:args.p_home,away_score:args.p_away,reported_by:myT});}
      else if(fn==='confirm_league_result'){if(!cap||cap===m.reported_by||![m.home,m.away].includes(cap))throw new Error('only the other captain can confirm');
        if(!args.p_ok)Object.assign(m,{status:'accepted',home_score:null,away_score:null,reported_by:null});
        else{const up=(id,f,a)=>{const t=d.teams[id];const pt=f>a?3:f===a?1:0;t.points+=pt;t.played++;t.won+=pt===3;t.drawn+=pt===1;t.lost+=pt===0;t.gf+=f;t.ga+=a;};up(m.home,m.home_score,m.away_score);up(m.away,m.away_score,m.home_score);m.status='played';}}
      if(m)m.updated_at=now;MOCKDB.put(d);return;}
    const {data,error}=await sb.rpc(fn,args);if(error)throw error;return data;},
  async updateKit(teamId,kit){
    if(!LIVE){const d=MOCKDB.get();if(d.teams[teamId])d.teams[teamId].kit=kit;MOCKDB.put(d);return;}
    const {error}=await sb.from('teams').update({kit}).eq('id',teamId);if(error)throw error;},
};
function mockLeave(d){d.active=null;d.ratings=d.ratings||{};const r=d.ratings[uid]||{rating:1000,games:0};r.rating=Math.max(100,r.rating-20);d.ratings[uid]=r;d.leaveBan=Date.now()+60e3;d.leaves=(d.leaves||0)+1;}
const errText=e=>{const m=(e&&(e.message||e.error_description))||String(e);
  if(/duplicate key|unique/i.test(m))return 'Bu isimde bir takım zaten var.';
  if(/already in a team|zaten/i.test(m))return 'Zaten bir takımdasın.';
  if(/team is full/i.test(m))return 'Takım dolu (en fazla 12 kişi).';
  if(/no team with this code/i.test(m))return 'Bu kodla bir takım yok.';
  if(/fetch|network/i.test(m))return 'Sunucuya ulaşılamadı. Bağlantını kontrol et.';
  const LE={'only captains can propose':'Maç teklifini yalnızca kaptan yapabilir.','different tiers':'Takımlar aynı ligde değil.','between 10 minutes and 21 days':'Saat en az 10 dakika, en fazla 21 gün sonrası olmalı.','already an open match':'Bu takımla zaten açık bir maçınız var.','only the invited captain':'Bu teklife yalnızca davet edilen kaptan cevap verebilir.','not open for a result':'Bu maç için şu an skor girilemez.','has not started yet':'Maç saati gelmeden skor girilemez.','only the other captain':'Skoru rakip takımın kaptanı onaylamalı.','cannot be cancelled':'Bu maç artık iptal edilemez.','only captains of these teams':'Bunu yalnızca iki takımın kaptanı yapabilir.','only captains can register':'Kupaya takımı yalnızca kaptan kaydedebilir.','registration closed':'Kayıtlar kapandı.','cup is full':'Kupa doldu (8 takım).','cup matches need a winner':'Kupa maçında beraberlik olmaz, kazananı yaz.','only players of these teams can report':'Skoru yalnızca bu iki takımın oyuncuları girebilir.','no result to confirm':'Onaylanacak skor yok.'};
  for(const k in LE)if(m.includes(k))return LE[k];
  return m;};

// =====================================================================
// ---------- Canlı kanal: presence + yayın (aynı arayüz, iki uygulama) ----------
// =====================================================================
function makeRoomSB(name){
  const ch=sb.channel(name,{config:{presence:{key:TAB},broadcast:{self:false}}});
  // Supabase presence sınırı: istemci başına 30 sn'de en fazla 5 güncelleme (ücretsiz planda proje geneli 20/sn).
  // Bu yüzden presence en fazla 6,2 sn'de bir gönderilir; oda kanallarında değişiklikler ayrıca anında '_p' yayınıyla iletilir.
  const fast=name.startsWith('uzk-r-');const over={};let seq=0,lastTrack=0,bTimer=null;
  let mine={},hs=new Set(),evs={},cached=Object.freeze([]),subscribed=false,timer=null,lastSent='';
  const selfEntry=()=>Object.freeze({peer:TAB,sameTab:true,isMe:true,kind:'viewer',presence:Object.freeze(JSON.parse(JSON.stringify(mine)))});
  const fire=()=>hs.forEach(h=>{try{h({peers:cached});}catch(e){console.error(e);}});
  const rebuild=()=>{const st=ch.presenceState();const arr=[];
    for(const k in st){if(k===TAB)continue;const metas=st[k];const m=metas&&metas[metas.length-1];if(!m)continue;const {presence_ref,...p0}=m;
      const o=over[k];const p=o&&(Number(o._s)||0)>(Number(p0._s)||0)?o:p0;
      arr.push(Object.freeze({peer:k,sameTab:false,isMe:false,kind:'viewer',presence:Object.freeze(p)}));}
    for(const k in over)if(!st[k])delete over[k];
    arr.push(selfEntry());cached=Object.freeze(arr);fire();};
  ch.on('presence',{event:'sync'},rebuild);
  for(const ev of ['sig','g','in'])ch.on('broadcast',{event:ev},({payload})=>{const f=evs[ev];if(f)f(payload);});
  if(fast)ch.on('broadcast',{event:'_p'},({payload})=>{if(!payload||typeof payload.peer!=='string'||payload.peer===TAB||!payload.p||typeof payload.p!=='object')return;
    const cur=over[payload.peer];if(cur&&(Number(cur._s)||0)>=(Number(payload.p._s)||0))return;over[payload.peer]=payload.p;if(ch.presenceState()[payload.peer])rebuild();});
  const flush=()=>{timer=null;if(!subscribed)return;const s=JSON.stringify(mine);if(s===lastSent)return;
    const wait=lastTrack+6200-Date.now();if(wait>0){timer=setTimeout(flush,wait);return;}
    lastSent=s;lastTrack=Date.now();ch.track(mine).catch(()=>{});};
  const fastSend=()=>{bTimer=null;if(!subscribed)return;ch.send({type:'broadcast',event:'_p',payload:{peer:TAB,p:mine}}).catch(()=>{});};
  const api={name,
    presence(patch){let chg=false;for(const k in patch){const v=patch[k];if(v===null){if(k in mine){delete mine[k];chg=true;}}else if(JSON.stringify(mine[k])!==JSON.stringify(v)){mine[k]=v;chg=true;}}
      if(!chg)return Promise.resolve();mine._s=Date.now()*1000+(++seq%1000);
      cached=Object.freeze(cached.filter(p=>!p.sameTab).concat([selfEntry()]));fire();
      if(fast&&subscribed&&!bTimer)bTimer=setTimeout(fastSend,120);
      if(!timer)timer=setTimeout(flush,100);return Promise.resolve();},
    peers:()=>cached,
    onPeers(h){hs.add(h);setTimeout(()=>h({peers:cached}));return()=>hs.delete(h);},
    on(ev,fn){evs[ev]=fn;},
    send(ev,payload){if(!subscribed)return;ch.send({type:'broadcast',event:ev,payload}).catch(()=>{});},
    leave(){subscribed=false;try{ch.untrack();}catch(e){}return sb.removeChannel(ch);},
    ready:null};
  api.ready=new Promise(res=>{let done=false;ch.subscribe(st=>{
    if(st==='SUBSCRIBED'){subscribed=true;lastSent='';flush();if(!done){done=true;res(true);}}
    else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'||st==='CLOSED'){if(!done){done=true;res(false);}}});
    setTimeout(()=>{if(!done){done=true;res(false);}},12000);});
  return api;
}
// Yerel deneme: aynı tarayıcının sekmeleri arasında BroadcastChannel
function makeRoomBC(name){
  const bc=new BroadcastChannel('uzk-'+name),peers=new Map(),hs=new Set(),evs={};let mine={},cached=null,pend=false,closed=false;
  const snap=()=>Object.freeze([...peers.entries()].map(([peer,v])=>Object.freeze({peer,isMe:peer===TAB,sameTab:peer===TAB,kind:'viewer',presence:v})));
  const notify=()=>{cached=snap();hs.forEach(h=>{try{h({peers:cached});}catch(e){console.error(e);}});};
  peers.set(TAB,Object.freeze({}));
  bc.onmessage=e=>{const m=e.data;if(closed)return;
    if(m.t==='p'){const was=peers.has(m.peer);peers.set(m.peer,Object.freeze(m.p));notify();if(!was)bc.postMessage({t:'p',peer:TAB,p:mine});}
    else if(m.t==='bye'){peers.delete(m.peer);notify();}
    else if(m.t==='hi'){bc.postMessage({t:'p',peer:TAB,p:mine});}
    else if(m.t==='ev'){const f=evs[m.ev];if(f)f(m.d);}};
  bc.postMessage({t:'hi'});
  addEventListener('beforeunload',()=>{try{bc.postMessage({t:'bye',peer:TAB});}catch(e){}});
  return {name,ready:Promise.resolve(true),
    presence(patch){for(const k in patch){if(patch[k]===null)delete mine[k];else mine[k]=patch[k];}mine={...mine};peers.set(TAB,Object.freeze(JSON.parse(JSON.stringify(mine))));
      notify();if(!pend){pend=true;setTimeout(()=>{pend=false;if(!closed)bc.postMessage({t:'p',peer:TAB,p:mine});},60);}return Promise.resolve();},
    peers(){return cached||(cached=snap());},
    onPeers(h){hs.add(h);setTimeout(()=>h({peers:this.peers()}),0);return()=>hs.delete(h);},
    on(ev,fn){evs[ev]=fn;},
    send(ev,d){if(!closed)bc.postMessage({t:'ev',ev,d});},
    leave(){closed=true;try{bc.postMessage({t:'bye',peer:TAB});bc.close();}catch(e){}return Promise.resolve();}};
}
const makeRoom=name=>LIVE?makeRoomSB(name):makeRoomBC(name);

// =====================================================================
// ---------- Oyuncudan oyuncuya bağlantı (WebRTC), yedek: kanal yayını ----------
// =====================================================================
const STUN=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun.cloudflare.com:3478']}];
let ICE=STUN,iceAt=0;
// TURN: oyuncular aynı ağı/NAT'ı aşamadığında Cloudflare TURN üzerinden bağlanır; yoksa yalnız STUN ile devam
async function loadIce(){if(!LIVE)return;try{const r=await fetch(CFG.supabaseUrl+'/functions/v1/turn-ice',{method:'POST',headers:{apikey:CFG.supabaseAnonKey,Authorization:'Bearer '+CFG.supabaseAnonKey}});const j=await r.json();if(j&&j.ok&&Array.isArray(j.iceServers)&&j.iceServers.length){ICE=STUN.concat(j.iceServers);iceAt=Date.now();setTimeout(loadIce,3*3600e3);return;}}catch(e){}setTimeout(loadIce,10*60e3);}
loadIce();
const RTC={pcs:new Map(),dcs:new Map(),pend:new Map()};
function rtcReset(){for(const pc of RTC.pcs.values()){try{pc.close();}catch(e){}}RTC.pcs.clear();RTC.dcs.clear();RTC.pend.clear();}
function rtcDrop(peer){const pc=RTC.pcs.get(peer);if(pc){try{pc.close();}catch(e){}}RTC.pcs.delete(peer);RTC.dcs.delete(peer);RTC.pend.delete(peer);}
function rtcSetupDc(peer,dc){
  dc.onopen=()=>{RTC.dcs.set(peer,dc);schedule(renderRoom);};
  dc.onclose=()=>{RTC.dcs.delete(peer);schedule(renderRoom);};
  dc.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(_){return;}
    if(NET.isHost){if(Array.isArray(m.in))NET.inputs[peer]=m.in;if(typeof m.pi==='number'){try{dc.send(JSON.stringify({po:m.pi}));}catch(_){}}}
    else if(m.g)acceptSnap(m.g);
    else if(typeof m.po==='number'){const r=performance.now()-m.po;if(r>=0&&r<5000){NET.ping=NET.ping?Math.round(NET.ping*0.6+r*0.4):Math.round(r);}}};
}
function rtcHostEnsure(peer){ // oda sahibi her oyuncuya bağlantı teklif eder
  if(RTC.pcs.has(peer)||typeof RTCPeerConnection==='undefined')return;
  const pc=new RTCPeerConnection({iceServers:ICE});RTC.pcs.set(peer,pc);
  rtcSetupDc(peer,pc.createDataChannel('g',{ordered:false,maxRetransmits:0}));
  pc.onicecandidate=e=>{if(e.candidate&&NET.room)NET.room.send('sig',{to:peer,from:TAB,c:e.candidate.toJSON()});};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'||pc.connectionState==='closed'){rtcDrop(peer);schedule(renderRoom);}};
  pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>{if(NET.room)NET.room.send('sig',{to:peer,from:TAB,sdp:pc.localDescription.toJSON()});}).catch(()=>rtcDrop(peer));
}
async function rtcOnSignal(m){
  if(!m||m.to!==TAB||typeof m.from!=='string'||typeof RTCPeerConnection==='undefined')return;
  const peer=m.from;
  try{
    if(m.sdp&&m.sdp.type==='offer'){ // istemci: oda sahibinden teklif
      rtcDrop(peer);const pc=new RTCPeerConnection({iceServers:ICE});RTC.pcs.set(peer,pc);
      pc.ondatachannel=e=>rtcSetupDc(peer,e.channel);
      pc.onicecandidate=e=>{if(e.candidate&&NET.room)NET.room.send('sig',{to:peer,from:TAB,c:e.candidate.toJSON()});};
      await pc.setRemoteDescription(m.sdp);for(const c of RTC.pend.get(peer)||[])await pc.addIceCandidate(c).catch(()=>{});RTC.pend.delete(peer);
      const a=await pc.createAnswer();await pc.setLocalDescription(a);NET.room.send('sig',{to:peer,from:TAB,sdp:pc.localDescription.toJSON()});
    } else if(m.sdp&&m.sdp.type==='answer'){const pc=RTC.pcs.get(peer);if(pc&&!pc.currentRemoteDescription){await pc.setRemoteDescription(m.sdp);for(const c of RTC.pend.get(peer)||[])await pc.addIceCandidate(c).catch(()=>{});RTC.pend.delete(peer);}}
    else if(m.c){const pc=RTC.pcs.get(peer);if(pc&&pc.remoteDescription)await pc.addIceCandidate(m.c).catch(()=>{});else{const q=RTC.pend.get(peer)||[];q.push(m.c);RTC.pend.set(peer,q);}}
  }catch(e){console.warn('rtc',e);}
}
const dcOpen=peer=>{const d=RTC.dcs.get(peer);return d&&d.readyState==='open'?d:null;};

// =====================================================================
// ---------- Lobi, odalar, takımlar, sohbet, maç senkronu ----------
// =====================================================================
const NET={lobby:null,room:null,code:null,isHost:false,state:'off',
  cfg:null,teams:{},wantSeen:{},bots:[],phase:'lobby',ro:null,inputs:{},
  want:'spec',ready:false,lobbyChat:[],roomChat:[],logs:{lobby:new Map(),room:new Map()},seq:0,
  joinedAt:0,hostSeenAt:0,roKey:null,snap:null,snapN:-1,lastSnap:null,lastIn:'',lastInAt:0,lastChatAt:0,botN:0,menuFor:null,pubN:0};
const QUICK=['Pas ver!','Geri dön!','Şut çek!','Benim!','Güzel!','Kaleye!','😂','GG'];
const KITS=[{n:'Kırmızı',a:'KRM',p:'#d63a2a',s:'#ffffff',pat:'solid'},{n:'Mavi',a:'MAV',p:'#2a62d6',s:'#ffffff',pat:'solid'},{n:'Sarı-Lacivert',a:'SRL',p:'#f2c230',s:'#0e2a5c',pat:'hoop'},{n:'Yeşil-Beyaz',a:'YŞB',p:'#1f9d55',s:'#ffffff',pat:'stripes'},{n:'Siyah-Beyaz',a:'SYB',p:'#111111',s:'#ffffff',pat:'stripes'},{n:'Mor',a:'MOR',p:'#7b3fd1',s:'#e64a8f',pat:'sash'},{n:'Turuncu',a:'TRN',p:'#ff7a1a',s:'#111111',pat:'half'},{n:'Bordo-Mavi',a:'BRM',p:'#7a1f2b',s:'#18b6c9',pat:'half'}];
const kitOf=i=>{if(i&&typeof i==='object'){const c=cleanKit(i);return {name:cleanStr(i.name,24)||'Takım',abbr:cleanTag(i.abbr)||'TKM',...c};}const k=KITS[i]||KITS[0];return {name:k.n,abbr:k.a,p:k.p,s:k.s,pat:k.pat};};
const leagueCode=id=>{const a='abcdefghjkmnpqrstuvwxyz23456789';let h=0;for(const ch of String(id))h=(h*31+ch.charCodeAt(0))>>>0;let s='';for(let i=0;i<4;i++){s+=a[h%a.length];h=Math.floor(h/a.length)+i*7919;}return s;};
let roomDraft={map:'classic',max:4,time:180,goals:3,mode:'normal'};
const randCode=()=>{const a='abcdefghjkmnpqrstuvwxyz23456789';let s='';for(let i=0;i<4;i++)s+=a[Math.floor(Math.random()*a.length)];return s;};
// rAF arka plandaki sekmede durur; ağ olayları için setTimeout kullanılır
let rafQ=new Set();function schedule(fn){if(rafQ.has(fn))return;rafQ.add(fn);setTimeout(()=>{rafQ.delete(fn);try{fn();}catch(e){console.error(e);}},16);}
const myPeer=()=>TAB;
const named=ps=>ps.filter(p=>p.kind!=='agent'&&p.presence&&typeof p.presence.nick==='string');
// takım etiketi: takımdaysan adının önünde sarı kısaltma (örn. SKC furkan)
function cleanTag(t){return typeof t==='string'?t.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]/g,'').slice(0,3):'';}
const myTag=()=>cleanTag(myTeamCache&&myTeamCache.team?myTeamCache.team.abbr:'');
function nickEl(tag,nick,color,tagName='b'){const b=document.createElement(tagName);const t=cleanTag(tag);
  if(t){const s=document.createElement('span');s.className='ttag';s.textContent=t;b.appendChild(s);}
  const n=document.createElement('span');n.textContent=cleanBad(nick);if(color)n.style.color=color;b.appendChild(n);return b;}
function pushTag(){pushLobby();if(NET.room)pushRoom();}

async function netConnect(){
  if(NET.state==='on'||NET.state==='connecting')return;
  NET.state='connecting';renderNetState();
  const lobby=await joinLobby();
  if(!lobby){NET.state='bad';renderNetState('Canlı sunucuya bağlanılamadı. Biraz sonra tekrar dene; botlara karşı antrenman açık.');setTimeout(()=>{NET.state='off';netConnect();},8000);return;}
  NET.lobby=lobby;NET.state='on';
  pushLobby();renderNetState('');renderOnline();
}
async function joinLobby(){
  let lobby;try{lobby=makeRoom('uzk-lobby');}catch(e){return null;}
  if(!(await lobby.ready)){try{lobby.leave();}catch(e){}return null;}
  lobby.onPeers(()=>schedule(renderOnline));
  lobby.on('qm',onQueueMatch);lobby.on('inv',onInvite);lobby.on('frq',d=>{if(d&&d.to===uid)loadFriends(true);});
  return lobby;
}
// Kapasite: lobi kanalında her güncelleme kanaldaki herkese gider (100 kişide 100 mesaj). Maçtaki oyuncular (oda sahibi hariç)
// maç süresince lobiden çıkar, maç bitince geri döner; oda sahibi odasını listede tutmak için kalır.
async function lobbyTick(){
  if(NET.state!=='on'||NET.lobbyBusy)return;
  const inMatch=!!(NET.room&&!NET.isHost&&G&&G.net&&G.net.role==='client'&&G.state!=='over');
  if(inMatch&&NET.lobby&&!NET.queue){NET.lobbyBusy=true;const l=NET.lobby;NET.lobby=null;NET.lobbyPaused=true;try{await l.leave();}catch(e){}NET.lobbyBusy=false;}
  else if(!inMatch&&NET.lobbyPaused){NET.lobbyBusy=true;const l=await joinLobby();NET.lobbyBusy=false;if(l){NET.lobby=l;NET.lobbyPaused=false;pushLobby();renderOnline();}}
}
setInterval(lobbyTick,2000);
// Lobi kanalında herkes herkesi dinler: her güncelleme ~oyuncu sayısı kadar mesaj demek. Ping'i kaba gruplarla
// (iyi/orta/kötü) ve eşik payıyla yayınla ki maç sırasında küçük dalgalanmalar 100 kişiye boşuna mesaj göndermesin.
function lobbyQ(){const a=avgPing();if(!a)return NET.lqB||0;const b=NET.lqB||0;
  const nb=a<90?40:a<180?120:250;if(nb!==b){const lo=b===40?0:b===120?90:180,hi=b===40?90:b===120?180:1e9;if(!b||a<lo-15||a>hi+15)NET.lqB=nb;}return NET.lqB||nb;}
function pushLobby(){
  if(!NET.lobby)return;
  const host=NET.isHost&&NET.room&&NET.cfg?{code:NET.code,name:NET.cfg.name,map:NET.cfg.map,mode:cleanMode(NET.cfg.mode),n:hostHumanCount(),max:NET.cfg.max,ph:NET.phase,priv:NET.cfg.priv?1:0,ar:roomAvgR(),lq:lobbyQ()}:null;
  NET.lobby.presence({nick:prof.name,av:prof.avatar,nc:prof.nameColor,tg:myTag(),u:uid,cel:prof.cel,r:MYR.r,rg:MYR.g,sr:bestTier(),chat:NET.lobbyChat,host,q:NET.queue&&!NET.room?{m:NET.queue.m,t:NET.queue.t}:null,inRoom:NET.room?1:0,rc:NET.room&&!(roomView()||{cfg:{}}).cfg.priv?NET.code:''});
}
function renderNetState(msg){
  const el=$('netState');if(!el)return;
  el.className='netdot'+(NET.state==='on'?' on':NET.state==='bad'?' bad':'');
  el.textContent=NET.state==='on'?'çevrimiçi':NET.state==='bad'?'bağlantı yok':'bağlanıyor';
  if(msg!==undefined)$('netMsg').textContent=msg;
  const dis=NET.state!=='on';['createRoom','joinCode','quickBtn'].forEach(id=>$(id).disabled=dis);if(typeof renderQueue==='function')renderQueue();
}
function lobbyRooms(){
  if(!NET.lobby)return[];
  return named(NET.lobby.peers()).filter(p=>p.presence.host&&typeof p.presence.host.code==='string'&&!p.presence.host.priv&&/^[a-z0-9]{4}$/.test(p.presence.host.code))
    .map(p=>({...p.presence.host,hostNick:p.presence.nick}));
}
function renderOnline(){
  if(!NET.lobby||$('main').hidden)return;
  const ps=named(NET.lobby.peers());
  const inGame=ps.reduce((t,p)=>t+(p.presence.host&&p.presence.host.ph==='game'?Math.max(0,(Number(p.presence.host.n)||1)-1):0),0);
  $('onlineCount').textContent=(ps.length+inGame)+' çevrimiçi';
  const rooms=lobbyRooms().sort((a,b)=>(b.n||0)-(a.n||0));
  $('roomCount').textContent=rooms.length;
  const list=$('roomList');list.innerHTML='';
  if(!rooms.length){list.innerHTML='<div class="empty">Şu an açık oda yok. İlk odayı sen kur ya da Hızlı eşleş\'e bas.</div>';}
  rooms.forEach(r=>{const b=document.createElement('button');b.className='roomcard';
    const full=(r.n||0)>=(r.max||0);
    b.innerHTML=`<b></b><span class="cnt">${Number(r.n)||0}/${Number(r.max)||0}</span><span class="meta"><span class="tag">${esc(MAPS[r.map]?MAPS[r.map].name:'?')}</span>${MODES[r.mode]&&r.mode!=='normal'?`<span class="tag fun">${MODES[r.mode].i} ${esc(MODES[r.mode].n)}</span>`:''}${r.ph==='game'?'<span class="tag live">Maçta</span>':'<span class="tag">Lobide</span>'}<span class="hn"></span></span>`;
    if(Number(r.lq)>0){const pe=pingEl(Number(r.lq));pe.title='Bu odadaki oyuncuların ortalama gecikmesi';b.querySelector('.meta').appendChild(pe);}
    b.querySelector('b').textContent=cleanStr(r.name,28)||'Oda';b.querySelector('.hn').textContent='Kuran: '+cleanStr(r.hostNick,14);
    if(full&&r.ph!=='game'){b.disabled=true;b.style.opacity=.55;}
    b.onclick=()=>{NET.watch=r.ph==='game';enterRoom(r.code);};
    if(r.ph==='game'){const w=document.createElement('span');w.className='watch';w.textContent='👁 İzle';b.appendChild(w);}
    list.appendChild(b);});
  renderChat('lobby',NET.lobby,$('lcLog'));renderFriends();renderRejoin();renderTutBox();
  const ol=$('onlineList');ol.innerHTML='';
  ps.sort((x,y)=>(y.sameTab?1:0)-(x.sameTab?1:0)).slice(0,60).forEach(p=>{const pr=p.presence;const b=document.createElement('button');b.type='button';b.className='oplayer';
    const av=document.createElement('span');av.className='av';av.textContent=cleanStr(pr.av,2)||'?';
    const st=document.createElement('span');st.className='st';st.textContent=p.sameTab?'sen':pr.host?'oda kurdu':pr.inRoom?'odada':'lobide';
    b.append(av,nickEl(pr.tg,cleanStr(pr.nick,14),cleanCol(pr.nc),'span'),st);
    b.onclick=()=>openStats(pr.u,cleanStr(pr.nick,14),pr.tg);ol.appendChild(b);});
}

// ---------- Küfür filtresi ----------
// Yazımı bozulmuş halleri de yakalamak için: küçük harf, 1→i 3→e 4→a 0→o @→a $→s, tekrar eden harfler tek.
const BAD_PRE=['piçl','amına','amina','amcık','amcik','orospu','orsp','sikt','siker','sikim','sikiş','sikis','sikey','sikik','sikl','yarrak','yarag','dalyarak','dalyarag','pezevenk','gavat','kahpe','sürtük','surtuk','yavşak','yavsak','ibne','puşt','taşşak','tasak','taşak','götver','götlek','gotver','orosb','amcı','amq','amk'];
const BAD_EX=['aq','amk','amq','mk','oç','oc','piç','pic','sik','sikerim','göt','götü','götün','gotu','pust','ananı','anani','bacını','bacini','avradını','sikiyim','sokayım','sokarım'];
const normBad=w=>w.toLocaleLowerCase('tr-TR').replace(/[1!|]/g,'i').replace(/3/g,'e').replace(/[4@]/g,'a').replace(/0/g,'o').replace(/\$/g,'s').replace(/[^a-zçğıöşü]/g,'').replace(/(.)\1+/g,'$1');
function isBad(w){const n=normBad(w);if(!n)return false;if(BAD_EX.includes(n))return true;return BAD_PRE.some(b=>n.startsWith(normBad(b)));}
function cleanBad(t){return String(t).split(/(\s+)/).map(w=>/\s/.test(w)||!isBad(w)?w:w[0]+'*'.repeat(Math.max(2,Math.min(6,w.length-1)))).join('');}
const hasBad=t=>String(t).split(/\s+/).some(isBad);
// sustur listesi (yalnızca bu tarayıcıda)
const isMuted=u=>!!u&&Array.isArray(prof.muted)&&prof.muted.includes(u);
function toggleMute(u){if(!u)return;prof.muted=Array.isArray(prof.muted)?prof.muted:[];if(isMuted(u))prof.muted=prof.muted.filter(x=>x!==u);else prof.muted=[...prof.muted,u].slice(-200);save();NET.logs.room&&NET.logs.room.clear();NET.logs.lobby&&NET.logs.lobby.clear();$('lcLog').innerHTML='';$('rcLog').innerHTML='';try{renderChat('lobby',NET.lobby,$('lcLog'));if(NET.room)renderChat('room',NET.room,$('rcLog'));}catch(e){}}
const MOD={muted_until:null,banned_until:null};
// ---------- Maç terk cezası ----------
const leaveBanLeft=()=>MOD.leave_ban_until?Math.max(0,new Date(MOD.leave_ban_until)-Date.now()):0;
function leaveBanMsg(){const ms=leaveBanLeft();const m=Math.floor(ms/60e3),s2=Math.ceil(ms%60e3/1e3);return `Maçı yarıda bıraktığın için ${m?m+' dk ':''}${s2} sn daha maç bulamazsın. Bu sürede antrenman yapabilir ya da maç izleyebilirsin.`;}
const inRankedMatch=()=>!!(G&&G.ranked&&!G.ended&&G.state!=='over');
async function refreshAfterLeave(){try{Object.assign(MOD,await DB.restrictions());}catch(e){}try{const r=await DB.myRating();MYR={r:Number(r.rating)||1000,g:Number(r.games)||0};}catch(e){}renderMe();pushLobby();}
async function penalizeLeave(){clearLastMatch();if(!G||!G.ranked)return;G.ranked=false;try{await DB.matchDone('leave');}catch(e){}await refreshAfterLeave();$('netMsg').textContent='Maçı yarıda bıraktın: −20 beceri puanı ve 1 dakika maç bulma cezası.';}
function clearRanked(reason){clearLastMatch();if(!G||!G.ranked)return;G.ranked=false;DB.matchDone(reason).catch(()=>{});}
function confirmLeave(){return window.confirm('Maç sürüyor. Şimdi çıkarsan beceri puanından 20 düşer ve 1 dakika maç bulamazsın. Yine de çıkmak istiyor musun?');}
addEventListener('beforeunload',e=>{if(inRankedMatch()){e.preventDefault();e.returnValue='';}});
// ---------- Beceri puanı ----------
let MYR={r:1000,g:0};
const RANKS=[[0,'Bronz','#c98a55'],[900,'Gümüş','#c9d1d9'],[1100,'Altın','#f2c230'],[1300,'Platin','#5fd3c6'],[1500,'Elmas','#7fb2ff'],[1700,'Usta','#e07bff']];
function rankOf(r,g){r=Number(r)||1000;if((Number(g)||0)<5)return {n:'Yerleşiyor',c:'#9aa7a0',r};let k=RANKS[0];for(const x of RANKS)if(r>=x[0])k=x;return {n:k[1],c:k[2],r};}
// ---------- Sezon ödülleri ve sıralama ----------
const TIERS={altin:{n:'Altın sezon',i:'🥇',c:'#f2c230',min:1100},elmas:{n:'Elmas sezon',i:'💎',c:'#7fb2ff',min:1500},usta:{n:'Usta sezon',i:'👑',c:'#e07bff',min:1700}};
const TIER_ORD={altin:1,elmas:2,usta:3};
const cleanTier=t=>TIERS[t]?t:'';
let MYREW=[];
const bestTier=()=>MYREW.reduce((b,r)=>TIER_ORD[r.tier]>(TIER_ORD[b]||0)?r.tier:b,'');
const seasonName=s=>{const [y,m]=String(s).split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('tr-TR',{month:'long',year:'numeric'});};
function seasonLeft(){const n=new Date(),e=new Date(n.getFullYear(),n.getMonth()+1,1);const ms=e-n,d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5);return d?`${d} gün ${h} saat`:`${h} saat ${Math.floor(ms%36e5/6e4)} dk`;}
function tierEl(t){const k=TIERS[t];const s=document.createElement('span');s.className='tierb';s.textContent=k.i;s.title=k.n+' ödülü';return s;}
function drawAura(p){const k=TIERS[p.sr],t=performance.now()/1000;ctx.save();
  for(let i=0;i<2;i++){const ph=(t*0.8+i*0.5)%1;ctx.globalAlpha=(1-ph)*0.55;ctx.strokeStyle=k.c;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(p.x,p.y,p.r+3+ph*9,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=0.9;ctx.shadowColor=k.c;ctx.shadowBlur=12;ctx.strokeStyle=k.c;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,p.r+2,0,Math.PI*2);ctx.stroke();
  if(p.sr==='usta'){for(let i=0;i<3;i++){const a=t*1.6+i*Math.PI*2/3;ctx.fillStyle='#fff';ctx.globalAlpha=0.9;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*(p.r+6),p.y+Math.sin(a)*(p.r+6),1.8,0,Math.PI*2);ctx.fill();}}
  ctx.restore();}
async function renderRanking(box){
  const sec=document.createElement('section');sec.className='rankbox';box.appendChild(sec);sec.innerHTML='<p class="note">Sıralama yükleniyor…</p>';
  let d;try{d=await DB.leaderboard();}catch(e){sec.remove();return;}
  sec.innerHTML='<header><div><b>Oyuncu sıralaması</b><span></span></div></header><div class="rewards"></div><div class="rlist"></div><div class="rme"></div>';
  sec.querySelector('header span').textContent=`${seasonName(d.season)} sezonu · bitişe ${seasonLeft()} · beceri puanına göre (en az 5 maç)`;
  const rw=sec.querySelector('.rewards');
  Object.entries(TIERS).forEach(([k,t])=>{const e=document.createElement('div');e.className='rw';e.style.setProperty('--tc',t.c);
    e.innerHTML='<i></i><b></b><span></span>';e.querySelector('i').textContent=t.i;e.querySelector('b').textContent=`${t.min}+ puan`;
    e.querySelector('span').textContent=k==='altin'?'Altın sezon rozeti':k==='elmas'?'Elmas rozeti + maçta mavi parıltı halkası':'Usta tacı + maçta mor parıltı halkası';rw.appendChild(e);});
  const note=document.createElement('p');note.className='note';note.textContent='Ay sonunda puanın hangi seviyedeyse o ödülü kalıcı olarak kazanırsın; ödüller bir sonraki girişinde hesabına eklenir. Her yeni sezonda herkes 1000 puandan ve 5 yerleşme maçıyla yeniden başlar.';rw.appendChild(note);
  const L=sec.querySelector('.rlist');const top=d.top||[];
  if(!top.length)L.innerHTML='<p class="note">Henüz sıralamaya giren yok. 5 maç oynayan herkes listeye girer.</p>';
  const row=(x)=>{const r=document.createElement('div');r.className='rrow'+(x.id===uid?' me':'')+(x.pos<=3?' p'+x.pos:'');
    r.innerHTML='<span class="pos"></span><span class="av"></span><span class="nm"></span><span class="pt"></span>';
    r.querySelector('.pos').textContent=x.pos<=3?['🥇','🥈','🥉'][x.pos-1]:x.pos;r.querySelector('.av').textContent=cleanStr(x.avatar||'',2)||'?';
    const nm=r.querySelector('.nm');nm.appendChild(nickEl(x.tag,cleanStr(x.nick||'Oyuncu',14),cleanCol(x.name_color||'#ffffff'),'span'));nm.appendChild(rankEl(x.rating,x.games,'name'));if(cleanTier(x.best))nm.appendChild(tierEl(x.best));
    r.querySelector('.pt').textContent=x.rating;r.onclick=()=>openStats(x.id,x.nick||'Oyuncu',x.tag);return r;};
  top.slice(0,10).forEach(x=>L.appendChild(row(x)));
  if(top.length>10){const more=document.createElement('button');more.className='chip';more.textContent=`İlk ${top.length} oyuncuyu göster`;more.onclick=()=>{top.slice(10).forEach(x=>L.insertBefore(row(x),more));more.remove();};L.appendChild(more);}
  const me=sec.querySelector('.rme');
  me.textContent=d.me?`Senin sıran: ${d.me.pos}. (${d.total} oyuncu içinde) · ${d.me.rating} puan`:(MYR.g<5?`Sıralamaya girmek için ${5-MYR.g} maç daha oyna.`:'');
}
// Zkpball rütbe rozetleri (SVG). [orta, koyu, açık, işaret]
const RB={yeni:['#c3cec8','#6f7c75','#eef3f0','#5f6b65'],bronz:['#d98f55','#7d441a','#f6c79c','#6b3812'],gumus:['#dfe5ea','#7f8a95','#ffffff','#56616c'],
  altin:['#ffcf3a','#a87700','#fff1a8','#8a6200'],platin:['#5fdccd','#15786e','#d4fff9','#0f5f57'],elmas:['#7fb8ff','#2350c4','#e3f1ff','#1a3f9e'],usta:['#df8cff','#6c25a8','#fbe3ff','#5a1a8f']};
var RBN=0;
function rbBall(cx,cy,r){const id='rbc'+(RBN++);const P=(a,rr)=>[cx+rr*Math.cos(a),cy+rr*Math.sin(a)];
  const pent=(x,y,rr,rot)=>[0,1,2,3,4].map(i=>{const a=rot+i*2*Math.PI/5;return (x+rr*Math.cos(a)).toFixed(2)+','+(y+rr*Math.sin(a)).toFixed(2);}).join(' ');
  let s=`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/><g clip-path="url(#${id})">`;
  s+=`<polygon points="${pent(cx,cy,r*0.36,-Math.PI/2)}" fill="#151515"/>`;
  for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;const v=P(a,r*0.36),e=P(a,r*0.62);s+=`<line x1="${v[0].toFixed(2)}" y1="${v[1].toFixed(2)}" x2="${e[0].toFixed(2)}" y2="${e[1].toFixed(2)}" stroke="#151515" stroke-width="${(r*0.09).toFixed(2)}"/>`;
    const o=P(a+Math.PI/5,r*1.02);s+=`<polygon points="${pent(o[0],o[1],r*0.36,a+Math.PI/5+Math.PI)}" fill="#151515"/>`;
    const e2=P(a+Math.PI/5,r*0.62);s+=`<line x1="${e[0].toFixed(2)}" y1="${e[1].toFixed(2)}" x2="${e2[0].toFixed(2)}" y2="${e2[1].toFixed(2)}" stroke="#151515" stroke-width="${(r*0.09).toFixed(2)}"/>`;}
  s+=`</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#151515" stroke-width="1.6"/><ellipse cx="${cx-r*0.35}" cy="${cy-r*0.45}" rx="${r*0.28}" ry="${r*0.16}" fill="#fff" opacity=".55" transform="rotate(-30 ${cx-r*0.35} ${cy-r*0.45})"/>`;
  return s;}
function rankBadge(k,id){
  const [m,d,l,mk]=RB[k];const g=`rg${id||k}${RBN++}`;
  const defs=`<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l}"/><stop offset=".5" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></linearGradient></defs>`;
  const shield=`<path d="M32 5 L54 12 V30 C54 45 44 54 32 59 C20 54 10 45 10 30 V12 Z" fill="url(#${g})" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 9 L50 15 V30 C50 42 42 50 32 54.5" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.5"/>`;
  const chev=n=>{let s='';for(let i=0;i<n;i++){const y=43+i*5.5;s+=`<path d="M23 ${y} L32 ${y+4.5} L41 ${y}" fill="none" stroke="${mk}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;}return s;};
  const star=(x,y,r,f)=>{const pts=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.45:r;pts.push((x+rr*Math.cos(a)).toFixed(1)+','+(y+rr*Math.sin(a)).toFixed(1));}return `<polygon points="${pts.join(' ')}" fill="${f}" stroke="${mk}" stroke-width="1" stroke-linejoin="round"/>`;};
  let body='';
  if(k==='yeni'){body=`<circle cx="32" cy="32" r="26" fill="url(#${g})" stroke="${d}" stroke-width="2.5" stroke-dasharray="5 3.5"/>`+rbBall(32,29,13)+`<path d="M32 55 V46" stroke="#2f7d45" stroke-width="2.6" stroke-linecap="round"/><path d="M32 48 C27 47 24 44 24 41 C29 41 32 44 32 48 Z M32 48 C37 47 40 44 40 41 C35 41 32 44 32 48 Z" fill="#4fbf6c" stroke="#2f7d45" stroke-width="1"/>`;}
  else if(k==='bronz'){body=shield+rbBall(32,27,11.5)+chev(1);}
  else if(k==='gumus'){body=shield+rbBall(32,26,11)+chev(2);}
  else if(k==='altin'){body=shield+rbBall(32,26,11)+chev(2)+star(32,7,6.5,'#fff6c4');}
  else if(k==='platin'){const wing=s=>`<path d="M${32+s*21} 18 C${32+s*34} 14 ${32+s*35} 32 ${32+s*24} 42 C${32+s*29} 33 ${32+s*27} 27 ${32+s*21} 28 Z" fill="${l}" stroke="${d}" stroke-width="2" stroke-linejoin="round"/><path d="M${32+s*23} 22 C${32+s*29} 22 ${32+s*30} 28 ${32+s*27} 33" fill="none" stroke="${d}" stroke-width="1.2"/>`;
    body=wing(-1)+wing(1)+shield+rbBall(32,26,11)+chev(2)+star(32,7,6.5,'#eafffc');}
  else if(k==='elmas'){body=`<path d="M32 2 L60 32 L32 62 L4 32 Z" fill="url(#${g})" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 2 L45 32 L32 62 M32 2 L19 32 L32 62 M4 32 H60" stroke="#fff" stroke-opacity=".35" stroke-width="1.3" fill="none"/>`+rbBall(32,31,12)+star(32,52,5,'#ffffff')+star(13,32,4,'#ffffff')+star(51,32,4,'#ffffff');}
  else if(k==='usta'){let lau='';for(const sd of [-1,1]){lau+=`<path d="M${32+sd*8} 60 C${32+sd*26} 56 ${32+sd*30} 40 ${32+sd*27} 20" fill="none" stroke="#8a6200" stroke-width="1.6"/>`;
      for(let i=0;i<5;i++){const t=i/4;const a=(105+t*95)*Math.PI/180;const X=32+sd*(-27*Math.cos(a)),Y=36+27*Math.sin(a)*0.95;const rot=sd*((105+t*95)-90+30);
        lau+=`<ellipse cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" rx="2.5" ry="5.6" transform="rotate(${rot.toFixed(0)} ${X.toFixed(1)} ${Y.toFixed(1)})" fill="#ffd54a" stroke="#8a6200" stroke-width=".9"/>`;}}
    body=lau+shield+rbBall(32,29,11)+chev(2)+`<path d="M20 14 L22.5 3 L28 9.5 L32 1.5 L36 9.5 L41.5 3 L44 14 Z" fill="#ffd54a" stroke="#8a6200" stroke-width="1.6" stroke-linejoin="round"/><circle cx="32" cy="2" r="1.8" fill="#ff5a7a"/><circle cx="22.5" cy="3.5" r="1.2" fill="#7fd3ff"/><circle cx="41.5" cy="3.5" r="1.2" fill="#7fd3ff"/>`;}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 72 72" width="64" height="64">${defs}${body}</svg>`;}

const RKEY={'Yerleşiyor':'yeni','Bronz':'bronz','Gümüş':'gumus','Altın':'altin','Platin':'platin','Elmas':'elmas','Usta':'usta'};
const rankSvg=n=>{const k=RKEY[n]||'yeni';return `<img src="assets/ranks/${k}.webp" alt="" draggable="false">`;};
function rankEl(r,g,short){const k=rankOf(r,g);const s=document.createElement('span');s.className='rk'+(short?' sm':'');s.style.setProperty('--rk',k.c);const pl=k.n==='Yerleşiyor';
  s.innerHTML=rankSvg(k.n);if(short!==true||pl){const t=document.createElement('b');t.textContent=pl?'Yeni':short==='name'?k.n:k.n+' '+k.r;s.appendChild(t);}
  s.title=pl?`Yeni oyuncu: ilk 5 maçını oynayınca rütbesi belli olur (${Math.min(5,Number(g)||0)}/5)`:k.n+' rütbesi · '+k.r+' beceri puanı';return s;}

// ---------- Arkadaşlar ve davet ----------
let FRIENDS=[],FR_AT=0;
const frPing=u=>{try{NET.lobby&&NET.lobby.send('frq',{to:u});}catch(e){}};
async function loadFriends(force){if(!force&&Date.now()-FR_AT<45000)return;FR_AT=Date.now();try{FRIENDS=(await DB.friends())||[];}catch(e){}renderFriends();}
const isFriend=u=>FRIENDS.some(f=>f.id===u&&f.status==='accepted');
function friendPresence(u){if(!NET.lobby)return null;return named(NET.lobby.peers()).find(p=>p.presence.u===u)||null;}
function renderFriends(){
  const box=$('friendList');if(!box)return;box.innerHTML='';
  const inc=FRIENDS.filter(f=>f.incoming),acc=FRIENDS.filter(f=>f.status==='accepted'),out=FRIENDS.filter(f=>f.status==='pending'&&!f.incoming);
  if(!FRIENDS.length){box.innerHTML='<p class="note">Henüz arkadaşın yok. Bir oyuncuya dokunup "Arkadaş ekle" de; online olduğunda burada görürsün, odana davet edebilirsin.</p>';return;}
  const row=(f,state,btns)=>{const d=document.createElement('div');d.className='frow';const av=document.createElement('span');av.className='av';av.textContent=cleanStr(f.avatar||'',2)||'?';
    const nm=document.createElement('b');nm.textContent=cleanBad(cleanStr(f.nick||'Oyuncu',14));if(f.name_color)nm.style.color=cleanCol(f.name_color);
    const st=document.createElement('small');st.textContent=state.t;st.className=state.c||'';const a=document.createElement('div');a.className='fact';btns.forEach(x=>a.appendChild(x));d.append(av,nm,st,a);box.appendChild(d);};
  const B=(t,fn,cls)=>{const b=document.createElement('button');b.className='chip'+(cls?' '+cls:'');b.textContent=t;b.onclick=fn;return b;};
  inc.forEach(f=>row(f,{t:'arkadaşlık isteği',c:'inc'},[B('Kabul et',async()=>{await DB.friendRespond(f.id,true).catch(()=>{});frPing(f.id);loadFriends(true);},'go'),B('Reddet',async()=>{await DB.friendRespond(f.id,false).catch(()=>{});loadFriends(true);})]));
  acc.map(f=>({f,p:friendPresence(f.id)})).sort((x,y)=>(y.p?1:0)-(x.p?1:0)).forEach(({f,p})=>{
    const pr=p&&p.presence;const st=!pr?{t:'çevrimdışı',c:'off'}:pr.inRoom?{t:'odada',c:'on'}:{t:'lobide',c:'on'};const btns=[];
    if(pr&&pr.rc&&pr.rc!==NET.code)btns.push(B('Odasına git',()=>enterRoom(pr.rc)));
    btns.push(B('İstatistik',()=>openStats(f.id,f.nick||'Oyuncu','')));row(f,st,btns);});
  out.forEach(f=>row(f,{t:'istek gönderildi',c:'off'},[B('Geri al',async()=>{await DB.friendRemove(f.id).catch(()=>{});loadFriends(true);})]));
}
function openInvite(){
  const m=$('invPanel');m.hidden=!m.hidden;if(m.hidden)return;m.innerHTML='';
  const h=document.createElement('b');h.textContent='Arkadaşını davet et';m.appendChild(h);
  const here=new Set(named(NET.room?NET.room.peers():[]).map(p=>p.presence.u));
  const on=FRIENDS.filter(f=>f.status==='accepted').map(f=>({f,p:friendPresence(f.id)})).filter(x=>x.p&&!here.has(x.f.id));
  if(!on.length){const n=document.createElement('p');n.className='note';n.textContent=FRIENDS.some(f=>f.status==='accepted')?'Şu an çevrimiçi arkadaşın yok. Oda kodunu paylaşabilirsin: '+NET.code:'Henüz arkadaşın yok. Oda kodunu paylaş: '+NET.code;m.appendChild(n);}
  on.forEach(({f})=>{const b=document.createElement('button');b.className='chip';b.textContent=(f.nick||'Oyuncu')+' · Davet et';b.onclick=()=>{sendInvite(f.id);b.textContent=(f.nick||'Oyuncu')+' · Davet gönderildi ✓';b.disabled=true;};m.appendChild(b);});
}
function sendInvite(to){if(!NET.lobby||!NET.room)return;const v=roomView()||{cfg:{}};NET.lobby.send('inv',{to,from:uid,nick:prof.name,code:NET.code,room:cleanStr(v.cfg.name||'',28)});
  const online=named(NET.lobby.peers()).some(p=>p.presence.u===to);if(!online)DB.pushInvite(to,NET.code,cleanStr(v.cfg.name||'',28)).catch(()=>{});}
function onInvite(d){
  if(!d||d.to!==uid||typeof d.code!=='string'||!/^[a-z0-9]{4}$/.test(d.code)||!isFriend(d.from)||isMuted(d.from)||d.code===NET.code)return;
  const t=$('invToast');t.innerHTML='';const s=document.createElement('span');s.textContent=`${cleanBad(cleanStr(d.nick,14))} seni ${d.room?'"'+cleanBad(cleanStr(d.room,28))+'" ':''}odasına çağırıyor`;
  const j=document.createElement('button');j.className='chip go';j.textContent='Katıl';j.onclick=()=>{t.hidden=true;if(G&&!G.net)G=null;enterRoom(d.code);};
  const x=document.createElement('button');x.className='chip';x.textContent='Kapat';x.onclick=()=>t.hidden=true;
  t.append(s,j,x);t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,25000);try{sKick(0.6);}catch(e){}
}

// ---------- Sohbet ----------
function sendChat(scope,text){
  text=cleanStr(text,80).trim();if(!text)return;
  if(MOD.muted_until&&new Date(MOD.muted_until)>new Date()&&!text.startsWith('📣')){chatNotice(scope,'Birkaç oyuncu seni şikâyet ettiği için sohbetin '+new Date(MOD.muted_until).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})+"'e kadar kapalı.");return;}
  const now=Date.now();if(now-NET.lastChatAt<600)return;
  if(text===NET.lastChatText&&now-NET.lastChatAt<5000)return; // aynı mesajı arka arkaya basma
  NET.lastChatAt=now;NET.lastChatText=text;text=cleanBad(text);
  const arr=scope==='lobby'?NET.lobbyChat:NET.roomChat;
  arr.push([++NET.seq,text]);while(arr.length>6)arr.shift();
  if(scope==='lobby')pushLobby();else pushRoom();
}
function renderChat(scope,room,logEl){
  if(!room)return[];const log=NET.logs[scope];let fresh=[];
  for(const p of named(room.peers())){const ch=p.presence.chat;if(!Array.isArray(ch))continue;
    for(const m of ch){if(!Array.isArray(m)||typeof m[0]!=='number')continue;const key=p.peer+':'+m[0];
      if(!log.has(key)){const e={nick:cleanBad(cleanStr(p.presence.nick,14)),tg:cleanTag(p.presence.tg),text:cleanBad(cleanStr(m[1],80)),me:p.sameTab,peer:p.peer,u:p.presence.u,col:cleanCol(p.presence.nc)};log.set(key,e);if(!isMuted(e.u))fresh.push(e);}}}
  while(log.size>80)log.delete(log.keys().next().value);
  if(!logEl)return fresh;
  if(fresh.length||!logEl.childElementCount){
    const atBottom=logEl.scrollHeight-logEl.scrollTop-logEl.clientHeight<30;
    logEl.innerHTML='';
    if(!log.size){const d=document.createElement('div');d.className='m sys';d.textContent='Henüz mesaj yok.';logEl.appendChild(d);}
    for(const e of log.values()){if(isMuted(e.u))continue;const d=document.createElement('div');d.className='m';const b=nickEl(e.tg,e.nick+':',e.me?'var(--flood)':e.col);d.appendChild(b);d.appendChild(document.createTextNode(e.text));logEl.appendChild(d);}
    if(atBottom||fresh.some(e=>e.me))logEl.scrollTop=logEl.scrollHeight;
  }
  return fresh;
}
function chatNotice(scope,t){const el=scope==='lobby'?$('lcLog'):$('rcLog');if(!el)return;const d=document.createElement('div');d.className='m sys';d.textContent=t;el.appendChild(d);el.scrollTop=el.scrollHeight;if(G&&G.net)pushGameChat({nick:'',text:t,col:'#f2c230'});}
$('lcForm').addEventListener('submit',e=>{e.preventDefault();sendChat('lobby',$('lcIn').value);$('lcIn').value='';});
$('rcForm').addEventListener('submit',e=>{e.preventDefault();sendChat('room',$('rcIn').value);$('rcIn').value='';});
QUICK.forEach(q=>{const b=document.createElement('button');b.className='chip';b.type='button';b.textContent=q;b.onclick=()=>sendChat('room',q);$('rcQuick').appendChild(b);});

// ---------- Oda kurma / girme / çıkma ----------
function bindDraft(id,key,num=true){const box=$(id);const sync=()=>box.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(String(roomDraft[key])===c.dataset.v)));
  box.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{roomDraft[key]=num?Number(c.dataset.v):c.dataset.v;sync();});sync();}
bindDraft('rdMap','map',false);bindDraft('rdMode','mode',false);
{const upd=()=>{const m=MODES[roomDraft.mode];$('rdModeNote').textContent=m&&m.d?m.d+' · eğlence modu, beceri puanını etkilemez.':'Dereceli: beceri puanı ve istatistiklere sayılır.';};$('rdMode').addEventListener('click',()=>setTimeout(upd,0));upd();}bindDraft('rdMax','max');bindDraft('rdTime','time');bindDraft('rdGoals','goals');
function createRoom(cfg){
  if(leaveBanLeft()){$('netMsg').textContent=leaveBanMsg();showMain('rooms');return;}
  NET.isHost=true;
  NET.cfg={kits:[0,1],free:true,skin:SKINS[prof.skin]?prof.skin:'classic',...cfg};
  NET.teams={};NET.wantSeen={};NET.bots=[];NET.phase='lobby';NET.ro=null;NET.want='red';NET.qStarted=false;
  enterRoom(cfg.code||randCode());
}
$('createRoom').onclick=()=>createRoom({name:cleanStr($('inRoomName').value,28).trim()||(prof.name+' odası'),map:roomDraft.map,max:roomDraft.max,time:roomDraft.time,goals:roomDraft.goals,mode:roomDraft.mode,priv:$('rdPriv').checked});
$('joinCode').onclick=()=>{const c=cleanStr($('inCode').value,6).toLowerCase().replace(/[^a-z0-9]/g,'');if(c.length===4)enterRoom(c);else $('netMsg').textContent='Oda kodu 4 karakter olmalı.';};
$('quickBtn').onclick=()=>{ // en kalabalık, yeri olan, lobideki odaya gir; yoksa oda aç
  const sc=r=>(r.n||0)*120-Math.abs((Number(r.ar)||1000)-MYR.r)*0.6;
  const r=lobbyRooms().filter(r=>r.ph!=='game'&&(r.n||0)<(r.max||0)).sort((a,b)=>sc(b)-sc(a))[0]
       ||lobbyRooms().filter(r=>(r.n||0)<(r.max||0)).sort((a,b)=>(b.n||0)-(a.n||0))[0];
  if(r){NET.want='red';enterRoom(r.code,true);}
  else createRoom({name:prof.name+' · hızlı maç',map:'classic',max:4,time:180,goals:3,priv:false});
};
// ---------- Dereceli eşleştirme sırası ----------
// Sıradakiler lobi varlığında q:{m,t} yayınlar. En eski bekleyen "lider"dir: puanı kendisine en yakın 2m oyuncuyu seçer,
// gizli bir oda açar ve seçilenlere 'qm' ile oda kodunu yollar. Puan aralığı bekledikçe genişler.
const QWIN=s=>Math.min(1000,120+s*8);
function queuePeers(m){if(!NET.lobby)return[];const seen=new Set();
  return named(NET.lobby.peers()).filter(p=>p.presence.q&&Number(p.presence.q.m)===m&&!p.presence.inRoom&&typeof p.presence.u==='string')
    .filter(p=>!seen.has(p.presence.u)&&seen.add(p.presence.u)).map(p=>({u:p.presence.u,r:Number(p.presence.r)||1000,t:Number(p.presence.q.t)||Date.now(),nick:p.presence.nick}))
    .sort((a,b)=>a.t-b.t||(a.u<b.u?-1:1));}
function startQueue(m){
  if(leaveBanLeft()){$('netMsg').textContent=leaveBanMsg();return;}
  if(NET.state!=='on'||NET.room)return;
  NET.queue={m,t:Date.now()};pushLobby();renderQueue();}
function stopQueue(){NET.queue=null;pushLobby();renderQueue();}
function renderQueue(){const q=NET.queue;$('rqBtns').hidden=!!q;$('rqWait').hidden=!q;
  document.querySelectorAll('#rqBtns button').forEach(b=>b.disabled=NET.state!=='on');
  if(!q)return;const s=Math.floor((Date.now()-q.t)/1000);const n=queuePeers(q.m).length;
  $('rqTxt').textContent=`${q.m}v${q.m} aranıyor · ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} · sırada ${Math.max(n,1)}/${q.m*2} oyuncu · ±${QWIN(s)} puan`;}
document.querySelectorAll('#rqBtns button').forEach(b=>b.onclick=()=>startQueue(Number(b.dataset.m)));
$('rqCancel').onclick=stopQueue;
setInterval(()=>{const q=NET.queue;if(!q)return;renderQueue();if(NET.room||!NET.lobby)return;
  const ps=queuePeers(q.m);if(!ps.length||ps[0].u!==uid)return; // lider değilim
  const need=q.m*2;if(ps.length<need)return;
  const me=ps[0],now=Date.now();
  const pick=[me,...ps.slice(1).filter(p=>Math.abs(p.r-me.r)<=Math.max(QWIN((now-me.t)/1000),QWIN((now-p.t)/1000))).sort((a,b)=>Math.abs(a.r-me.r)-Math.abs(b.r-me.r)).slice(0,need-1)];
  if(pick.length<need)return;
  // takımları puana göre yılan sırasıyla dengele (1-4 / 2-3 ...)
  const srt=[...pick].sort((a,b)=>b.r-a.r);const qt={};srt.forEach((p,i)=>{const k=i%4;qt[p.u]=(k===0||k===3)?'red':'blue';});
  if(need===2){qt[srt[0].u]='red';qt[srt[1].u]='blue';}
  const code=randCode();
  NET.lobby.send('qm',{code,m:q.m,uids:pick.map(p=>p.u)});
  NET.queue=null;renderQueue();
  createRoom({name:`Dereceli ${q.m}v${q.m}`,map:q.m===3?'big':'classic',max:need,time:180,goals:3,priv:true,free:false,code,qteams:qt,qAt:Date.now()});
},1500);
function onQueueMatch(d){
  if(!d||!NET.queue||!Array.isArray(d.uids)||!d.uids.includes(uid)||typeof d.code!=='string'||!/^[a-z0-9]{4}$/.test(d.code))return;
  NET.queue=null;renderQueue();$('netMsg').textContent='Rakipler bulundu! Maça bağlanılıyor…';
  setTimeout(()=>{NET.watch=false;enterRoom(d.code);},1200);}
// host: dereceli odada herkes gelince (ya da 25 sn sonra yeterli oyuncu varsa) maçı kendisi başlatır
setInterval(()=>{if(!NET.room||!NET.isHost||!NET.cfg||!NET.cfg.qteams||NET.phase!=='lobby'||NET.qStarted)return;
  const want=Object.keys(NET.cfg.qteams);const ps=named(NET.room.peers());const here=new Set(ps.map(p=>p.presence.u));
  const all=want.every(u=>here.has(u));const age=Date.now()-(NET.cfg.qAt||0);
  const red=ps.some(p=>NET.teams[p.peer]==='red'),blue=ps.some(p=>NET.teams[p.peer]==='blue');
  if(all||(age>25000&&red&&blue)){NET.qStarted=true;sendSys(all?'Herkes geldi, maç 3 saniye içinde başlıyor!':'Bazı oyuncular gelmedi, eksik kadroyla başlıyor.');
    setTimeout(()=>{if(NET.room&&NET.isHost&&NET.phase==='lobby')$('hsStart').click();},3000);}
  else if(age>40000){closeRoom('Rakipler odaya bağlanamadı. Yeniden sıraya girebilirsin.','end');}
},1000);
async function enterRoom(code,autoTeam){
  if(!NET.lobby)return;
  if(leaveBanLeft()&&!NET.watch){$('netMsg').textContent=leaveBanMsg();showMain('rooms');return;}
  if(NET.queue){NET.queue=null;renderQueue();}
  if(NET.room)await leaveRoom(true);
  const room=makeRoom('uzk-r-'+code);
  $('netMsg').textContent='Odaya bağlanılıyor…';
  const ok=await room.ready;
  if(!ok){NET.isHost=false;room.leave();$('netMsg').textContent='Odaya bağlanılamadı. Tekrar dene.';return;}
  $('netMsg').textContent='';
  NET.room=room;NET.code=code;NET.roomChat=[];NET.logs.room=new Map();NET.ready=false;NET.joinedAt=Date.now();NET.hostSeenAt=0;NET.roKey=null;NET.snap=null;NET.snapN=-1;NET.menuFor=null;NET.inputs={};
  if(!NET.isHost){NET.want=autoTeam?(Math.random()<0.5?'red':'blue'):'spec';}
  rtcReset();
  room.on('sig',rtcOnSignal);
  room.on('g',d=>{if(!NET.isHost&&d&&d.to===undefined)acceptSnap(d);});
  room.on('rv',d=>onRematch(d));
  room.on('afkw',d=>{if(d&&d.to===TAB&&G&&G.net)afkToast('Hareket etmiyorsun! 10 saniye içinde hareket etmezsen izleyiciye alınacaksın ve ceza alacaksın.',8000);});
  room.on('in',d=>{if(NET.isHost&&d&&typeof d.from==='string'&&Array.isArray(d.q))NET.inputs[d.from]=d.q;});
  room.onPeers(()=>schedule(onRoomPeers));
  pushRoom();pushLobby();
  $('rCode').textContent=code;show('roomScr');renderRoom();
}
async function leaveRoom(silent,why){
  const r=NET.room;if(!r)return;
  if(inRankedMatch()){if(why)clearRanked(why);else await penalizeLeave();}
  NET.room=null;NET.isHost=false;NET.cfg=null;NET.watch=false;NET.ro=null;NET.phase='lobby';NET.roKey=null;
  if(G&&G.net){G=null;}
  rtcReset();
  try{await r.leave();}catch(e){}
  pushLobby();
  if(!silent){showMain('rooms');}
}
function closeRoom(msg,why='host'){leaveRoom(false,why).then(()=>{$('netMsg').textContent=msg;});}
$('leaveRoom').onclick=()=>{if(inRankedMatch()&&!confirmLeave())return;leaveRoom(false);};
$('copyCode').onclick=()=>{const t=NET.code||'';const done=ok=>{const b=$('copyCode');b.textContent=ok?'Kopyalandı':'Kod: '+t;setTimeout(()=>{b.innerHTML='Kod: <b id="rCode"></b>';$('rCode').textContent=NET.code||'';},1400);};
  try{navigator.clipboard.writeText(t).then(()=>done(true),()=>done(false));}catch(e){done(false);}};

function pushRoom(){
  if(!NET.room)return;
  const pr={pn:NET.isHost?0:(NET.ping||0),nick:prof.name,av:prof.avatar,nc:prof.nameColor,tg:myTag(),u:uid,cel:prof.cel,tr:prof.trail,r:MYR.r,rg:MYR.g,sr:bestTier(),qm:QSTARS>=30?1:0,tid:myTeamCache&&myTeamCache.team?myTeamCache.team.id:'',want:NET.want,ready:NET.ready,chat:NET.roomChat};
  if(NET.isHost)Object.assign(pr,{H:1,hs:NET.hostSince||0,lq:Math.round(avgPing()/50)*50,afk:NET.afk||[],mid:NET.mid||'',code:NET.code,cfg:NET.cfg,teams:NET.teams,bots:NET.bots,phase:NET.phase,ro:NET.ro});
  NET.room.presence(pr);
}
const hostPeerOf=r=>r?named(r.peers()).find(p=>p.presence.H===1&&p.presence.code===NET.code):null;
function roomAvgR(){if(!NET.room)return MYR.r;const rs=named(NET.room.peers()).map(p=>Number(p.presence.r)||1000);return rs.length?Math.round(rs.reduce((a,b)=>a+b,0)/rs.length):MYR.r;}
function hostHumanCount(){if(!NET.room)return 0;return named(NET.room.peers()).filter(p=>{const t=NET.teams[p.peer];return t!=='full'&&t!=='kicked';}).length;}

// ---------- Host: takım düzeni ----------
function hostReconcile(){
  const ps=named(NET.room.peers());const ids=new Set(ps.map(p=>p.peer));const T=NET.teams;let ch=false;
  NET.peerUid=NET.peerUid||{};NET.away=NET.away||{};
  const inGame=NET.phase==='game'&&G&&G.net&&G.net.role==='host';
  for(const k of Object.keys(T))if(!ids.has(k)){
    if(inGame){const pl=G.players.find(x=>x.pid===k&&x.human&&!x.local);const u=NET.peerUid[k];
      if(pl){pl.human=false;pl.remote=false;pl.away=true;if(u)NET.away[u]={pid:k,at:Date.now()};sendSys(`${pl.name} bağlantısı koptu; dönene kadar yerine bot oynuyor.`);}}
    delete T[k];delete NET.wantSeen[k];delete NET.inputs[k];rtcDrop(k);ch=true;}
  for(const p of ps){if(p.presence.u)NET.peerUid[p.peer]=p.presence.u;}
  for(const p of ps){
    if(!(p.peer in T)){const n=Object.values(T).filter(v=>v!=='full'&&v!=='kicked').length;T[p.peer]=n>=NET.cfg.max+8?'full':'spec';ch=true;}
    if(Array.isArray(NET.cfg.bans)&&p.presence.u&&NET.cfg.bans.includes(p.presence.u)&&T[p.peer]!=='kicked'&&!p.sameTab){T[p.peer]='kicked';ch=true;}
    if(inGame&&!p.sameTab&&p.presence.u&&NET.away[p.presence.u]&&T[p.peer]!=='kicked'){const a=NET.away[p.presence.u];const pl=G.players.find(x=>x.pid===a.pid);
      if(pl){pl.pid=p.peer;pl.human=true;pl.remote=true;pl.away=false;pl.afk=false;pl.lastActTick=G.tick;T[p.peer]=pl.team?'blue':'red';NET.wantSeen[p.peer]=p.presence.want;
        const r=(NET.ro||[]).find(r=>r[0]===a.pid);if(r)r[0]=p.peer;sendSys(`${pl.name} maça geri döndü.`);}
      delete NET.away[p.presence.u];ch=true;}
    if(NET.cfg.qteams&&NET.phase==='lobby'&&T[p.peer]!=='full'&&T[p.peer]!=='kicked'){const want=NET.cfg.qteams[p.presence.u]||'spec';if(T[p.peer]!==want){T[p.peer]=want;ch=true;}}
    if(NET.cfg.lteam&&NET.phase==='lobby'&&T[p.peer]!=='full'&&T[p.peer]!=='kicked'){const tid=p.presence.tid;const want=tid&&tid===NET.cfg.home?'red':tid&&tid===NET.cfg.away?'blue':'spec';if(T[p.peer]!==want){T[p.peer]=want;ch=true;}}
    const w=p.presence.want;
    if(!NET.cfg.lteam&&!NET.cfg.qteams&&(w==='red'||w==='blue'||w==='spec')&&NET.wantSeen[p.peer]!==w){NET.wantSeen[p.peer]=w;
      const pc=Object.entries(T).filter(([k,v])=>k!==p.peer&&(v==='red'||v==='blue')).length+NET.bots.length;
      if((NET.cfg.free||p.sameTab)&&NET.phase==='lobby'&&T[p.peer]!=='full'&&T[p.peer]!=='kicked'&&T[p.peer]!==w&&(w==='spec'||T[p.peer]==='red'||T[p.peer]==='blue'||pc<NET.cfg.max)){T[p.peer]=w;ch=true;}}
    if(!p.sameTab&&T[p.peer]!=='full'&&T[p.peer]!=='kicked')rtcHostEnsure(p.peer);
  }
  return ch;
}
function onRoomPeers(){
  if(!NET.room)return;
  if(NET.isHost){if(checkDualHost())return onRoomPeers();if(hostReconcile())pushRoom();pushLobby();}
  else{
    const h=hostPeerOf(NET.room);
    if(h){if(NET.lastHost&&NET.lastHost.peer!==h.peer)NET.hostChangeAt=performance.now();NET.hostSeenAt=Date.now();NET.migrateAt=0;rememberHost(h);const t=h.presence.teams&&h.presence.teams[TAB];
      if(t==='kicked'){clearRanked('kick');const bans=(hostPeerOf(NET.room)||{presence:{cfg:{}}}).presence.cfg?.bans;closeRoom(Array.isArray(bans)&&bans.includes(uid)?'Bu odaya girmen oda sahibi tarafından yasaklandı.':'Oda sahibi seni odadan çıkardı.');return;}
      if(t==='full'){closeRoom('Oda dolu.');return;}
      if(Array.isArray(h.presence.afk)&&h.presence.afk.includes(TAB)&&G&&G.ranked){penalizeLeave();afkToast('Hareketsiz kaldığın için izleyiciye alındın: −20 beceri puanı ve 1 dakika maç bulma cezası.',9000);}
      clientSync(h);}
  }
  const fresh=renderChat('room',NET.room,$('rcLog'))||[];
  if(G&&G.net){const now=performance.now();for(const e of fresh){G.bubbles[e.peer]={text:e.text,until:now+4200};pushGameChat(e);}}
  renderRoom();
}
setInterval(()=>{ // oda sahibi gitti mi?
  if(!NET.room||NET.isHost)return;const now=Date.now();
  // oda sahibi görünüyorsa saati her saniye tazele: varlık bilgisi güncellenirken (ör. maç başlarken) bir an kaybolması odayı kapatmasın
  if(hostPeerOf(NET.room)){NET.hostSeenAt=now;return;}
  if(!NET.hostSeenAt&&now-NET.joinedAt>10000){if(NET.rejoining===NET.code)clearLastMatch();closeRoom(NET.rejoining===NET.code?'Maç sona ermiş ya da oda kapanmış.':'Bu kodla açık bir oda bulunamadı.');return;}
  if(NET.hostSeenAt&&now-NET.hostSeenAt>3000&&NET.lastHost){if(!NET.migrateAt)NET.migrateAt=now;if(successorIsMe()){promoteToHost();return;}}
  if(NET.hostSeenAt&&now-NET.hostSeenAt>15000)closeRoom('Oda sahibi ayrıldı ve oda devralınamadı, oda kapandı.');
},1000);

// ---------- Gecikme ölçümü ve oda sahibi devri ----------
setInterval(()=>{if(!NET.room||NET.isHost)return;const h=hostPeerOf(NET.room);const dc=h&&dcOpen(h.peer);if(dc){try{dc.send(JSON.stringify({pi:performance.now()}));}catch(e){}}else if(h)NET.ping=0;},2000);
setInterval(()=>{if(NET.room&&!NET.isHost&&NET.ping&&(Math.abs(NET.ping-(NET.pnSent||0))>40||Date.now()-(NET.pnAt||0)>30000)){NET.pnSent=NET.ping;NET.pnAt=Date.now();pushRoom();}if(NET.room&&NET.isHost)pushLobby();},6000);
const pingCls=ms=>ms<80?'good':ms<160?'ok':'bad';
function pingEl(ms){const e=document.createElement('span');e.className='ping '+pingCls(ms);e.textContent=ms+' ms';e.title='Gecikme (ping)';return e;}
function avgPing(){if(!NET.room)return 0;const a=named(NET.room.peers()).filter(p=>!p.presence.H&&p.presence.pn>0).map(p=>p.presence.pn);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;}
function rememberHost(h){const pr=h.presence;NET.lastHost={peer:h.peer,cfg:pr.cfg,teams:pr.teams||{},bots:Array.isArray(pr.bots)?pr.bots:[],phase:pr.phase,ro:pr.ro};}
function successorIsMe(){
  const L=NET.lastHost;if(!L||!NET.room)return false;
  const c=named(NET.room.peers()).filter(p=>p.peer!==L.peer&&L.teams[p.peer]!=='full'&&L.teams[p.peer]!=='kicked'&&(p.peer in L.teams||p.sameTab));
  if(!c.length)return false;
  c.sort((a,b)=>((a.presence.pn||999)-(b.presence.pn||999))||(a.peer<b.peer?-1:1));
  return c[0].sameTab;
}
function checkDualHost(){ // iki kişi aynı anda devraldıysa önce devralan kalır
  const o=named(NET.room.peers()).find(p=>!p.sameTab&&p.presence.H===1&&p.presence.code===NET.code);
  if(!o)return false;const oh=o.presence.hs||0,mh=NET.hostSince||0;
  if(oh<mh||(oh===mh&&o.peer<TAB)){NET.isHost=false;NET.hostSince=0;NET.roKey=null;if(G&&G.net)G=null;rtcReset();pushRoom();sendSys&&0;return true;}
  return false;
}
function promoteToHost(){
  const L=NET.lastHost;if(!L||!L.cfg)return;
  NET.isHost=true;NET.hostSince=Date.now();NET.migrateAt=0;rtcReset();
  NET.cfg={...L.cfg};NET.teams={...L.teams};delete NET.teams[L.peer];NET.wantSeen={};NET.inputs={};NET.bots=L.bots.map(b=>({...b}));NET.phase=L.phase||'lobby';
  NET.botN=Math.max(NET.botN||0,...NET.bots.map(b=>Number(String(b.id).slice(1))||0));
  for(const k of Object.keys(NET.teams)){if(NET.teams[k]==='full')NET.teams[k]='spec';}
  if(NET.phase==='game'&&Array.isArray(L.ro)&&G&&G.net){
    const snap=NET.lastSnap||NET.snap||{};const old=G;
    const ro=L.ro.map(r=>{const x=[...r];if(x[0]===L.peer)x[5]=0;return x;}).filter(r=>r[1]===0||r[1]===1);
    const roster=ro.map(r=>({pid:String(r[0]),team:r[1],human:!!r[5],local:r[0]===TAB,remote:!!r[5]&&r[0]!==TAB,avatar:cleanStr(r[2],2),name:cleanBad(cleanStr(r[3],14))+(r[0]===L.peer?' (bot)':''),nameColor:cleanCol(r[4]),tag:cleanTag(r[6]),cel:cleanCel(r[7]),rating:Number(r[8])||1000,trail:cleanTrail(r[9]),sr:cleanTier(r[10])}));
    const mt=NET.teams[TAB];const watching=!$('game').hidden;
    startMatch({roster,map:NET.cfg.map,kits:[kitOf(NET.cfg.kits[0]),kitOf(NET.cfg.kits[1])],time:NET.cfg.time,goals:NET.cfg.goals,skin:NET.cfg.skin,mode:NET.cfg.mode,net:{role:'host'},myTeam:mt==='red'?0:mt==='blue'?1:-1,diff:1,silent:1});
    G.players.forEach((p,i)=>{const op=old.players[i];if(op){p.x=op.x;p.y=op.y;p.g=op.g||0;p.a=op.a||0;}const v=Array.isArray(snap.v)&&snap.v[i];if(v){p.vx=v[0]/100;p.vy=v[1]/100;}});
    G.ball.x=old.ball.x;G.ball.y=old.ball.y;if(Array.isArray(snap.bv)){G.ball.vx=snap.bv[0]/100;G.ball.vy=snap.bv[1]/100;}
    G.score=[...old.score];G.clock=old.clock;G.golden=!!old.golden;G.kickoff=snap.ko===1;G.kickTeam=snap.kt===1?1:0;
    G.state=snap.st==='goal'?'goal':'play';G.stateT=Number(snap.stt)||0;G.gseq=Number(snap.gs)||0;G.kseq=Number(snap.ks)||0;G.ranked=old.ranked;G.mid=old.mid;NET.mid=old.mid;G.goals=old.goals||[];G.rec=old.rec||[];
    if(!watching)show('roomScr');
    NET.ro=ro;NET.pubN=(NET.snapN||0)+20;
  } else if(NET.phase==='game'){NET.phase='lobby';NET.ro=null;}
  pushRoom();pushLobby();hostReconcile();pushRoom();
  sendSys(`Oda sahibi ayrıldı. ${prof.name} odayı devraldı${NET.phase==='game'?', maç devam ediyor':''}.`);
  renderRoom();
}

// ---------- Hareketsiz (AFK) oyuncu ----------
const AFK_WARN=20*60,AFK_OUT=30*60;
function afkCheck(){
  if(!NET.room||NET.phase!=='game'||!G||G.state!=='play')return;
  for(const p of G.players){if(!p.human||!p.remote)continue;if(p.lastActTick==null){p.lastActTick=G.tick;continue;}
    const idle=G.tick-p.lastActTick;
    if(idle>AFK_WARN&&!p.afkWarned){p.afkWarned=true;NET.room.send('afkw',{to:p.pid});}
    if(idle<AFK_WARN)p.afkWarned=false;
    if(idle>AFK_OUT){p.human=false;p.remote=false;p.afk=true;NET.teams[p.pid]='spec';NET.afk=[...(NET.afk||[]),p.pid].slice(-20);
      sendSys(`${p.name} 30 saniyedir hareket etmediği için izleyiciye alındı; yerine bot oynuyor.`);pushRoom();}}
}
function afkToast(t,ms=5000){const el=$('afkToast');if(!el)return;el.textContent=t;el.hidden=false;clearTimeout(el._h);el._h=setTimeout(()=>el.hidden=true,ms);}
// ---------- Yarıda kalan maça dönüş ----------
const LASTM='uzk-lastmatch'+SLOT;
function setLastMatch(code){try{localStorage.setItem(LASTM,JSON.stringify({code,at:Date.now()}));}catch(e){}}
function clearLastMatch(){try{localStorage.removeItem(LASTM);}catch(e){}renderRejoin();}
function getLastMatch(){try{const m=JSON.parse(localStorage.getItem(LASTM)||'null');return m&&Date.now()-m.at<15*60e3&&/^[a-z0-9]{4}$/.test(m.code)?m:null;}catch(e){return null;}}
function renderRejoin(){const box=$('rejoinBox');if(!box)return;const m=getLastMatch();box.hidden=!m||!!NET.room;if(!m)return;box.innerHTML='';
  const t=document.createElement('span');t.textContent='Yarıda kalan bir maçın var. 15 dakika içinde dönersen ceza almazsın.';
  const b=document.createElement('button');b.className='big';b.textContent='Maça dön';b.onclick=()=>{NET.rejoining=m.code;enterRoom(m.code);};
  const x=document.createElement('button');x.className='chip';x.textContent='Dönmeyeceğim';x.onclick=async()=>{clearLastMatch();try{await DB.matchDone('leave');}catch(e){}refreshAfterLeave();$('netMsg').textContent='Maçı bıraktın: −20 beceri puanı ve 1 dakika maç bulma cezası.';};
  box.append(t,b,x);}

// ---------- Yönetici paneli ----------
let IS_ADMIN=false;
const REASON_TR={kufur:'Küfür',hile:'Hile',troll:'Troll',isim:'İsim',diger:'Diğer'};
const fmtDT=t=>t?new Date(t).toLocaleString('tr-TR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
async function openAdmin(){
  const ov=$('adminOv');ov.hidden=false;const B=$('adminBody');B.innerHTML='<p class="note">Yükleniyor…</p>';
  try{IS_ADMIN=await DB.adminRpc('is_admin');}catch(e){IS_ADMIN=false;}
  if(!IS_ADMIN){B.innerHTML='<h2>Yönetici girişi</h2><p class="note">Sana verilen yönetici kodunu yaz. Kod en fazla 3 cihazda kullanılabilir; girdiğin hesap kalıcı olarak yönetici olur.</p><form class="row" id="admForm"><input type="text" id="admCode" placeholder="UZK-…" autocomplete="off"><button class="chip go" type="submit">Giriş</button></form><p class="err" id="admErr"></p>';
    $('admForm').onsubmit=async e=>{e.preventDefault();try{const ok=await DB.adminRpc('claim_admin',{p_code:$('admCode').value.trim()});if(ok)openAdmin();else $('admErr').textContent='Kod geçersiz ya da kullanım hakkı bitmiş.';}catch(err){$('admErr').textContent=errText(err);}};return;}
  let d;try{d=await DB.adminRpc('admin_overview');}catch(e){B.innerHTML='';const p=document.createElement('p');p.className='err';p.textContent=errText(e);B.appendChild(p);return;}
  B.innerHTML='';const H=t=>{const h=document.createElement('h2');h.textContent=t;B.appendChild(h);};
  const st=document.createElement('div');st.className='stattiles';[['Oyuncu',d.stats.players],['Son 24 saat yeni',d.stats.new24],['Son 24 saat maç',d.stats.matches24],['Takım',d.stats.teams]].forEach(([l,v])=>{const t=document.createElement('div');const b=document.createElement('b');b.textContent=v;const s2=document.createElement('span');s2.textContent=l;t.append(b,s2);st.appendChild(t);});B.appendChild(st);
  const act=(id,nick)=>{const w=document.createElement('div');w.className='admact';
    [['1 saat',60],['1 gün',1440],['7 gün',10080],['Kalıcı',5256000]].forEach(([l,m])=>{const b=document.createElement('button');b.className='chip danger';b.textContent='Uzaklaştır: '+l;b.onclick=async()=>{const r=prompt(`${nick} — uzaklaştırma sebebi (oyuncuya gösterilir):`,'Kurallara aykırı davranış');if(r===null)return;try{await DB.adminRpc('admin_ban',{p_user:id,p_minutes:m,p_reason:r});openAdmin();}catch(e){alert(errText(e));}};w.appendChild(b);});
    return w;};
  adminShop(B);await adminUsage(B);await adminBugs(B);
  H('Şikâyetler (son 14 gün)');
  if(!d.reports.length){const p=document.createElement('p');p.className='note';p.textContent='Şikâyet yok.';B.appendChild(p);}
  d.reports.forEach(r=>{const c=document.createElement('div');c.className='admcard'+(r.reporters>=3?' hot':'');
    const h=document.createElement('div');h.className='admh';const n=document.createElement('b');n.textContent=r.nick||'?';const m=document.createElement('span');m.textContent=`${r.reporters} kişi · ${r.total} şikâyet · ${(r.reasons||[]).map(x=>REASON_TR[x]||x).join(', ')} · ${fmtDT(r.last_at)}`;h.append(n,m);c.appendChild(h);
    (r.contexts||[]).forEach(t=>{const q=document.createElement('div');q.className='admq';q.textContent='“'+t+'”';c.appendChild(q);});
    const a=act(r.id,r.nick);const ds=document.createElement('button');ds.className='chip';ds.textContent='Şikâyetleri temizle';ds.onclick=async()=>{await DB.adminRpc('admin_dismiss',{p_user:r.id}).catch(e=>alert(errText(e)));openAdmin();};a.appendChild(ds);c.appendChild(a);B.appendChild(c);});
  H('Sık maç terk edenler (son 7 gün, 2+)');
  if(!d.leavers.length){const p=document.createElement('p');p.className='note';p.textContent='Yok.';B.appendChild(p);}
  d.leavers.forEach(r=>{const c=document.createElement('div');c.className='admcard';const h=document.createElement('div');h.className='admh';const n=document.createElement('b');n.textContent=r.nick||'?';const m=document.createElement('span');m.textContent=`7 günde ${r.week} terk · son 24 saatte ${r.day}`;h.append(n,m);c.append(h,act(r.id,r.nick));B.appendChild(c);});
  H('Aktif uzaklaştırmalar');
  if(!d.bans.length){const p=document.createElement('p');p.className='note';p.textContent='Yok.';B.appendChild(p);}
  d.bans.forEach(r=>{const c=document.createElement('div');c.className='admcard';const h=document.createElement('div');h.className='admh';const n=document.createElement('b');n.textContent=r.nick||'?';const m=document.createElement('span');m.textContent=`${new Date(r.until).getFullYear()>2100?'kalıcı':fmtDT(r.until)+"'e kadar"} · ${r.reason||''}`;h.append(n,m);
    const u=document.createElement('button');u.className='chip';u.textContent='Uzaklaştırmayı kaldır';u.onclick=async()=>{await DB.adminRpc('admin_unban',{p_user:r.id}).catch(e=>alert(errText(e)));openAdmin();};const w=document.createElement('div');w.className='admact';w.appendChild(u);c.append(h,w);B.appendChild(c);});
  H('Oyuncu ara');
  const f=document.createElement('form');f.className='row';f.innerHTML='<input type="text" placeholder="Takma ad" autocomplete="off"><button class="chip go" type="submit">Ara</button>';const res=document.createElement('div');B.append(f,res);
  f.onsubmit=async e=>{e.preventDefault();res.innerHTML='';let L=[];try{L=await DB.adminRpc('admin_search',{p_q:f.querySelector('input').value.trim()});}catch(err){res.textContent=errText(err);return;}
    if(!L.length){res.innerHTML='<p class="note">Bulunamadı.</p>';}
    L.forEach(r=>{const c=document.createElement('div');c.className='admcard';const h=document.createElement('div');h.className='admh';const n=document.createElement('b');n.textContent=`${r.nick} (${r.avatar||'?'})`;const m=document.createElement('span');m.textContent=`puan ${r.rating??'—'} · ${r.reports} şikâyet · ${r.leaves} terk${r.banned_until?' · uzaklaştırılmış':''}`;h.append(n,m);c.append(h,act(r.id,r.nick));res.appendChild(c);});};
}
$('adminClose').onclick=()=>{$('adminOv').hidden=true;if(location.hash==='#admin')history.replaceState(null,'',location.pathname+location.search);};
function checkAdminRoute(){if(location.hash==='#admin'&&!$('main').hidden)openAdmin();}
addEventListener('hashchange',checkAdminRoute);

// ---------- Rekabet: seri, terfi, ezeli rakip, maçın oyuncusu, rövanş, haftalık tablo, oyuncu kartı ----------
var EXTRA={},RIVALS=null;
function loadExtra(){return DB.playerExtra(uid).then(x=>{EXTRA=x||{};renderMe();return EXTRA;}).catch(()=>EXTRA);}
function loadRivals(){return DB.myRivals().then(r=>{RIVALS=Array.isArray(r)?r:[];return RIVALS;}).catch(()=>RIVALS||[]);}
const teamLvl=xp=>{xp=Math.max(0,Number(xp)||0);const l=Math.floor((1+Math.sqrt(1+xp*4/25))/2);return {l,a:25*l*(l-1),b:25*(l+1)*l,xp};};
const rankName=b=>{const k=RANKS.find(x=>x[0]===Number(b));return k?k[1]:'üst rütbe';};
const rankCol=b=>{const k=RANKS.find(x=>x[0]===Number(b));return k?k[2]:'#f2c230';};
function promoEl(pr){const w=document.createElement('div');w.className='promo';w.style.setProperty('--rc',rankCol(pr.b));
  const t=document.createElement('b');t.textContent=`⬆️ ${rankName(pr.b)} terfi serisi`;const d=document.createElement('span');d.className='pdots';
  for(let i=0;i<3;i++){const x=document.createElement('i');const k=i<pr.w?'w':i<pr.w+pr.l?'l':'';x.className=k;d.appendChild(x);}
  const n=document.createElement('small');n.textContent=`3 maçtan 2'sini kazan, ${rankName(pr.b)} rütbesine çık (${pr.w} galibiyet, ${pr.l} mağlubiyet)`;w.append(t,d,n);return w;}
function rivalLine(r){const w=Number(r.w)||0,l=Number(r.l)||0,d=Number(r.d)||0;return `${w}G ${d}B ${l}M`+(w>l?' · öndesin':w<l?' · gerideysin':' · berabersiniz');}
async function renderCompete(box){
  const sec=document.createElement('div');sec.className='compete';box.appendChild(sec);
  const [x,rv]=await Promise.all([loadExtra(),loadRivals()]);
  const tiles=document.createElement('div');tiles.className='ctiles';
  const tile=(ic,val,lbl,sub,cls='')=>{const t=document.createElement('div');t.className='ctile '+cls;t.innerHTML='<i></i><b></b><span></span><small></small>';t.querySelector('i').textContent=ic;t.querySelector('b').textContent=val;t.querySelector('span').textContent=lbl;t.querySelector('small').textContent=sub;tiles.appendChild(t);};
  const st=Number(x.streak)||0;
  tile('🔥',st+' gün','Günlük seri',st?(x.today?'Bugün oynadın ✓':'Bugün bir maç oyna, seri sürsün'):'Bugün bir maç oyna, seri başlasın',st&&!x.today?'warn':'');
  tile('❄️',x.freeze?'1':'0','Dondurma hakkı',x.freeze?'Bu hafta 1 gün kaçırsan da seri bozulmaz':'Bu haftaki hakkını kullandın');
  tile('⭐',String(Number(x.mvp)||0),'Maçın oyuncusu','Maç sonunda oyuncuların oyuyla');
  sec.appendChild(tiles);
  if(x.promo&&x.promo.b)sec.appendChild(promoEl(x.promo));
  const h=document.createElement('div');h.className='lbl';h.textContent='⚔️ Ezeli rakiplerin';sec.appendChild(h);
  if(!rv.length){const p=document.createElement('p');p.className='note';p.textContent='Henüz yok. Başka oyuncularla maç yaptıkça en çok karşılaştığın rakipler ve aranızdaki skor burada görünür.';sec.appendChild(p);}
  rv.slice(0,6).forEach((r,i)=>{const row=document.createElement('div');row.className='rivrow'+(Number(r.w)>Number(r.l)?' up':Number(r.w)<Number(r.l)?' dn':'');
    const n=document.createElement('b');n.textContent=(i===0&&Number(r.games)>=3?'😤 ':'')+cleanBad(cleanStr(r.nick||'?',14));
    const c=document.createElement('span');c.textContent=`${r.games} maç · ${rivalLine(r)}`;row.append(n,c);sec.appendChild(row);});
  const cb=document.createElement('button');cb.className='chip go';cb.type='button';cb.textContent='🪪 Oyuncu kartımı oluştur';cb.onclick=openCard;sec.appendChild(cb);
}
// maç sonu: terfi durumu ve bu maçtaki rakiplerle aranızdaki skor
async function afterApplied(mid){
  const x=await loadExtra();if(!G||G.mid!==mid)return;const ev=String(x.promo_evt||'');const [k,b]=ev.split(':');
  if(k){const el=document.createElement('div');el.className='rdelta promoev '+(k==='up'?'up':k==='fail'?'dn':'');
    el.textContent=k==='start'?`🔥 Terfi serisi başladı! ${rankName(b)} rütbesine çıkmak için sonraki 3 maçtan 2'sini kazan.`:k==='up'?`⬆️ Tebrikler, ${rankName(b)} rütbesine yükseldin!`:k==='fail'?`Terfi serisi kaçtı. ${rankName(b)} sınırına tekrar gelince yeni seri başlar.`:`Terfi serisi sürüyor: ${x.promo?x.promo.w:0} galibiyet, ${x.promo?x.promo.l:0} mağlubiyet`;
    $('endStats').before(el);}
  const rv=await loadRivals();if(!G||G.mid!==mid||!NET.room)return;const me=G.players.find(p=>p.local);if(!me)return;
  const opp=G.players.filter(p=>p.human&&p.team!==me.team).map(p=>({p,u:uidOfPeer(p.pid)})).filter(o=>o.u);
  const lines=opp.map(o=>{const r=rv.find(z=>z.id===o.u);return r&&Number(r.games)>=2?`${o.p.name}: ${r.games} maç, ${rivalLine(r)}`:null;}).filter(Boolean);
  if(lines.length){const el=document.createElement('div');el.className='rdelta riv';el.textContent='⚔️ '+lines.join(' · ');$('endStats').before(el);}
}
function uidOfPeer(pid){if(!NET.room)return null;if(pid===TAB)return uid;const p=named(NET.room.peers()).find(x=>x.peer===pid);return p&&typeof p.presence.u==='string'?p.presence.u:null;}
function endExtras(){
  const ex=$('endExtra');if(!ex)return;ex.innerHTML='';ex.hidden=true;if(!G||!G.net||!NET.room||G.myTeam<0)return;
  const humans=G.players.filter(p=>p.human);if(humans.length<2)return;ex.hidden=false;
  const mv=document.createElement('div');mv.className='mvpbox';mv.id='mvpBox';ex.appendChild(mv);
  const rb=document.createElement('button');rb.className='chip rvbtn';rb.id='rvBtn';rb.type='button';rb.onclick=()=>{const m=G&&G.mid;if(!m||!NET.room)return;NET.room.send('rv',{mid:m,from:TAB});onRematch({mid:m,from:TAB});};ex.appendChild(rb);
  updateRv();renderMvp();
  const mid=G.mid;let n=0;const t=setInterval(()=>{n++;if(!G||G.mid!==mid||$('endOv').hidden||n>20){clearInterval(t);return;}if(G.reported)DB.mvpStatus(mid).then(s=>{if(G&&G.mid===mid){G.mvpVotes=s.votes||{};G.mvpMine=s.mine||G.mvpMine;renderMvp();}}).catch(()=>{});},3000);
}
function renderMvp(){
  const box=$('mvpBox');if(!box||!G||!G.net)return;box.innerHTML='';
  const fun=PH.mode!=='normal'||G.anomFlag;if(fun){box.hidden=true;return;}box.hidden=false;
  const h=document.createElement('b');h.textContent='⭐ Maçın oyuncusu kim?';box.appendChild(h);
  const votes=G.mvpVotes||{};const row=document.createElement('div');row.className='chips';
  G.players.filter(p=>p.human).forEach(p=>{const u=uidOfPeer(p.pid);if(!u)return;const b=document.createElement('button');b.type='button';b.className='chip';
    const c=Number(votes[u])||0;b.textContent=p.name+(c?` ★${c}`:'')+(p.local?' (sen)':'');b.setAttribute('aria-pressed',String(G.mvpMine===u));
    b.disabled=p.local||!G.reported;b.onclick=async()=>{try{const r=await DB.voteMvp(G.mid,u);G.mvpMine=u;G.mvpVotes=r||{};renderMvp();}catch(e){}};row.appendChild(b);});
  box.appendChild(row);
  if(!G.reported){const s=document.createElement('small');s.className='note';s.textContent='Skor bildirilince oy verebilirsin.';box.appendChild(s);}
}
function onRematch(d){
  if(!d||!G||!G.net||typeof d.mid!=='string'||d.mid!==G.mid||typeof d.from!=='string')return;
  if(!NET.rv||NET.rv.mid!==d.mid)NET.rv={mid:d.mid,set:{}};NET.rv.set[d.from]=1;updateRv();
  if(NET.isHost&&NET.rvDone!==d.mid){const here=new Set(named(NET.room.peers()).map(p=>p.peer));const need=G.players.filter(p=>p.human&&(p.pid===TAB||here.has(p.pid))).map(p=>p.pid);
    if(need.length>=2&&need.every(pid=>NET.rv.set[pid])){NET.rvDone=d.mid;sendSys('🔁 Herkes rövanş istedi! Aynı takımlarla maç 3 saniye içinde başlıyor.');
      setTimeout(()=>{if(!NET.room||!NET.isHost)return;if(G&&G.net&&G.net.role==='host')hostBackToRoom();setTimeout(()=>{if(NET.room&&NET.isHost&&NET.phase==='lobby')$('hsStart').click();},2500);},600);}}
}
function updateRv(){const b=$('rvBtn');if(!b||!G)return;const tot=G.players.filter(p=>p.human).length;const s=NET.rv&&NET.rv.mid===G.mid?NET.rv.set:{};const n=Object.keys(s).length;
  b.textContent=`🔁 Rövanş iste (${n}/${tot})`;b.disabled=!!s[TAB];if(s[TAB])b.textContent=`🔁 Rövanş: ${n}/${tot} hazır`+(n<tot?', diğerleri bekleniyor':'');}
// haftalık antrenman tablosu (Odalar sekmesinde antrenman listesinin altında)
let DBK='slalom';
async function renderDrillBoard(k){if(k)DBK=k;const list=$('drillList');if(!list)return;let box=$('drillBoard');
  if(!box){box=document.createElement('div');box.id='drillBoard';box.className='dboard';list.after(box);}
  box.innerHTML='';const h=document.createElement('div');h.className='dbhead';const t=document.createElement('b');t.textContent='🏆 Haftalık rekor tablosu';const sub=document.createElement('span');sub.className='note';
  const n=new Date(),e=new Date(n);e.setDate(e.getDate()+((8-e.getDay())%7||7));e.setHours(0,0,0,0);const dd=Math.floor((e-n)/864e5),hh=Math.floor((e-n)%864e5/36e5);
  sub.textContent=`Pazartesi sıfırlanır · ${dd?dd+' gün ':''}${hh} saat kaldı`;h.append(t,sub);box.appendChild(h);
  const tabs=document.createElement('div');tabs.className='chips';['slalom','shoot','keeper'].forEach(x=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=DRILLS[x].name;b.setAttribute('aria-pressed',String(x===DBK));b.onclick=()=>renderDrillBoard(x);tabs.appendChild(b);});box.appendChild(tabs);
  const body=document.createElement('div');body.className='dbbody';body.innerHTML='<p class="note">Yükleniyor…</p>';box.appendChild(body);
  let d;try{d=await DB.drillBoard(DBK);}catch(err){body.innerHTML='';return;}body.innerHTML='';
  const fmt=v=>DBK==='slalom'?Number(v).toFixed(1)+' sn':v+' gol';
  if(d.last){const l=document.createElement('p');l.className='note';l.textContent=`Geçen haftanın birincisi: ${cleanBad(cleanStr(d.last.nick||'?',14))} (${fmt(d.last.score)})`;body.appendChild(l);}
  if(!d.top||!d.top.length){const p=document.createElement('p');p.className='note';p.textContent='Bu hafta henüz kimse denemedi. İlk sen ol!';body.appendChild(p);}
  (d.top||[]).forEach(r=>{const row=document.createElement('div');row.className='dbrow'+(r.me?' me':'');row.innerHTML='<i></i><b></b><span></span>';
    row.querySelector('i').textContent=r.pos===1?'🥇':r.pos===2?'🥈':r.pos===3?'🥉':r.pos+'.';row.querySelector('b').textContent=cleanBad(cleanStr(r.nick||'?',14));row.querySelector('span').textContent=fmt(r.score);body.appendChild(row);});
  if(d.me&&d.me.pos>10){const row=document.createElement('div');row.className='dbrow me';row.innerHTML='<i></i><b></b><span></span>';row.querySelector('i').textContent=d.me.pos+'.';row.querySelector('b').textContent=prof.name;row.querySelector('span').textContent=fmt(d.me.score);body.appendChild(row);}
  if(Number(d.titles)>0){const p=document.createElement('p');p.className='note';p.textContent=`🏅 Bu antrenmanda ${d.titles} kez haftanın birincisi oldun.`;body.appendChild(p);}
}
// oyuncu kartı: paylaşılabilir görsel
let CARD_BLOB=null;
const loadImg=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src;});
async function openCard(){
  $('cardOv').hidden=false;$('cardMsg').textContent='Hazırlanıyor…';$('cardImg').removeAttribute('src');
  const [sum,x,logo]=await Promise.all([DB.playerSummary(uid).catch(()=>({})),loadExtra(),loadImg('assets/logo.webp')]);
  const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const rk=rankOf(MYR.r,MYR.g);const kit=myTeamCache&&myTeamCache.team?cleanKit(myTeamCache.team.kit):userKit();
  const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#123321');bg.addColorStop(1,'#07140c');g.fillStyle=bg;g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(255,255,255,.06)';g.lineWidth=4;for(let y=0;y<H;y+=90){g.fillStyle=(y/90)%2?'rgba(255,255,255,.025)':'rgba(0,0,0,0)';g.fillRect(0,y,W,90);}
  g.strokeStyle=rk.c;g.lineWidth=14;g.strokeRect(30,30,W-60,H-60);
  if(logo){const lw=520,lh=lw*logo.height/logo.width;g.drawImage(logo,(W-lw)/2,70,lw,lh);}
  drawDisc(g,W/2,470,170,kit,prof.avatar,{});
  g.textAlign='center';g.fillStyle='#fff';g.font='800 92px system-ui,sans-serif';g.fillText(prof.name,W/2,740);
  const tag=myTag();g.font='600 40px system-ui,sans-serif';g.fillStyle='rgba(255,255,255,.7)';g.fillText(myTeamCache&&myTeamCache.team?`${myTeamCache.team.name} (${tag})`:'Takımsız oyuncu',W/2,800);
  g.fillStyle=rk.c;g.font='800 64px system-ui,sans-serif';g.fillText(`${rk.n}${MYR.g>=5?' · '+MYR.r:''}`,W/2,890);
  const stats=[['Maç',sum.played],['Gol',sum.goals],['Asist',sum.assists],['Galibiyet',sum.won],['Maçın oyuncusu',x.mvp],['Günlük seri',(Number(x.streak)||0)+' gün']];
  stats.forEach(([l,v],i)=>{const cx=W/2+((i%3)-1)*320,cy=1010+Math.floor(i/3)*150;g.fillStyle='rgba(255,255,255,.07)';g.beginPath();g.roundRect(cx-145,cy-70,290,130,22);g.fill();
    g.fillStyle='#fff';g.font='800 56px system-ui,sans-serif';g.fillText(String(v??0),cx,cy+5);g.fillStyle='rgba(255,255,255,.6)';g.font='600 28px system-ui,sans-serif';g.fillText(l.toLocaleUpperCase('tr-TR'),cx,cy+45);});
  const rw=(typeof MYREW!=='undefined'?MYREW:[]).map(r=>TIERS[r.tier]&&TIERS[r.tier].i).filter(Boolean).slice(0,8).join(' ');
  g.font='600 34px system-ui,sans-serif';g.fillStyle='rgba(255,255,255,.75)';g.fillText((rw?rw+'  ·  ':'')+'zkpball.com',W/2,H-80);
  c.toBlob(b=>{CARD_BLOB=b;$('cardImg').src=URL.createObjectURL(b);$('cardMsg').textContent='Arkadaşlarına gönder, sende kaç gol var görsünler!';
    const f=new File([b],'zkpball-kartim.png',{type:'image/png'});$('cardShare').hidden=!(navigator.canShare&&navigator.canShare({files:[f]}));},'image/png');
}
$('cardClose').onclick=()=>{$('cardOv').hidden=true;};
$('cardDl').onclick=()=>{if(!CARD_BLOB)return;const a=document.createElement('a');a.href=URL.createObjectURL(CARD_BLOB);a.download='zkpball-kartim.png';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},3000);};
$('cardShare').onclick=async()=>{if(!CARD_BLOB)return;const f=new File([CARD_BLOB],'zkpball-kartim.png',{type:'image/png'});try{await navigator.share({files:[f],title:'Zkpball oyuncu kartım',text:'Zkpball\'da benimle maç yap! ⚽'});}catch(e){}};

// ---------- Telefon bildirimleri (Web Push) ----------
const PUSH_KINDS=[['league','Lig maçı teklifleri ve maç saati hatırlatması'],['invite','Arkadaşından maç daveti'],['cup','Hafta sonu kupası başlıyor'],['friend','Arkadaşlık isteği']];
function pushPrefs(){try{return {league:true,invite:true,cup:true,friend:true,...JSON.parse(localStorage.getItem('uzk-pushprefs')||'{}')};}catch(e){return {league:true,invite:true,cup:true,friend:true};}}
const b64u=s=>{const p='='.repeat((4-s.length%4)%4);const r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(r,c=>c.charCodeAt(0));};
async function pushSub(){if(!('serviceWorker' in navigator))return null;const reg=await navigator.serviceWorker.getRegistration();return reg?reg.pushManager.getSubscription():null;}
async function enablePush(){
  const reg=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
  const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error(perm==='denied'?'denied':'dismissed');
  const key=await DB.pushKey();if(!key)throw new Error('Bildirim sunucusu hazır değil, biraz sonra tekrar dene.');
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});
  await DB.savePush(sub,pushPrefs());return sub;}
async function renderPush(){
  const box=$('pushBox');if(!box)return;box.innerHTML='';const note=t=>{const p=document.createElement('p');p.className='note';p.textContent=t;box.appendChild(p);return p;};
  const ok='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  if(isIOS&&!isStandalone()){note('iPhone/iPad\'de bildirim almak için önce Zkpball\'u ana ekrana ekle: Safari\'de Paylaş ⬆️ → "Ana Ekrana Ekle". Sonra ana ekrandaki simgeden açıp buradan bildirimleri aç.');return;}
  if(!ok){note('Bu tarayıcı telefon bildirimlerini desteklemiyor. Chrome, Edge, Firefox ya da ana ekrana eklenmiş Safari kullan.');return;}
  if(location.protocol!=='https:'&&location.hostname!=='localhost'){note('Bildirimler yalnızca güvenli bağlantıda (https) çalışır.');return;}
  let sub=null;try{sub=await pushSub();}catch(e){}
  const on=!!sub&&Notification.permission==='granted';
  const row=document.createElement('div');row.className='pushrow';const st=document.createElement('span');st.className='pushst'+(on?' on':'');
  st.textContent=on?'🔔 Bu cihazda açık':Notification.permission==='denied'?'🔕 Tarayıcı ayarlarında engellenmiş':'🔕 Kapalı';
  const b=document.createElement('button');b.className='chip'+(on?'':' go');b.textContent=on?'Kapat':'Bildirimleri aç';
  const msg=document.createElement('p');msg.className='note';msg.style.margin='0';
  b.onclick=async()=>{b.disabled=true;msg.textContent='';try{
      if(on){const s=await pushSub();if(s){await DB.deletePush(s.endpoint).catch(()=>{});await s.unsubscribe();}}
      else{await enablePush();}
      renderPush();}catch(e){b.disabled=false;msg.textContent=/denied/.test(e.message)?'İzin verilmedi. Tarayıcının site ayarlarından bildirimlere izin verip tekrar dene.':/dismissed/.test(e.message)?'İzin penceresi kapatıldı.':errText(e);}};
  row.append(st,b);box.append(row);
  if(Notification.permission==='denied'&&!on)b.disabled=true;
  const pr=pushPrefs();const g=document.createElement('div');g.className='pushkinds';
  PUSH_KINDS.forEach(([k,l])=>{const lab=document.createElement('label');lab.className='toggle';const c=document.createElement('input');c.type='checkbox';c.checked=pr[k]!==false;c.disabled=!on;
    c.onchange=async()=>{const p=pushPrefs();p[k]=c.checked;try{localStorage.setItem('uzk-pushprefs',JSON.stringify(p));}catch(e){}const s=await pushSub();if(s)DB.savePush(s,p).catch(e=>{msg.textContent=errText(e);});};
    lab.append(c,document.createTextNode(' '+l));g.appendChild(lab);});
  box.append(g,msg);
  if(!on)note('Lig maçın yaklaşınca, arkadaşın seni davet edince ya da kupa başlarken oyun kapalıyken bile telefonuna bildirim gelir.');
}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{const u=e.data&&e.data.uzkOpen;if(typeof u==='string'){try{const x=new URL(u);handleDeepLink(x);}catch(_){}}});
function handleDeepLink(u=new URL(location.href)){
  const j=(u.searchParams.get('join')||'').toLowerCase();
  if(/^[a-z0-9]{4}$/.test(j)){history.replaceState(null,'',location.pathname);const go=()=>{if(NET.state==='on'){NET.watch=false;enterRoom(j);}else setTimeout(go,700);};go();return;}
  if(u.hash==='#lig'){history.replaceState(null,'',location.pathname+location.search);showTab('league');}
}

// ---------- Oyun içi hata bildirimi ----------
const ERRLOG=[];const logErr=t=>{ERRLOG.push(new Date().toISOString().slice(11,19)+' '+String(t).slice(0,300));if(ERRLOG.length>20)ERRLOG.shift();};
addEventListener('error',e=>logErr((e.message||'hata')+' @'+(e.filename||'').split('/').pop()+':'+(e.lineno||'')));
addEventListener('unhandledrejection',e=>logErr('promise: '+(e.reason&&e.reason.message||e.reason)));
{const ce=console.error.bind(console);console.error=(...a)=>{try{logErr(a.map(x=>x&&x.message||String(x)).join(' '));}catch(_){}ce(...a);};}
function bugContext(){
  const v=(document.querySelector('script[src*="app.js"]')||{}).src||'';
  const g=G?{mode:G.drill?'drill:'+G.drill.kind:G.net?G.net.role:'bot',st:G.state,map:G.opt&&G.opt.map,score:G.score,tick:G.tick,players:(G.players||[]).length,ranked:!!G.ranked,mid:G.mid||''}:null;
  return {v:(v.split('v=')[1]||'').slice(0,12),ua:navigator.userAgent.slice(0,200),scr:`${screen.width}x${screen.height}@${devicePixelRatio}`,win:`${innerWidth}x${innerHeight}`,lang:navigator.language,
    touch:'ontouchstart' in window,standalone:matchMedia('(display-mode: standalone)').matches,net:NET.state,room:NET.code||'',host:!!NET.isHost,phase:NET.phase,ping:NET.ping||0,
    rtc:RTC.dcs.size,screen:screens.find(s=>!$(s).hidden)||'',tab:document.querySelector('[role=tab][aria-selected=true]')?.dataset.tab||'',game:g,errors:ERRLOG.slice(-12)};}
function openBug(){$('bugOv').hidden=false;$('bugMsg').textContent='';$('bugText').value='';$('bugSend').disabled=false;setTimeout(()=>$('bugText').focus(),0);for(const k in keys)keys[k]=false;}
$('bugBtn').onclick=openBug;$('bugBtn2').onclick=()=>{$('pauseOv').hidden=true;if(G&&!G.net&&G.paused)G.paused=false;openBug();};
$('bugClose').onclick=()=>{$('bugOv').hidden=true;};
$('bugSend').onclick=async()=>{const t=cleanStr($('bugText').value,1000).trim();if(t.length<3){$('bugMsg').textContent='Biraz daha ayrıntı yaz.';return;}
  $('bugSend').disabled=true;try{await DB.submitBug(t,bugContext());$('bugMsg').textContent='Teşekkürler! Bildirimin bize ulaştı.';setTimeout(()=>{$('bugOv').hidden=true;},1400);}
  catch(e){$('bugSend').disabled=false;$('bugMsg').textContent=/too many/.test(e.message)?'Bir saatte en fazla 5 bildirim gönderebilirsin.':errText(e);}};
$('bugText').addEventListener('keydown',e=>e.stopPropagation());

// ---------- Yönetici: hata bildirimleri ve kullanım istatistikleri ----------
function adminShop(B){
  const h=document.createElement('h2');h.textContent='Mağaza kodu';B.appendChild(h);
  const w=document.createElement('div');w.className='shopgen';B.appendChild(w);
  w.innerHTML='<p class="note">Ürünü ve süreyi seç, kodu üret, oyuncuya söyle. Oyuncu Profil → Mağaza\'da kodu yazar. Her kod tek kullanımlık; süre dolunca geçersiz olur.</p><div class="row"><select id="sgItem" aria-label="Ürün"></select></div><div class="row" id="sgTtl"></div><button class="big" id="sgGo" type="button">Kod üret</button><div class="sgout" id="sgOut" hidden><b id="sgCode" title="Kopyalamak için dokun"></b><span id="sgLeft"></span></div><div class="sglist" id="sgList"></div>';
  const sel=w.querySelector('#sgItem');Object.entries(ITEM_TR).forEach(([k,n])=>{const o=document.createElement('option');o.value=k;o.textContent=n;sel.appendChild(o);});
  let ttl=15;const tr=w.querySelector('#sgTtl');[5,15,30,60].forEach(t=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=t+' sn';b.setAttribute('aria-pressed',String(t===ttl));b.onclick=()=>{ttl=t;[...tr.children].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};tr.appendChild(b);});
  const list=async()=>{const L=w.querySelector('#sgList');try{const r=await DB.adminRpc('admin_shop_codes');L.innerHTML='';if(!r.length)return;const hd=document.createElement('div');hd.className='lbl';hd.textContent='Son kodlar';L.appendChild(hd);
    r.forEach(x=>{const d=document.createElement('div');d.className='sgrow';const c=document.createElement('code');c.textContent=x.code;const i=document.createElement('span');i.textContent=ITEM_TR[x.item]||x.item;const s2=document.createElement('span');
      s2.className=x.used_at?'ok':new Date(x.expires_at)<new Date()?'off':'wait';s2.textContent=x.used_at?'✓ '+(x.used_nick||'?')+' · '+fmtDT(x.used_at):new Date(x.expires_at)<new Date()?'Süresi doldu':'Bekliyor';d.append(c,i,s2);L.appendChild(d);});}catch(e){L.textContent=errText(e);}};
  let tm=null;const go=w.querySelector('#sgGo');
  go.onclick=async()=>{go.disabled=true;try{const r=await DB.adminRpc('admin_make_code',{p_item:sel.value,p_ttl:ttl});const out=w.querySelector('#sgOut'),cd=w.querySelector('#sgCode'),lf=w.querySelector('#sgLeft');out.hidden=false;out.classList.remove('dead');cd.textContent=r.code;
      cd.onclick=()=>{try{navigator.clipboard.writeText(r.code);toast('Kod kopyalandı');}catch(e){}};
      const end=Date.now()+r.ttl*1000;clearInterval(tm);const tick=()=>{const s=Math.ceil((end-Date.now())/1000);if(s<=0){clearInterval(tm);lf.textContent='Süresi doldu';out.classList.add('dead');list();return;}lf.textContent=`${ITEM_TR[r.item]} · ${s} sn kaldı`;};tick();tm=setInterval(tick,250);list();}
    catch(e){toast(errText(e));}finally{go.disabled=false;}};
  list();
}
async function adminBugs(B){
  const h=document.createElement('h2');h.textContent='Hata bildirimleri';B.appendChild(h);
  const box=document.createElement('div');B.appendChild(box);let status='open';
  const load=async()=>{box.innerHTML='';const tg=document.createElement('div');tg.className='chips';
    [['open','Açık'],['closed','Çözüldü']].forEach(([k,l])=>{const b=document.createElement('button');b.className='chip';b.textContent=l;b.setAttribute('aria-pressed',String(k===status));b.onclick=()=>{status=k;load();};tg.appendChild(b);});box.appendChild(tg);
    let L=[];try{L=await DB.adminRpc('admin_bugs',{p_status:status});}catch(e){const p=document.createElement('p');p.className='err';p.textContent=errText(e);box.appendChild(p);return;}
    if(!L.length){const p=document.createElement('p');p.className='note';p.textContent=status==='open'?'Açık hata bildirimi yok.':'Kayıt yok.';box.appendChild(p);}
    L.forEach(r=>{const c=document.createElement('div');c.className='admcard bug';const hd=document.createElement('div');hd.className='admh';
      const n=document.createElement('b');n.textContent=r.nick||'?';const m=document.createElement('span');const x=r.ctx||{};
      m.textContent=`${new Date(r.created_at).toLocaleString('tr-TR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${x.touch?'📱':'💻'} ${x.win||''} · ${x.screen||''}${x.game?' · '+x.game.mode+' '+(x.game.map||''):''}${x.ping?' · '+x.ping+' ms':''}`;hd.append(n,m);
      const q=document.createElement('div');q.className='admq';q.textContent=r.body;
      const det=document.createElement('details');const sm=document.createElement('summary');sm.textContent='Teknik ayrıntılar'+(Array.isArray(x.errors)&&x.errors.length?` (${x.errors.length} hata kaydı)`:'');
      const pre=document.createElement('pre');pre.textContent=JSON.stringify(x,null,1);det.append(sm,pre);
      const a=document.createElement('div');a.className='admact';const b=document.createElement('button');b.className='chip'+(status==='open'?' go':'');b.textContent=status==='open'?'Çözüldü olarak işaretle':'Yeniden aç';
      b.onclick=async()=>{await DB.adminRpc('admin_bug_set',{p_id:r.id,p_status:status==='open'?'closed':'open'}).catch(e=>alert(errText(e)));load();};a.appendChild(b);
      c.append(hd,q,det,a);box.appendChild(c);});};
  await load();}
function barChart(vals,labels,{h=120,hi=-1,fmt=v=>v,cls=''}={}){
  const max=Math.max(1,...vals);const w=document.createElement('div');w.className='bars '+cls;w.style.setProperty('--h',h+'px');
  vals.forEach((v,i)=>{const c=document.createElement('div');c.className='bar'+(i===hi?' hi':'');c.title=`${labels[i]}: ${fmt(v)}`;
    const f=document.createElement('i');f.style.height=Math.max(v>0?3:0,Math.round(v/max*h))+'px';const l=document.createElement('span');l.textContent=labels[i];c.append(f,l);w.appendChild(c);});return w;}
async function adminUsage(B){
  const h=document.createElement('h2');h.textContent='Kullanım istatistikleri';B.appendChild(h);
  let d;try{d=await DB.adminRpc('admin_usage');}catch(e){const p=document.createElement('p');p.className='err';p.textContent=errText(e);B.appendChild(p);return;}
  const dau=d.dau||[],last=dau[dau.length-1]||{users:0},prev=dau[dau.length-2]||{users:0};
  const st=document.createElement('div');st.className='stattiles';
  const ret=(d.retention||[]).filter(r=>r.size>0);const pct=(a,b)=>b?Math.round(a/b*100)+'%':'–';
  const r1=ret.filter(r=>r.day<d.today);const r7=ret.filter(r=>(new Date(d.today)-new Date(r.day))/864e5>=8);
  const sum=(a,k)=>a.reduce((s,r)=>s+(Number(r[k])||0),0);
  [['Bugün aktif',last.users],['Dün aktif',prev.users],['Son 7 gün',d.wau],['Son 30 gün',d.mau],['1. gün dönüş',pct(sum(r1,'d1'),sum(r1,'size'))],['7. gün dönüş',pct(sum(r7,'d7'),sum(r7,'size'))]].forEach(([l,v])=>{
    const t=document.createElement('div');t.innerHTML='<b></b><span></span>';t.querySelector('b').textContent=v??0;t.querySelector('span').textContent=l;st.appendChild(t);});B.appendChild(st);
  const sec=(t,n)=>{const s=document.createElement('div');s.className='usec';const b=document.createElement('b');b.textContent=t;s.appendChild(b);if(n){const p=document.createElement('span');p.className='note';p.textContent=n;s.appendChild(p);}B.appendChild(s);return s;};
  const dl=dau.map(x=>String(new Date(x.day).getDate()));
  sec('Günlük aktif oyuncu (son 30 gün)').appendChild(barChart(dau.map(x=>x.users),dl,{hi:dau.length-1}));
  sec('Oynanan maç / yeni oyuncu (son 30 gün)','Mavi: tamamlanan maç · mor: yeni oyuncu').appendChild(barChart(dau.map(x=>x.matches),dl,{h:80,cls:'alt',hi:dau.length-1}));
  const nb=barChart(dau.map(x=>x.new),dl,{h:50,cls:'alt2',hi:dau.length-1});B.lastChild.appendChild(nb);
  const hrs=d.hours||[];const hn=new Date().getHours();const peak=hrs.reduce((a,b)=>Number(b.avg)>Number(a.avg)?b:a,hrs[0]||{h:0,avg:0});
  sec('Yoğun saatler',`Son 2 haftada saat başına ortalama aktif oyuncu · en yoğun ${String(peak.h).padStart(2,'0')}:00 (${peak.avg})`).appendChild(barChart(hrs.map(x=>Number(x.avg)),hrs.map(x=>String(x.h).padStart(2,'0')),{h:90,hi:hn,fmt:v=>v+' oyuncu'}));
  const rs=sec('Geri dönüş (ilk gelinen güne göre)','Bir gün sonra ve bir hafta sonra tekrar gelenlerin oranı');
  if(!ret.length){const p=document.createElement('p');p.className='note';p.textContent='Henüz yeterli veri yok; veriler bugünden itibaren toplanıyor.';rs.appendChild(p);}
  else{const tb=document.createElement('table');tb.className='rettb';tb.innerHTML='<tr><th>İlk gün</th><th class="n">Yeni</th><th class="n">1. gün</th><th class="n">7. gün</th></tr>';
    ret.slice(0,14).forEach(r=>{const tr=document.createElement('tr');const age=(new Date(d.today)-new Date(r.day))/864e5;
      tr.innerHTML=`<td>${new Date(r.day).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</td><td class="n">${r.size}</td><td class="n">${age>=1?pct(r.d1,r.size):'…'}</td><td class="n">${age>=8?pct(r.d7,r.size):'…'}</td>`;tb.appendChild(tr);});rs.appendChild(tb);}
}

// ---------- Günlük ve haftalık görevler ----------
const QUESTS={daily:[['played',3,'3 maç oyna'],['goals',2,'2 gol at'],['won',1,'1 maç kazan']],weekly:[['played',15,'15 maç oyna'],['goals',10,'10 gol at'],['assists',5,'5 asist yap'],['won',7,'7 maç kazan']]};
function untilTxt(kind){const n=new Date();let e;if(kind==='daily'){e=new Date(n);e.setHours(24,0,0,0);}else{e=new Date(n);const dd=(8-e.getDay())%7||7;e.setDate(e.getDate()+dd);e.setHours(0,0,0,0);}const ms=e-n,d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);return d?`${d} gün ${h} sa`:`${h} sa ${m} dk`;}
async function renderQuests(){
  const box=$('questBox');if(!box)return;let q;try{q=await DB.questStatus();}catch(e){box.innerHTML='';return;}
  QSTARS=Number(q.stars)||0;renderLooks();box.innerHTML='';
  const head=document.createElement('div');head.className='qhead';head.innerHTML='<b></b><span></span>';head.querySelector('b').textContent=`⭐ ${QSTARS} görev yıldızı`;
  const nx=[[5,'Yıldız tozu koşu izi'],[15,'Galaksi topu'],[30,'⭐ Görev ustası rozeti']].find(x=>x[0]>QSTARS);head.querySelector('span').textContent=nx?`${nx[0]-QSTARS} yıldız sonra: ${nx[1]}`:'Tüm görev ödüllerini açtın!';box.appendChild(head);
  for(const kind of ['daily','weekly']){const prog=kind==='daily'?q.d:q.w,per=(kind==='daily'?'d:'+q.day:'w:'+q.week),claimed=(q.claimed||[]).includes(per);
    const sec=document.createElement('div');sec.className='qsec';const h=document.createElement('div');h.className='qh';h.innerHTML='<b></b><span></span>';h.querySelector('b').textContent=kind==='daily'?'Günlük görevler · 1⭐':'Haftalık görevler · 3⭐';h.querySelector('span').textContent='yenilenmeye '+untilTxt(kind);sec.appendChild(h);
    let all=true;QUESTS[kind].forEach(([k,n,l])=>{const v=Math.min(n,Number(prog&&prog[k])||0);if(v<n)all=false;const r=document.createElement('div');r.className='qrow'+(v>=n?' done':'');r.innerHTML='<span></span><i><em></em></i><small></small>';
      r.querySelector('span').textContent=(v>=n?'✓ ':'')+l;r.querySelector('em').style.width=(v/n*100)+'%';r.querySelector('small').textContent=`${v}/${n}`;sec.appendChild(r);});
    const b=document.createElement('button');b.className='chip'+(all&&!claimed?' go':'');b.disabled=!all||claimed;b.textContent=claimed?'Ödül alındı ✓':all?'Ödülü al':'Görevleri tamamla';
    b.onclick=async()=>{b.disabled=true;try{QSTARS=await DB.claimQuest(kind);renderQuests();pushLobby();}catch(e){b.disabled=false;b.textContent=errText(e);}};sec.appendChild(b);box.appendChild(sec);}
  const n2=document.createElement('p');n2.className='note';n2.textContent='Görevler sadece başka oyuncularla oynanan oda maçlarından sayılır. Ödüller yalnızca görünüm içindir, oyunda avantaj sağlamaz.';box.appendChild(n2);
}

// ---------- Oda ekranı ----------
function specCount(){try{if(!NET.room)return 0;const v=roomView();if(!v)return 0;return named(NET.room.peers()).filter(p=>(v.teams[p.peer]||'spec')==='spec').length;}catch(e){return 0;}}
function roomView(){
  if(NET.isHost)return {cfg:NET.cfg,teams:NET.teams,bots:NET.bots,phase:NET.phase,host:TAB,me:TAB};
  const h=hostPeerOf(NET.room);if(!h)return null;const pr=h.presence;
  return {cfg:pr.cfg||{},teams:pr.teams||{},bots:Array.isArray(pr.bots)?pr.bots:[],phase:pr.phase,host:h.peer,me:TAB};
}
function miniKit(cv,k){const x=cv.getContext('2d');x.clearRect(0,0,cv.width,cv.height);drawDisc(x,cv.width/2,cv.height/2,cv.width/2-2,k,'');}
function renderRoom(){
  if(!NET.room||$('roomScr').hidden)return;
  const v=roomView();
  if(!v){$('rName').textContent='Odaya bağlanılıyor…';$('rMeta').textContent='';$('rStatus').textContent='Oda sahibi bekleniyor.';return;}
  const cfg=v.cfg,kits=[kitOf(cfg.kits?cfg.kits[0]:0),kitOf(cfg.kits?cfg.kits[1]:1)];
  $('rName').textContent=cleanStr(cfg.name,28)||'Oda';
  {const hp=named(NET.room.peers()).find(p=>p.peer===v.host);NET.hostNickTxt=hp?'🏠 Kurucu: '+cleanBad(cleanStr(hp.presence.nick,14))+' · ':'';}
  $('rMeta').textContent=NET.hostNickTxt+`${cfg.cup?'🏆 Kupa maçı · ':cfg.league?'🏆 Lig maçı · ':cfg.qteams?'🏆 Dereceli · ':''}${MODES[cfg.mode]&&cfg.mode!=='normal'?MODES[cfg.mode].i+' '+MODES[cfg.mode].n+' (derecesiz) · ':''}${MAPS[cfg.map]?MAPS[cfg.map].name:'?'} saha · ${(SKINS[cfg.skin]||SKINS.classic).name} · ${Math.round((cfg.time||0)/60)} dk · ${cfg.goals?cfg.goals+' gol sınırı':'gol sınırı yok'} · en fazla ${cfg.max} kişi${cfg.priv?' · gizli oda':''}${cfg.free?' · serbest takım seçimi':' · takımları oda sahibi dağıtır'}`;
  const ps=named(NET.room.peers());const cols={red:[],spec:[],blue:[]};
  for(const p of ps){const t=v.teams[p.peer]||'spec';if(t==='full'||t==='kicked')continue;(cols[t]||cols.spec).push({p});}
  for(const b of v.bots){if(b&&(b.team===0||b.team===1))cols[b.team===0?'red':'blue'].push({bot:b});}
  [['red','col0',0],['spec','colS',-1],['blue','col1',1]].forEach(([key,id,ti])=>{
    const col=$(id);
    if(ti>=0){col.style.setProperty('--tc',kits[ti].p);col.querySelector('h3 span').textContent=kits[ti].name;miniKit(col.querySelector('canvas'),kits[ti]);}
    col.querySelector('h3 em').textContent=cols[key].length;
    const list=col.querySelector('.plist');list.innerHTML='';
    cols[key].forEach(it=>{
      const c=document.createElement(NET.isHost?'button':'div');c.className='pchip'+(NET.isHost?' hostable':'');
      const av=document.createElement('span');av.className='av';const nm=document.createElement('span');nm.className='nm';const st=document.createElement('span');st.className='st';
      const k=ti>=0?kits[ti]:{p:'#55625a',s:'#55625a',pat:'solid'};av.style.background=k.p;av.style.color=lum(k.p)>0.6?'#111':'#fff';
      if(it.bot){av.textContent=cleanStr(it.bot.av,2);nm.textContent=cleanStr(it.bot.name,14)+' (bot)';st.textContent='🤖';
        if(NET.isHost)c.onclick=()=>{NET.bots=NET.bots.filter(b=>b!==it.bot);pushRoom();renderRoom();};}
      else{const pr=it.p.presence;av.textContent=cleanStr(pr.av,2)||'?';nm.textContent='';nm.appendChild(nickEl(pr.tg,cleanStr(pr.nick,14),cleanCol(pr.nc),'span'));if(it.p.peer===v.host){const hb=document.createElement('span');hb.className='hostb';hb.textContent='🏠 Kurucu';hb.title='Odayı kuran kişi: takımları dağıtır, maçı başlatır';c._hb=hb;c.classList.add('ishost');}nm.appendChild(rankEl(pr.r,pr.rg,true));if(cleanTier(pr.sr))nm.appendChild(tierEl(pr.sr));if(pr.qm===1){const q=document.createElement('span');q.className='tierb';q.textContent='⭐';q.title='Görev ustası';nm.appendChild(q);}
        if(it.p.sameTab)c.classList.add('me');
        const link=NET.isHost&&!it.p.sameTab?(dcOpen(it.p.peer)?' ·P2P':' ·yedek'):'';
        st.textContent=(v.phase==='lobby'&&pr.ready?'hazır':'')+link;if(pr.ready)st.classList.add('ok');
        if(it.p.peer!==v.host){const pm=it.p.sameTab?(NET.ping||0):(Number(pr.pn)||0);if(pm)st.prepend(pingEl(pm));}
        if(NET.isHost)c.onclick=()=>openPlayerMenu(it.p.peer,cleanStr(pr.nick,14),pr.u,pr.tg);else{c.style.cursor='pointer';c.onclick=()=>openStats(pr.u,cleanStr(pr.nick,14),pr.tg);}}
      c.append(av,nm);if(c._hb)c.append(c._hb);c.append(st);list.appendChild(c);});
    const jb=col.querySelector('.join');const myT=v.teams[v.me]||'spec';
    jb.disabled=myT===key||v.phase!=='lobby'||(!cfg.free&&!NET.isHost);jb.hidden=!!cfg.lteam&&key!=='spec';
    jb.title=!cfg.free&&!NET.isHost?'Takımları oda sahibi dağıtıyor':'';
  });
  const st=$('rStatus');st.innerHTML='';
  const myT=v.teams[v.me]||'spec';
  const line=document.createElement('div');line.className='row';line.style.alignItems='center';
  const txt=document.createElement('span');txt.style.flex='1';
  if(v.phase==='game'){
    const inGame=G&&G.net;txt.textContent=myT==='spec'?'Maç sürüyor. İzleyebilirsin, maç bitince takıma geçebilirsin.':'Maç sürüyor.';
    const b=document.createElement('button');b.className='big';b.textContent=myT==='spec'||!inGame?'Maçı izle':'Maça dön';b.disabled=!inGame;
    b.onclick=()=>{NET.watch=true;if(G&&G.net){show('game');resize();renderHud();}};line.append(txt,b);
  }else{
    txt.textContent=myT==='spec'?'İzleyicisin. Bir takıma geç, sonra "Hazırım" de.':'Takımdasın. Hazır olunca işaretle, oda sahibi maçı başlatsın.';
    const r=document.createElement('button');r.className='chip';r.setAttribute('aria-pressed',String(!!NET.ready));r.textContent=NET.ready?'Hazırım ✓':'Hazırım';
    r.onclick=()=>{NET.ready=!NET.ready;pushRoom();renderRoom();};line.append(txt,r);
  }
  const ib=document.createElement('button');ib.className='chip';ib.textContent='Arkadaş davet et';ib.onclick=openInvite;line.appendChild(ib);
  st.appendChild(line);
  if(!NET.isHost){const h=hostPeerOf(NET.room);const n=document.createElement('p');n.className='note';n.style.margin='8px 0 0';
    n.textContent=dcOpen(h&&h.peer)?'Oda sahibine doğrudan bağlısın (en düşük gecikme).':'Oda sahibine sunucu üzerinden bağlısın. Doğrudan bağlantı kuruluyor…';st.appendChild(n);}
  $('hostPanel').hidden=!NET.isHost;
  if(NET.isHost)renderHostPanel();
  if(NET.isHost&&NET.menuFor&&!(NET.menuFor in NET.teams)){NET.menuFor=null;$('pMenu').hidden=true;}
}
function renderHostPanel(){
  const cfg=NET.cfg;
  [['hsMap','map',false],['hsTime','time',true],['hsGoals','goals',true],['hsSkin','skin',false]].forEach(([id,k,num])=>{
    $(id).querySelectorAll('.chip').forEach(c=>{c.setAttribute('aria-pressed',String(String(cfg[k])===c.dataset.v));c.disabled=NET.phase!=='lobby';
      c.onclick=()=>{const v=num?Number(c.dataset.v):c.dataset.v;if(k==='skin'&&!skinOk(v)){lockMsg('Bu saha');return;}cfg[k]=v;pushRoom();pushLobby();renderRoom();};if(k==='skin')c.classList.toggle('locked',!skinOk(c.dataset.v));});});
  [0,1].forEach(t=>{const box=$('hsKit'+t);if(!box.childElementCount){KITS.forEach((k,i)=>{const b=document.createElement('button');b.title=k.n;b.setAttribute('aria-label',k.n);const cv=document.createElement('canvas');cv.width=60;cv.height=60;b.appendChild(cv);miniKit(cv,kitOf(i));
      b.onclick=()=>{if(NET.cfg.kits[1-t]===i)NET.cfg.kits[1-t]=NET.cfg.kits[t];NET.cfg.kits[t]=i;pushRoom();renderRoom();};box.appendChild(b);});}
    [...box.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(cfg.kits[t]===i)));});
  $('hsFree').checked=!!cfg.free;
  $('hsStart').disabled=NET.phase!=='lobby';
}
$('hsFree').onchange=e=>{NET.cfg.free=e.target.checked;pushRoom();renderRoom();};
function addBot(t){if(NET.bots.length>=10)return;const used=new Set(NET.bots.map(b=>b.name));const name=BOT_NAMES.find(n=>!used.has(n))||'Bot';NET.bots.push({id:'b'+(++NET.botN),team:t,name,av:String(NET.bots.filter(b=>b.team===t).length+1)});pushRoom();renderRoom();}
$('hsBot0').onclick=()=>addBot(0);$('hsBot1').onclick=()=>addBot(1);
$('hsBotClear').onclick=()=>{NET.bots=[];pushRoom();renderRoom();};
$('hsBalance').onclick=()=>{
  const ps=named(NET.room.peers()).filter(p=>{const t=NET.teams[p.peer];return t==='red'||t==='blue';});
  const all=[...ps.map(p=>({p,r:Number(p.presence.r)||1000})),...NET.bots.map(b=>({b,r:850}))].sort((a,b)=>b.r-a.r);
  if(all.length<2){$('rStatus').textContent='Dengeli dağıtmak için takımlarda en az 2 oyuncu olmalı.';return;}
  const tot=[0,0],n=[0,0],half=Math.ceil(all.length/2);
  for(const it of all){const t=n[0]>=half?1:n[1]>=half?0:(tot[0]<=tot[1]?0:1);tot[t]+=it.r;n[t]++;if(it.p)NET.teams[it.p.peer]=t?'blue':'red';else it.b.team=t;}
  pushRoom();renderRoom();sendSys(`Takımlar beceri puanına göre dengelendi (ort. ${Math.round(tot[0]/n[0])} – ${Math.round(tot[1]/n[1])}).`);
};
$('hsShuffle').onclick=()=>{
  const ps=named(NET.room.peers()).filter(p=>{const t=NET.teams[p.peer];return t!=='full'&&t!=='kicked';});
  const all=[...ps.map(p=>({p})),...NET.bots.map(b=>({b}))].sort(()=>Math.random()-0.5);
  all.forEach((it,i)=>{const t=i%2;if(it.p)NET.teams[it.p.peer]=t?'blue':'red';else it.b.team=t;});
  pushRoom();renderRoom();sendSys('Takımlar karıştırıldı.');
};
function sendSys(t){sendChat('room','📣 '+t);}
function openPlayerMenu(peer,nick,u,tg){
  const m=$('pMenu');NET.menuFor=peer;m.hidden=false;m.innerHTML='';
  const l=document.createElement('b');l.textContent=nick+':';m.appendChild(l);
  [['red','Sol takıma'],['spec','İzleyiciye'],['blue','Sağ takıma']].forEach(([t,lab])=>{const b=document.createElement('button');b.className='chip';b.textContent=lab;b.onclick=()=>{NET.teams[peer]=t;m.hidden=true;NET.menuFor=null;pushRoom();renderRoom();};m.appendChild(b);});
  if(peer!==TAB&&u){const bn=document.createElement('button');bn.className='chip';bn.textContent='Odadan yasakla';bn.style.borderColor='var(--danger)';bn.onclick=()=>{NET.cfg.bans=[...(NET.cfg.bans||[]),u].slice(-50);NET.teams[peer]='kicked';m.hidden=true;NET.menuFor=null;pushRoom();renderRoom();sendSys(nick+' bu odadan yasaklandı.');};m.appendChild(bn);}
  if(peer!==TAB){const k=document.createElement('button');k.className='chip';k.textContent='Odadan çıkar';k.style.borderColor='var(--danger)';k.onclick=()=>{NET.teams[peer]='kicked';m.hidden=true;NET.menuFor=null;pushRoom();renderRoom();sendSys(nick+' odadan çıkarıldı.');};m.appendChild(k);}
  const sb2=document.createElement('button');sb2.className='chip';sb2.textContent='İstatistik';sb2.onclick=()=>openStats(u,nick,tg);m.appendChild(sb2);
  const c=document.createElement('button');c.className='chip';c.textContent='Kapat';c.onclick=()=>{m.hidden=true;NET.menuFor=null;};m.appendChild(c);
}
document.querySelectorAll('#roomScr .join').forEach(b=>b.onclick=()=>{NET.want=b.dataset.team;if(NET.isHost){NET.teams[TAB]=NET.want;}pushRoom();renderRoom();});

// ---------- Maç: host ----------
$('hsStart').onclick=()=>{
  const ps=named(NET.room.peers());const roster=[];
  for(const p of ps){const t=NET.teams[p.peer];if(t!=='red'&&t!=='blue')continue;const pr=p.presence;
    roster.push({pid:p.peer,team:t==='red'?0:1,human:true,local:p.sameTab,remote:!p.sameTab,avatar:cleanStr(pr.av,2)||'?',name:cleanBad(cleanStr(pr.nick,14)),nameColor:cleanCol(pr.nc),tag:cleanTag(pr.tg),cel:cleanCel(pr.cel),rating:Number(pr.r)||1000,trail:cleanTrail(pr.tr),sr:cleanTier(pr.sr)});}
  for(const b of NET.bots)roster.push({pid:b.id,team:b.team,rating:850,human:false,local:false,remote:false,avatar:cleanStr(b.av,2),name:cleanStr(b.name,14),nameColor:'#ffffff'});
  if(!roster.some(r=>r.team===0)||!roster.some(r=>r.team===1)){$('rStatus').textContent='Maç için iki takımda da en az bir oyuncu ya da bot olmalı.';return;}
  NET.away={};NET.afk=[];NET.mid=NET.code+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  NET.ro=roster.map(r=>[r.pid,r.team,r.avatar,r.name,r.nameColor,r.human?1:0,r.tag||'',r.cel||'',r.rating||1000,r.trail||'none',r.sr||'']);NET.phase='game';NET.pubN=0;
  pushRoom();pushLobby();
  const mt=NET.teams[TAB];
  startMatch({roster,map:NET.cfg.map,kits:[kitOf(NET.cfg.kits[0]),kitOf(NET.cfg.kits[1])],time:NET.cfg.time,goals:NET.cfg.goals,skin:NET.cfg.skin,mode:NET.cfg.mode,net:{role:'host'},myTeam:mt==='red'?0:mt==='blue'?1:-1,diff:1});
  sendSys('Maç başladı!');
  G.mid=NET.mid;
  if(cleanMode(NET.cfg.mode)==='normal'&&roster.filter(r=>r.human).length>=2&&(mt==='red'||mt==='blue')){G.ranked=true;setLastMatch(NET.code);DB.matchBegin(NET.code).catch(()=>{});}
};
function netHostInputs(){return NET.inputs;}
function netHostPublish(){
  if(!NET.room||!G)return;
  NET.pubN++;if(NET.pubN%2)return; // 30 Hz
  const s=[];for(const p of G.players)s.push(Math.round(p.x),Math.round(p.y),p.kick?1:0);
  const g={n:NET.pubN,s,b:[Math.round(G.ball.x),Math.round(G.ball.y)],sc:G.score,c:Math.round(G.clock*10)/10,st:G.state,gd:G.golden?1:0,ks:G.kseq,gs:G.gseq,lg:G.lastGoal,gi:G.gi,ai:G.ai,pg:G.players.map(p=>[p.g||0,p.a||0]),pa:G.paused?1:0,v:G.players.map(p=>[Math.round((p.vx||0)*100),Math.round((p.vy||0)*100)]),bv:[Math.round((G.ball.vx||0)*100),Math.round((G.ball.vy||0)*100)],ko:G.kickoff?1:0,kt:G.kickTeam,stt:G.stateT|0,lk:PH.one&&G.lastKicker&&G.t1===G.lastKicker?G.players.indexOf(G.lastKicker):-1};
  const msg=JSON.stringify({g});let needRelay=false;
  for(const p of named(NET.room.peers())){if(p.sameTab)continue;const t=NET.teams[p.peer];if(t==='full'||t==='kicked')continue;const dc=dcOpen(p.peer);
    if(dc){try{dc.send(msg);}catch(e){needRelay=true;}}else needRelay=true;}
  if(needRelay&&NET.pubN%6===0)NET.room.send('g',g); // doğrudan bağlanamayanlar için 10 Hz yedek (Supabase mesaj sınırı için)
}
function hostBackToRoom(){NET.phase='lobby';NET.ro=null;pushRoom();pushLobby();G=null;show('roomScr');renderRoom();}

// ---------- Maç: istemci ----------
function clientSync(h){
  const pr=h.presence;
  if(pr.phase==='game'&&Array.isArray(pr.ro)&&pr.cfg){
    const key=JSON.stringify(pr.ro)+'|'+pr.cfg.map;
    if(NET.roKey!==key){NET.roKey=key;buildClientGame(pr);}
  } else if(NET.roKey){NET.roKey=null;
    if(G&&G.net&&G.net.role==='client'){clearRanked('host');const showingEnd=!$('game').hidden&&!$('endOv').hidden;if(!showingEnd){G=null;show('roomScr');}}}
}
function buildClientGame(pr){
  NET.lastSnap=null;
  setMode(cleanMode(pr.cfg.mode));setMap(MAPS[pr.cfg.map]?pr.cfg.map:'classic');
  const kits=[kitOf(pr.cfg.kits?pr.cfg.kits[0]:0),kitOf(pr.cfg.kits?pr.cfg.kits[1]:1)];
  const cnt=[0,0];const players=pr.ro.filter(r=>Array.isArray(r)&&(r[1]===0||r[1]===1)).map(r=>{const t=r[1];const i=cnt[t]++;
    return {pid:String(r[0]),team:t,idx:i,human:!!r[5],local:r[0]===TAB,remote:false,avatar:cleanStr(r[2],2),name:cleanBad(cleanStr(r[3],14)),nameColor:cleanCol(r[4]),tag:cleanTag(r[6]),cel:cleanCel(r[7]),rating:Math.max(100,Math.min(3000,Number(r[8])||1000)),trail:cleanTrail(r[9]),sr:cleanTier(r[10]),g:0,a:0,x:0,y:0,tx:0,ty:0,r:PR,kick:false};});
  const mine=players.find(p=>p.local);
  G={net:{role:'client'},players,ball:{x:0,y:0,tx:0,ty:0,r:BR},kits,score:[0,0],clock:pr.cfg.time||180,state:'play',golden:false,paused:false,
    skin:SKINS[pr.cfg.skin]?pr.cfg.skin:'classic',mapKey:MAPS[pr.cfg.map]?pr.cfg.map:'classic',myTeam:mine?mine.team:-1,training:false,bubbles:{},ks:-1,gs:-1,snap:true,ended:false,size:Math.max(cnt[0],cnt[1],1),kickoff:true,rec:[],goals:[],pend:null,pip:null};
  NET.snap=null;NET.snapN=-1;NET.lastSnap=null;$('endOv').hidden=true;$('pauseOv').hidden=true;
  CELFX=[];preloadCels();loadGoalSnd();
  G.mid=typeof pr.mid==='string'?pr.mid.slice(0,48):'';G.builtAt=performance.now();
  if(mine&&players.filter(p=>p.human).length>=2){G.ranked=true;setLastMatch(NET.code);DB.matchBegin(NET.code).catch(()=>{});}
  if(mine){show('game');resize();sWhistle(0.45,1);}else if(NET.watch){show('game');resize();renderHud();}else renderRoom();
}
function acceptSnap(g){if(!g||!Array.isArray(g.s)||typeof g.n!=='number')return;if(g.n<NET.snapN&&NET.snapN-g.n<5000)return;NET.snapN=g.n;g._rt=performance.now();NET.snap=g;}
// ---------- Şüpheli hareket tespiti (oda sahibi hilesi) ----------
// Fizik sınırları: oyuncu en fazla ~2.5, top ~12 birim/tik gider. Bunun çok üstündeki sıçramalar, golsüz skor
// değişimi ya da saatin ileri atlaması şüphelidir. 3 puanı geçen oyuncu maçı onaylamaz ve oda sahibini otomatik şikâyet eder.
function anomCheck(a,b){
  if(!G||!G.net||G.net.role!=='client'||G.myTeam<0&&!NET.watch)return;
  const now=performance.now();if(now-(G.builtAt||0)<3000||now-(NET.hostChangeAt||0)<4000)return;
  if(a.st!=='play'||b.st!=='play'||a.ko||b.ko||a.pa||b.pa||b.gs!==a.gs)return;
  const rt=Math.max(1,((b._rt||now)-(a._rt||now))/16.7),ct=Math.max(0,(Number(a.c)-Number(b.c))*60),ticks=Math.max(rt,ct)+3;
  const hits=[];
  for(let i=0;i*3<b.s.length&&i*3<a.s.length;i++){const d=Math.hypot(b.s[3*i]-a.s[3*i],b.s[3*i+1]-a.s[3*i+1]);if(d>4*ticks+45)hits.push(['oyuncu ışınlandı',1]);}
  if(Array.isArray(a.b)&&Array.isArray(b.b)){const d=Math.hypot(b.b[0]-a.b[0],b.b[1]-a.b[1]);if(d>15*ticks+45)hits.push(['top ışınlandı',1]);}
  if(Array.isArray(a.sc)&&Array.isArray(b.sc)&&(b.sc[0]!==a.sc[0]||b.sc[1]!==a.sc[1]))hits.push(['golsüz skor değişimi',3]);
  if(!b.gd&&Number(a.c)-Number(b.c)>rt/60+5)hits.push(['saat ileri atladı',3]);
  if(!hits.length)return;
  G.anom=(G.anom||0)+hits.reduce((x,h)=>x+h[1],0);G.anomKinds=[...new Set([...(G.anomKinds||[]),...hits.map(h=>h[0])])];
  if(G.anom>=3&&!G.anomFlag){G.anomFlag=true;const h=hostPeerOf(NET.room);const hu=h&&h.presence.u;
    if(hu&&hu!==uid)DB.report(hu,'hile','Otomatik tespit: '+G.anomKinds.join(', ')+' · oda '+NET.code).catch(()=>{});
    afkToast('Bu maçta şüpheli hareket tespit edildi ve yöneticiye bildirildi. Maç sonucu senin onayınla sayılmayacak.',8000);}
}
function clientFrame(){
  const g=NET.snap;
  if(g&&g!==NET.lastSnap){
    if(NET.lastSnap)anomCheck(NET.lastSnap,g);
    NET.lastSnap=g;
    G.players.forEach((p,i)=>{const x=g.s[3*i],y=g.s[3*i+1];if(typeof x==='number'&&typeof y==='number'){p.tx=x;p.ty=y;p.kick=!!g.s[3*i+2];}});
    if(Array.isArray(g.b)){G.ball.tx=g.b[0];G.ball.ty=g.b[1];}
    if(Array.isArray(g.sc))G.score=[Number(g.sc[0])||0,Number(g.sc[1])||0];
    G.clock=Number(g.c)||0;G.golden=!!g.gd;G.paused=!!g.pa;G.lk=Number.isInteger(g.lk)?g.lk:-1;
    if(Array.isArray(g.pg))G.players.forEach((p,i)=>{const v=g.pg[i];if(Array.isArray(v)){p.g=Math.max(0,Number(v[0])||0);p.a=Math.max(0,Number(v[1])||0);}});
    if(G.ks>=0&&g.ks>G.ks)sKick(1);G.ks=g.ks;
    if(G.gs>=0&&g.gs>G.gs){const t=g.lg;startCel(G.players[Number(g.gi)],t);goalBanner(G.myTeam<0||t===G.myTeam?'GOL!':'GOL YEDİK',Number(g.gi),Number(g.ai));sCrowd();if(Array.isArray(g.sc))G.score=[Number(g.sc[0])||0,Number(g.sc[1])||0];repGoal(t,Number(g.gi),Number(g.ai),-1);}
    if(g.st==='play'||g.st==='over')$('banner').classList.remove('on');
    G.gs=g.gs;
    if(g.st==='over'&&!G.ended){G.ended=true;G.state='over';showEnd();}
    renderHud();
  }
  const k=G.snap?1:0.5;G.snap=false;
  for(const o of [...G.players,G.ball]){if(Math.hypot(o.tx-o.x,o.ty-o.y)>70){o.x=o.tx;o.y=o.ty;}else{o.x+=(o.tx-o.x)*k;o.y+=(o.ty-o.y)*k;}}
  const me=G.players.find(p=>p.local);
  if(me&&!chatOpen()){const t={};humanInput(t);const q=[Math.round(t.ix*10),Math.round(t.iy*10),t.kick?1:0];const s=q.join(',');const now=performance.now();
    if(s!==NET.lastIn||now-NET.lastInAt>120){NET.lastIn=s;NET.lastInAt=now;
      const h=hostPeerOf(NET.room);const dc=h&&dcOpen(h.peer);
      if(dc){try{dc.send(JSON.stringify({in:q}));}catch(e){}}else if(s!==NET.lastInRelay||now-(NET.lastRelayAt||0)>300){NET.lastInRelay=s;NET.lastRelayAt=now;NET.room.send('in',{from:TAB,q});}}}
}
function showEnd(){
  clearRanked('end');
  const [a,c]=G.score,my=G.myTeam;
  $('endScore').textContent=`${a} – ${c}`;$('endLbl').textContent=`${G.kits[0].abbr} · ${G.kits[1].abbr}`;
  $('endMsg').textContent=my<0?(a===c?'Berabere.':(a>c?G.kits[0].name:G.kits[1].name)+' kazandı.'):((my===0?a>c:c>a)?'Kazandınız!':a===c?'Berabere.':'Kaybettiniz. Rövanş isteyin.');
  document.querySelectorAll('#endOv .rdelta').forEach(e=>e.remove());
  $('againBtn').textContent='Odaya dön';$('endMenu').textContent='Odadan çık';renderEndStats();renderEndGoals();$('endOv').hidden=false;
  recordMyMatch();adAfterMatch();endExtras();
  const lc=NET.isHost?NET.cfg:(hostPeerOf(NET.room)||{presence:{}}).presence.cfg;
  if(lc&&lc.cup&&my>=0&&a!==c)DB.cupRpc('cup_report',{p_match:lc.cup,p_home:a,p_away:c}).then(()=>{$('endMsg').textContent+=' Kupa skoru kaydedildi, rakip kaptanın onayı bekleniyor.';}).catch(()=>{});
  if(lc&&lc.league&&my>=0)DB.leagueRpc('report_league_result',{p_match:lc.league,p_home:a,p_away:c}).then(()=>{$('endMsg').textContent+=' Lig skoru kaydedildi, rakip kaptanın onayı bekleniyor.';}).catch(()=>{});
}

// ---------- Oyun içi sohbet ----------
const gIn=$('gchatIn'),gForm=$('gchatForm'),gQuick=$('gchatQuick');
QUICK.forEach(q=>{const b=document.createElement('button');b.className='chip';b.type='button';b.textContent=q;b.onclick=()=>{sendChat('room',q);closeChat();};gQuick.appendChild(b);});
function chatOpen(){return !gForm.hidden;}
function openChat(){if(!G||!G.net)return;gForm.hidden=false;gQuick.hidden=false;gIn.value='';setTimeout(()=>gIn.focus(),0);for(const k in keys)keys[k]=false;}
function closeChat(){gForm.hidden=true;gQuick.hidden=true;gIn.blur();}
gForm.addEventListener('submit',e=>{e.preventDefault();sendChat('room',gIn.value);closeChat();});
gIn.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeChat();}e.stopPropagation();});
$('chatBtn').onclick=()=>chatOpen()?closeChat():openChat();
EMOTES.forEach(e=>{const b=document.createElement('button');b.type='button';b.textContent=e;b.onclick=()=>{sendChat('room',e);$('emoteBar').hidden=true;};$('emoteBar').appendChild(b);});
$('emoteBtn').onclick=()=>{$('emoteBar').hidden=!$('emoteBar').hidden;};
function pushGameChat(e){const log=$('gchatLog');const d=document.createElement('div');const b=nickEl(e.tg,e.nick+': ',e.me?'var(--flood)':e.col);d.append(b,document.createTextNode(e.text));log.appendChild(d);
  while(log.childElementCount>6)log.firstChild.remove();setTimeout(()=>d.classList.add('old'),7000);setTimeout(()=>d.remove(),7800);}
function drawBubbles(){
  if(!G||!G.bubbles)return;const now=performance.now();
  for(const p of G.players){const bb=G.bubbles[p.pid];if(!bb||bb.until<now)continue;
    const a=Math.min(1,(bb.until-now)/400);ctx.save();ctx.globalAlpha=a;
    if(isEmote(bb.text)){const age=now-(bb.until-4200),sc=age<180?0.4+age/180*0.8:age<300?1.2-(age-180)/120*0.2:1;ctx.font=`${Math.round(30*sc)}px system-ui,'Apple Color Emoji','Segoe UI Emoji',sans-serif`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(bb.text,p.x,p.y-p.r-6-Math.min(10,age/60));ctx.restore();continue;}
    ctx.font='600 12px Inter,system-ui,sans-serif';
    const t=bb.text.length>28?bb.text.slice(0,27)+'…':bb.text;const w=ctx.measureText(t).width+14,h=20,x=p.x-w/2,y=p.y-p.r-h-10;
    ctx.fillStyle='rgba(255,255,255,.95)';ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,8):ctx.rect(x,y,w,h);ctx.fill();
    ctx.beginPath();ctx.moveTo(p.x-5,y+h);ctx.lineTo(p.x+5,y+h);ctx.lineTo(p.x,y+h+6);ctx.fill();
    ctx.fillStyle='#111';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,p.x,y+h/2+1);ctx.restore();}
}

// =====================================================================
// ---------- Profil sekmesi ----------
// =====================================================================
let saveT=null;
function queueSave(){$('saveState').textContent='Kaydediliyor…';clearTimeout(saveT);saveT=setTimeout(async()=>{try{await DB.saveProfile();$('saveState').textContent='Kaydedildi.';}catch(e){$('saveState').textContent='Kaydedilemedi: '+errText(e);}},700);
  renderMe();pushLobby();if(NET.room)pushRoom();}
function renderMe(){const mn=$('meNick');mn.textContent='';mn.appendChild(nickEl(myTag(),prof.name,'','span'));mn.appendChild(rankEl(MYR.r,MYR.g,false));if(EXTRA.streak>0){const f=document.createElement('span');f.className='streak'+(EXTRA.today?'':' dim');f.title=EXTRA.today?`${EXTRA.streak} gündür her gün oynuyorsun`:`${EXTRA.streak} günlük serin var, bugün bir maç oyna ki bozulmasın`;f.textContent='🔥'+EXTRA.streak;mn.appendChild(f);}if(NET.lobby)pushTag();$('meAv').textContent=prof.avatar;const k=myTeamCache&&myTeamCache.team?cleanKit(myTeamCache.team.kit):{p:prof.p};$('meAv').style.background=k.p;$('meAv').style.color=lum(k.p)>0.6?'#111':'#fff';}
// ---------- Oyuncu istatistikleri ----------
const ago=t=>{const s=(Date.now()-new Date(t).getTime())/1000;if(!(s>=0))return'';if(s<3600)return Math.max(1,Math.round(s/60))+' dk önce';if(s<86400)return Math.round(s/3600)+' sa önce';return Math.round(s/86400)+' gün önce';};
function statsView(box,d){
  box.innerHTML='';
  const tiles=document.createElement('div');tiles.className='stattiles';
  [['Maç',d.played],['Gol',d.goals],['Asist',d.assists],['Galibiyet',d.won]].forEach(([l,v])=>{const t=document.createElement('div');const b=document.createElement('b');b.textContent=Number(v)||0;const s=document.createElement('span');s.textContent=l;t.append(b,s);tiles.appendChild(t);});
  box.appendChild(tiles);
  {const k=rankOf(d.rating||1000,d.rgames||0);const rb=document.createElement('div');rb.className='rankbar';rb.dataset.own=box.id==='myStats'?'1':'';rb.style.setProperty('--rk',k.c);
   const nx=RANKS.find(x=>x[0]>k.r);rb.innerHTML='<div class="rbig"></div><b></b><span></span><i><em></em></i>';rb.querySelector('.rbig').innerHTML=rankSvg(k.n);rb.querySelector('b').textContent=k.n==='Yerleşiyor'?'Yeni oyuncu':k.n;
   rb.querySelector('span').textContent=k.n==='Yerleşiyor'?`${Math.max(0,5-(d.rgames||0))} maç sonra lige yerleşir`:`${k.r} puan`+(nx?` · ${nx[1]} için ${nx[0]-k.r}`:'');
   const lo=[...RANKS].reverse().find(x=>x[0]<=k.r)||RANKS[0];rb.querySelector('em').style.width=(nx?Math.max(4,Math.min(100,(k.r-lo[0])/(nx[0]-lo[0])*100)):100)+'%';box.appendChild(rb);}
  if(box.id==='myStats'){const w=document.createElement('div');w.className='myrew';const h=document.createElement('span');h.textContent='Sezon ödüllerin: ';w.appendChild(h);
    if(!MYREW.length){const n=document.createElement('span');n.className='muted';n.textContent=`henüz yok · bu sezon bitişe ${seasonLeft()}, ay sonunda 1100+ puanla bitir`;w.appendChild(n);}
    MYREW.forEach(r=>{const t=TIERS[r.tier];const b=document.createElement('span');b.className='rewb';b.style.setProperty('--tc',t.c);b.textContent=`${t.i} ${t.n} · ${seasonName(r.season)}`;w.appendChild(b);});
    box.appendChild(w);}
  const last=Array.isArray(d.last)?d.last:[];
  const h=document.createElement('div');h.className='lbl';h.textContent='Son 10 maç';box.appendChild(h);
  if(!last.length){const e=document.createElement('div');e.className='empty';e.textContent='Henüz kayıtlı maç yok. Başka oyuncularla oynanan oda maçları sayılır.';box.appendChild(e);return;}
  const tb=document.createElement('table');tb.className='lastm';tb.innerHTML='<thead><tr><th></th><th>Skor</th><th>Gol</th><th>Asist</th><th>Saha</th><th></th></tr></thead><tbody></tbody>';
  const RL={W:'G',D:'B',L:'M'};
  for(const m of last){const tr=document.createElement('tr');const r=['W','D','L'].includes(m.result)?m.result:'D';
    [[RL[r],'r '+r],[`${Number(m.gf)||0}–${Number(m.ga)||0}`],[Number(m.goals)||0],[Number(m.assists)||0],[MAPS[m.map]?MAPS[m.map].name:'?'],[ago(m.played_at),'muted']].forEach(([v,c])=>{const td=document.createElement('td');td.textContent=v;if(c)td.className=c;tr.appendChild(td);});
    tb.tBodies[0].appendChild(tr);}
  box.appendChild(tb);
}
async function openStats(u,nick,tg){
  const ov=$('statOv'),body=$('statBody');ov.hidden=false;body.innerHTML='';
  const h=document.createElement('h2');h.style.justifyContent='center';h.appendChild(nickEl(tg,nick||'Oyuncu','','span'));body.appendChild(h);
  const box=document.createElement('div');box.innerHTML='<p class="note">Yükleniyor…</p>';body.appendChild(box);
  if(typeof u==='string'&&u&&u!==uid){const act=document.createElement('div');act.className='modrow';
    const mb=document.createElement('button');mb.className='chip';const ml=()=>mb.textContent=isMuted(u)?'Susturmayı kaldır':'Sohbetini gizle';ml();mb.onclick=()=>{toggleMute(u);ml();};
    const rb=document.createElement('button');rb.className='chip danger';rb.textContent='Şikâyet et';rb.onclick=()=>reportForm(act,u,nick);
    const fb=document.createElement('button');fb.className='chip';const fs=()=>{const f=FRIENDS.find(x=>x.id===u);fb.textContent=!f?'Arkadaş ekle':f.status==='accepted'?'Arkadaşsınız ✓':f.incoming?'İsteği kabul et':'İstek gönderildi';fb.disabled=!!f&&(f.status==='accepted'||!f.incoming);};fs();
    fb.onclick=async()=>{try{await DB.friendReq(u);frPing(u);await loadFriends(true);fs();}catch(e){fb.textContent=errText(e);}};
    act.append(fb,mb,rb);body.appendChild(act);}
  const c=document.createElement('button');c.className='ghost';c.style.justifyContent='center';c.textContent='Kapat';c.onclick=()=>ov.hidden=true;body.appendChild(c);
  if(typeof u!=='string'||!u){box.innerHTML='<p class="note">Bu oyuncunun istatistikleri görünmüyor (eski sürümü kullanıyor olabilir).</p>';return;}
  try{statsView(box,await DB.playerSummary(u));}catch(e){box.innerHTML='';const p=document.createElement('p');p.className='err';p.textContent='İstatistik alınamadı: '+errText(e);box.appendChild(p);}
}
const REASONS=[['kufur','Küfür / hakaret'],['hile','Hile'],['troll','Kasıtlı kötü oyun / troll'],['isim','Uygunsuz isim'],['diger','Diğer']];
function reportForm(box,u,nick){
  box.innerHTML='';const f=document.createElement('form');f.className='repform';
  const h=document.createElement('b');h.textContent=nick+' adlı oyuncuyu neden şikâyet ediyorsun?';f.appendChild(h);
  const g=document.createElement('div');g.className='chips';let sel='';
  REASONS.forEach(([k,l])=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=l;b.onclick=()=>{sel=k;g.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};g.appendChild(b);});
  f.appendChild(g);const msg=document.createElement('p');msg.className='note';
  const send=document.createElement('button');send.className='big';send.type='submit';send.textContent='Şikâyeti gönder';f.append(send,msg);
  f.onsubmit=async e=>{e.preventDefault();if(!sel){msg.textContent='Bir sebep seç.';return;}
    const ctx=[...(NET.logs.room||new Map()).values(),...(NET.logs.lobby||new Map()).values()].filter(x=>x.u===u).slice(-8).map(x=>x.text).join(' | ');
    send.disabled=true;try{await DB.report(u,sel,ctx);f.innerHTML='<p class="note">Şikâyetin alındı, teşekkürler. 24 saat içinde birkaç kişiden şikâyet alan oyuncunun sohbeti otomatik kapanır; ağır durumları biz inceliyoruz.</p>';}
    catch(err){send.disabled=false;msg.textContent=/already reported/.test(err.message)?'Bu oyuncuyu bugün zaten şikâyet ettin.':/too many/.test(err.message)?'Bugün çok fazla şikâyet gönderdin.':errText(err);}};
  box.appendChild(f);
}
$('statOv').addEventListener('click',e=>{if(e.target.id==='statOv')$('statOv').hidden=true;});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('statOv').hidden)$('statOv').hidden=true;});
async function renderMyStats(){const box=$('myStats');if(!box)return;box.innerHTML='<p class="note">Yükleniyor…</p>';
  try{statsView(box,await DB.playerSummary(uid));renderCompete(box);if(MOD.leaves_total){const n=document.createElement('p');n.className='note leavenote';n.textContent=`Yarıda bıraktığın maç: ${MOD.leaves_total}`+(MOD.leaves_24h?` (son 24 saatte ${MOD.leaves_24h})`:'')+'. Her terk −20 beceri puanı ve 1 dakika maç bulma cezası getirir.';box.appendChild(n);}}catch(e){box.innerHTML='';const p=document.createElement('p');p.className='err';p.textContent='İstatistik alınamadı: '+errText(e);box.appendChild(p);}}
function renderProfile(){renderMyStats();renderLooks();renderQuests();
  $('inName').value=prof.name;renderJersey();
  const box=$('nameColors');box.innerHTML='';
  NAME_COLORS.forEach(col=>{const b=document.createElement('button');const lk=col!=='#ffffff'&&!owns('name_color');b.className='sw'+(lk?' locked':'');b.style.background=col;b.setAttribute('aria-label',col+(lk?' (kilitli)':''));b.setAttribute('aria-pressed',String(prof.nameColor===col));
    b.onclick=()=>{if(lk){lockMsg('Renkli isim');return;}prof.nameColor=col;save();renderProfile();queueSave();};box.appendChild(b);});
  drawPreview();
  $('acctInfo').textContent=!LIVE?'Yerel deneme modu: veriler sadece bu tarayıcıda.':isAnon?'Misafir hesapla oynuyorsun. Profilin ve takımın bu tarayıcıya bağlı. Google ile bağlarsan her cihazdan girersin.':'Google hesabınla bağlısın'+(userEmail?' ('+userEmail+')':'')+'.';
  $('googleLink').hidden=LIVE&&!isAnon;$('changeNick').hidden=!LIVE||isAnon;
}
function drawPreview(){
  const c=$('prevCv'),x=c.getContext('2d');x.clearRect(0,0,300,300);
  const k=myTeamCache&&myTeamCache.team?cleanKit(myTeamCache.team.kit):userKit();
  drawDisc(x,150,128,80,k,prof.avatar,{name:prof.name,nameColor:prof.nameColor});
}
$('inName').addEventListener('input',e=>{const v=cleanStr(e.target.value,14).trim();if(hasBad(v)){$('saveState').textContent='Bu ad uygun değil.';return;}prof.name=v||'Oyuncu';save();drawPreview();queueSave();});
let JCARDS=1;
function renderJersey(){
  const box=$('jerseyBox');if(!box)return;box.innerHTML='';
  const cur=document.createElement('div');cur.className='jcur';cur.innerHTML='<span class="jnum"></span><div><b>Forma numaran</b><small></small></div>';
  cur.querySelector('.jnum').textContent=prof.avatar;cur.querySelector('small').textContent=JCARDS>0?`${JCARDS} forma değiştirme kartın var`:'Forma değiştirme kartın yok';
  const btn=document.createElement('button');btn.className='chip'+(JCARDS>0?' go':'');btn.type='button';btn.textContent=JCARDS>0?'Kartı kullan, numaramı değiştir':'Mağazadan kart al';
  btn.onclick=()=>{if(JCARDS<1){document.getElementById('storeJersey')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
    const f=document.createElement('form');f.className='jform';f.innerHTML='<input type="number" min="1" max="99" inputmode="numeric" placeholder="1–99" required><button class="chip go" type="submit">Onayla (1 kart)</button><button class="chip" type="button">Vazgeç</button><p class="note">Kart bir kez kullanılır; sonraki değişiklik için mağazadan yeni kart alman gerekir.</p>';
    const inp=f.querySelector('input');f.querySelector('button[type=button]').onclick=renderJersey;
    f.onsubmit=async e=>{e.preventDefault();const v=String(inp.value).trim();if(!/^[1-9][0-9]?$/.test(v)){f.querySelector('.note').textContent='1 ile 99 arasında bir numara yaz.';return;}
      if(v===String(prof.avatar)){f.querySelector('.note').textContent='Zaten bu numarayı giyiyorsun.';return;}
      try{JCARDS=await DB.useJerseyCard(v);prof.avatar=v;save();renderJersey();drawPreview();renderMe();pushLobby();if(NET.room)pushRoom();$('saveState').textContent='Forma numaran '+v+' oldu.';}catch(err){f.querySelector('.note').textContent=/no jersey cards/.test(err.message)?'Kartın kalmamış.':errText(err);}};
    box.appendChild(f);btn.remove();setTimeout(()=>inp.focus());};
  box.append(cur,btn);
  const sb2=$('buyJersey');if(sb2){sb2.disabled=JCARDS>=5;sb2.textContent=JCARDS>=5?'En fazla 5 kart birikir':'Kart al';}
  const own=$('jerseyOwned');if(own)own.textContent=`Elindeki kart: ${JCARDS}`;
}
// ---------- Mağaza: ürünler satışta değil, yöneticinin verdiği kısa ömürlü kodla açılır ----------
const ITEM_TR={name_color:'Renkli isim',jersey_card:'Forma değiştirme kartı',starter:'Başlangıç paketi',skin_night:'Gece Işıkları sahası',skin_beach:'Plaj sahası',skin_snow:'Kar Fırtınası sahası',skin_rain:'Sağanak sahası',skin_drizzle:'Çisenti sahası',skin_sakura:'Kiraz Bahçesi sahası',skins_all:'6 saha birlikte',cel_confetti:'Konfeti sevinci',cel_fireworks:'Havai fişek sevinci',cel_fire:'Ateş izi sevinci',cel_banner:'Altın pankart sevinci',premium:'Premium üyelik (30 gün)',team_premium:'Takım premium'};
function renderStore(){document.querySelectorAll('.store .item[data-own]').forEach(el=>{const k=el.dataset.own,its=k.split(' ');
  const n=k==='team_premium'?(myTeamCache&&myTeamCache.team&&myTeamCache.team.premium?1:0):k==='starter'?0:its.filter(owns).length;const all=n>0&&n>=its.length;
  let st=el.querySelector('.own');if(!st){st=document.createElement('span');el.appendChild(st);}st.className='own'+(all?' yes':n?' part':'');
  st.textContent=k==='premium'&&OWN.prem?'✓ Sende · '+new Date(OWN.prem).toLocaleDateString('tr-TR',{day:'numeric',month:'long'})+' tarihine kadar':all?'✓ Sende':n?`✓ ${n}/${its.length} sende`:'🔒 Kilitli';});}
async function loadOwned(){try{const r=await DB.myItems();OWN.items=new Set(Array.isArray(r.items)?r.items:[]);OWN.prem=r.premium_until||null;}catch(e){}
  const ch=enforceOwned();markLocks();if(ch){try{queueSave();pushTag();}catch(e){}}if(curTab==='profile')renderProfile();}
$('redeemCode').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
$('redeemForm').onsubmit=async e=>{e.preventDefault();const inp=$('redeemCode'),msg=$('redeemMsg'),b=e.target.querySelector('button');const c=inp.value.replace(/[^a-z0-9]/gi,'').toUpperCase();
  if(c.length<6){msg.className='err';msg.textContent='Kodu eksiksiz yaz (6 karakter).';return;}
  b.disabled=true;msg.className='note';msg.textContent='Kontrol ediliyor…';
  try{const r=await DB.redeemCode(c);inp.value='';
    if(r.item==='jersey_card'||r.item==='starter'){const p=await DB.getProfile().catch(()=>null);if(p){JCARDS=Number(p.jersey_cards)||0;renderJersey();}}
    if(r.item==='team_premium')myTeamCache=await DB.myTeam().catch(()=>myTeamCache);
    await loadOwned();msg.className='note okmsg';msg.textContent=`✓ ${ITEM_TR[r.item]||'Ürün'} açıldı.`+(r.item==='team_premium'?' Takım sekmesinden formayı düzenleyebilirsin.':r.item==='jersey_card'?' Profilde forma numaranı değiştirebilirsin.':' Profil sekmesinden seçebilirsin.');}
  catch(err){msg.className='err';msg.textContent=/expired/.test(err.message)?'Bu kodun süresi dolmuş. Yeni kod iste.':/invalid/.test(err.message)?'Kod geçersiz ya da daha önce kullanılmış.':/too many/.test(err.message)?'Çok fazla hatalı deneme. 10 dakika sonra tekrar dene.':/not captain/.test(err.message)?'Takım premium kodunu takım kaptanı kullanmalı.':errText(err);}
  finally{b.disabled=false;}};
$('googleLink').onclick=googleSignIn;$('gateGoogle').onclick=googleSignIn;
$('changeNick').onclick=async()=>{if(LIVE){await sb.auth.signOut();}try{localStorage.removeItem('uzk-profile'+SLOT);}catch(e){}location.reload();};

// =====================================================================
// ---------- Takım sekmesi ----------
// =====================================================================
let myTeamCache=null;
function kitPicker(cur,onPick,allowPat=true){
  const wrap=document.createElement('div');wrap.style.display='flex';wrap.style.flexDirection='column';wrap.style.gap='8px';
  const k={...cur};if(!allowPat)k.pat='solid';
  const prev=document.createElement('canvas');prev.width=120;prev.height=120;prev.style.cssText='width:60px;height:60px';
  const redraw=()=>{const x=prev.getContext('2d');x.clearRect(0,0,120,120);drawDisc(x,60,60,54,k,'10');};
  const row=(label,list,key)=>{const l=document.createElement('div');l.className='lbl';l.textContent=label;const r=document.createElement('div');r.className='row';
    list.forEach(col=>{const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=col;b.setAttribute('aria-label',col);b.setAttribute('aria-pressed',String(k[key]===col));
      b.onclick=()=>{k[key]=col;[...r.children].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));redraw();onPick({...k});};r.appendChild(b);});wrap.append(l,r);};
  wrap.appendChild(prev);row('Ana renk',COLORS,'p');row('İkinci renk',COLORS,'s');
  const l=document.createElement('div');l.className='lbl';l.innerHTML='Desen <span class="pro">Takım premium</span>';const r=document.createElement('div');r.className='row';
  PATTERNS.forEach(([v,lab])=>{const b=document.createElement('button');b.type='button';const lk=!allowPat&&v!=='solid';b.className='chip'+(lk?' locked':'');b.textContent=lab;b.setAttribute('aria-pressed',String(k.pat===v));b.onclick=()=>{if(lk){lockMsg('Desenli forma');return;}k.pat=v;[...r.children].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));redraw();onPick({...k});};r.appendChild(b);});
  wrap.append(l,r);redraw();onPick({...k});return wrap;
}
async function renderTeam(){
  const P=$('tab-team');P.innerHTML='<div class="panel"><p class="note">Yükleniyor…</p></div>';
  let mt;try{mt=await DB.myTeam();}catch(e){P.innerHTML='';const d=document.createElement('div');d.className='panel';d.innerHTML='<h2>Takım</h2><p class="err"></p>';d.querySelector('.err').textContent='Takım bilgisi alınamadı: '+errText(e);P.appendChild(d);return;}
  myTeamCache=mt;renderMe();renderStore();P.innerHTML='';
  if(!mt){
    const grid=document.createElement('div');grid.className='cols2';
    const a=document.createElement('form');a.className='panel';
    a.innerHTML='<h2>Takım kur</h2><div class="row"><div class="field"><label class="lbl" for="tName">Takım adı</label><input id="tName" type="text" maxlength="24" required minlength="2"></div><div class="field" style="flex:0 1 110px"><label class="lbl" for="tAbbr">Kısaltma</label><input id="tAbbr" type="text" maxlength="3" minlength="2" required></div></div><div id="tKit"></div><button class="big" type="submit">Takımı kur</button><p class="err" id="tErr"></p><p class="note">Takımın 6. Lig\'den başlar. Kaptan sensin; arkadaşlarını takım koduyla davet edersin.</p>';
    let kit={p:prof.p,s:prof.s,pat:'solid'};a.querySelector('#tKit').appendChild(kitPicker(kit,k=>kit=k,false));
    a.querySelector('#tAbbr').addEventListener('input',e=>{e.target.value=e.target.value.toLocaleUpperCase('tr-TR');});
    a.onsubmit=async e=>{e.preventDefault();const name=cleanStr(a.querySelector('#tName').value,24).trim(),abbr=cleanStr(a.querySelector('#tAbbr').value,3).trim().toLocaleUpperCase('tr-TR');
      if(name.length<2||abbr.length<2){a.querySelector('#tErr').textContent='Takım adı ve kısaltma en az 2 karakter olmalı.';return;}
      if(hasBad(name)||hasBad(abbr)){a.querySelector('#tErr').textContent='Bu takım adı uygun değil.';return;}
      try{await DB.createTeam(name,abbr,cleanKit(kit));renderTeam();}catch(err){a.querySelector('#tErr').textContent=errText(err);}};
    const b=document.createElement('form');b.className='panel';
    b.innerHTML='<h2>Takıma katıl</h2><p class="note">Kaptandan takım kodunu iste.</p><div class="field"><label class="lbl" for="tCode">Takım kodu</label><input id="tCode" type="text" maxlength="12" autocomplete="off"></div><button class="chip" type="submit">Katıl</button><p class="err" id="jErr"></p>';
    b.onsubmit=async e=>{e.preventDefault();const c=cleanStr(b.querySelector('#tCode').value,12).trim().toLowerCase();if(!c)return;try{await DB.joinTeam(c);renderTeam();}catch(err){b.querySelector('#jErr').textContent=errText(err);}};
    grid.append(a,b);P.appendChild(grid);return;
  }
  const t=mt.team,cap=mt.role==='kaptan',kit=cleanKit(t.kit);
  const head=document.createElement('div');head.className='panel';
  head.innerHTML='<h2><canvas width="56" height="56" style="width:28px;height:28px"></canvas><span class="tn"></span> <span class="tag ab"></span></h2><div class="note info"></div>';
  {const L=teamLvl(t.xp);const lv=document.createElement('div');lv.className='tlvl'+(L.l>=10?' l10':L.l>=5?' l5':'');lv.innerHTML='<b></b><div class="tlbar"><i></i></div><span></span>';
    lv.querySelector('b').textContent=`Takım seviyesi ${L.l}`;lv.querySelector('i').style.width=Math.round((L.xp-L.a)/(L.b-L.a)*100)+'%';
    lv.querySelector('span').textContent=`${L.xp} XP · ${L.l+1}. seviyeye ${L.b-L.xp} XP · üyelerin her maçı XP kazandırır (galibiyet 3, beraberlik 2, mağlubiyet 1)`+(L.l<5?' · 5. seviyede rozet parlar':L.l<10?' · 10. seviyede altın rozet':'');head.appendChild(lv);}
  head.querySelector('.tn').textContent=t.name;head.querySelector('.ab').textContent=t.abbr;drawBadge(head.querySelector('canvas'),cleanKit(t.kit||kit));
  head.querySelector('.info').textContent=`${t.tier}. Lig · ${t.points} puan · ${t.played} maç (${t.won}G ${t.drawn}B ${t.lost}M) · averaj ${t.gf-t.ga>=0?'+':''}${t.gf-t.ga} · rolün: ${cap?'Kaptan':'Oyuncu'}`;
  P.appendChild(head);
  const grid=document.createElement('div');grid.className='cols2';P.appendChild(grid);
  const ros=document.createElement('div');ros.className='panel';ros.innerHTML='<h2>Kadro <span class="tag cnt"></span></h2><div class="roster"></div>';grid.appendChild(ros);
  const side=document.createElement('div');side.className='panel';grid.appendChild(side);
  try{const ms=await DB.members(t.id);ros.querySelector('.cnt').textContent=ms.length+'/'+(t.premium?16:12);const R=ros.querySelector('.roster');
    ms.forEach(m=>{const r=document.createElement('div');r.className='r';const av=document.createElement('span');av.className='av';av.style.cssText=`width:24px;height:24px;border-radius:50%;border:2px solid #000;display:grid;place-items:center;font-family:var(--f-display);font-weight:800;font-size:12px;background:${kit.p};color:${lum(kit.p)>0.6?'#111':'#fff'}`;av.textContent=cleanStr(m.avatar,2)||'?';
      const nm=document.createElement('span');nm.className='nm';nm.textContent=cleanStr(m.nick,14)+(m.user_id===uid?' (sen)':'');nm.style.color=cleanCol(m.name_color);
      const ro=document.createElement('span');ro.className='role';ro.textContent=m.role;r.append(av,nm,ro);
      if(cap&&m.user_id!==uid){const k=document.createElement('button');k.className='chip';k.textContent='Çıkar';k.onclick=async()=>{try{await DB.kick(t.id,m.user_id);renderTeam();}catch(e){alert(errText(e));}};r.appendChild(k);}
      R.appendChild(r);});}catch(e){ros.querySelector('.roster').textContent='Kadro alınamadı: '+errText(e);}
  if(cap){side.innerHTML='<h2>Davet</h2><p class="note">Bu kodu takım arkadaşlarına gönder. Takım sekmesinde "Takıma katıl"a yazsınlar.</p><div class="row" style="align-items:center"><span class="codebox" id="tcode">…</span><button class="chip" id="tcopy">Kopyala</button></div><h2 style="margin-top:8px">Takım forması</h2><div id="tkit"></div><button class="chip" id="tkitSave">Formayı kaydet</button><p class="note" id="tkitMsg"></p>';
    DB.teamCode(t.id).then(c=>{side.querySelector('#tcode').textContent=c||'—';}).catch(()=>{side.querySelector('#tcode').textContent='alınamadı';});
    side.querySelector('#tcopy').onclick=()=>{const c=side.querySelector('#tcode').textContent;try{navigator.clipboard.writeText(c);side.querySelector('#tcopy').textContent='Kopyalandı';}catch(e){}};
    let nk={...cleanKit(t.kit||kit)};side.querySelector('#tkit').appendChild(kitPicker(nk,k=>nk={...k,badge:nk.badge},!!t.premium));if(t.premium)side.querySelector('#tkit').appendChild(badgePicker(nk,k=>nk={...nk,badge:k.badge}));else{const n=document.createElement('p');n.className='note';n.textContent='🔒 Desenli forma, takım arması ve 16 kişilik kadro takım premium ile açılır. Kodu mağazadan kaptan kullanır.';side.querySelector('#tkit').appendChild(n);}
    side.querySelector('#tkitSave').onclick=async()=>{try{await DB.updateKit(t.id,cleanKit(nk));side.querySelector('#tkitMsg').textContent='Forma kaydedildi.';myTeamCache.team.kit=cleanKit(nk);renderMe();}catch(e){side.querySelector('#tkitMsg').textContent=errText(e);}};
  } else side.innerHTML='<h2>Takım</h2><p class="note">Formayı ve kadroyu kaptan yönetir. Lig maçları için kaptanınla haberleş.</p>';
  const lv=document.createElement('button');lv.className='ghost';lv.style.justifyContent='center';lv.textContent=cap?'Takımdan ayrıl (kaptanlık en eski oyuncuya geçer)':'Takımdan ayrıl';
  let sure=false;lv.onclick=async()=>{if(!sure){sure=true;lv.textContent='Emin misin? Tekrar bas.';return;}try{await DB.leaveTeam();myTeamCache=null;renderTeam();}catch(e){lv.textContent=errText(e);}};
  side.appendChild(lv);
}

// =====================================================================
// ---------- Lig sekmesi ----------
// =====================================================================
const TIER_NAMES=['Elit Lig','2. Lig','3. Lig','4. Lig','5. Lig','6. Lig'];
const fmtWhen=iso=>{const d=new Date(iso);const now=new Date();const day=d.toDateString()===now.toDateString()?'Bugün':d.toDateString()===new Date(now.getTime()+864e5).toDateString()?'Yarın':d.toLocaleDateString('tr-TR',{day:'numeric',month:'short',weekday:'short'});return day+' '+d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});};
const LM_ST={proposed:'Teklif',accepted:'Kesinleşti',reported:'Onay bekliyor',played:'Oynandı',declined:'Reddedildi',cancelled:'İptal'};
function joinLeagueMatch(m,TT,cup){
  const code=leagueCode((cup?'c':'')+m.id);const h=TT[m.home],a=TT[m.away];if(!h||!a)return;
  showMain('rooms');
  if(lobbyRooms().some(r=>r.code===code)){NET.want='spec';enterRoom(code);return;}
  createRoom({code,name:`${h.abbr} – ${a.abbr} · ${cup?'Kupa':'Lig'}`,map:'classic',max:12,time:300,goals:0,priv:true,free:false,league:cup?null:m.id,cup:cup?m.id:null,lteam:1,home:m.home,away:m.away,
    kits:[{name:h.name,abbr:h.abbr,...cleanKit(h.kit)},{name:a.name,abbr:a.abbr,...cleanKit(a.kit)}]});
}
const RNAME=(r,R)=>r===R?'Final':r===R-1?'Yarı final':r===R-2?'Çeyrek final':r+'. tur';
async function renderCup(box,TT,myId,cap){
  const sec=document.createElement('section');sec.className='cupbox';box.appendChild(sec);sec.innerHTML='<p class="note">Kupa yükleniyor…</p>';
  let d;try{d=await DB.cup(await DB.cupTick());}catch(e){sec.innerHTML='';return;}
  if(!d){sec.remove();return;}
  const c=d.cup,ent=d.entries.map(e=>e.team_id),tn=id=>TT[id]?TT[id].name:id?'?':'—',start=new Date(c.starts_at),now=new Date();
  sec.innerHTML='<header><img src="assets/tier1.webp" alt=""><div><b></b><span></span></div><div class="cupact"></div></header><div class="cupbody"></div><p class="err cupmsg"></p>';
  sec.querySelector('header b').textContent=c.name;
  const msg=sec.querySelector('.cupmsg'),act=sec.querySelector('.cupact'),body=sec.querySelector('.cupbody');
  const left=start-now,dd=Math.floor(left/864e5),hh=Math.floor(left%864e5/36e5),mm=Math.floor(left%36e5/6e4);
  sec.querySelector('header span').textContent=c.status==='open'?`${start.toLocaleString('tr-TR',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})} · ${left>0?(dd?dd+' gün ':'')+hh+' sa '+mm+' dk kaldı':'kura çekiliyor'} · ${ent.length}/8 takım`:c.status==='running'?'Turnuva sürüyor · eleme usulü, beraberlikte altın gol':c.status==='done'?'Şampiyon: '+tn(c.winner):'Yeterli takım kaydolmadığı için iptal edildi. Bir sonraki Cumartesi 21:00.';
  const B=(t,fn,cls)=>{const b=document.createElement('button');b.className='chip'+(cls?' '+cls:'');b.textContent=t;b.onclick=fn;return b;};
  const go=async(fn,args)=>{try{await DB.cupRpc(fn,args);renderLeague();}catch(e){msg.textContent=errText(e);}};
  if(c.status==='open'){
    if(cap&&myId){const inn=ent.includes(myId);act.appendChild(B(inn?'Kaydı geri al':'Takımımı kaydet',()=>go('cup_join',{p_cup:c.id,p_join:!inn}),inn?'':'go'));}
    else if(!myId)act.innerHTML='<span class="note">Katılmak için bir takımın olmalı</span>';
    const l=document.createElement('div');l.className='cupents';
    if(!ent.length)l.innerHTML='<p class="note">Henüz kayıt yok. Kaptanlar takımını kaydedebilir; en az 2, en fazla 8 takım. Kura başlama saatinde otomatik çekilir.</p>';
    ent.forEach(id=>{const s=document.createElement('span');s.className='cupent'+(id===myId?' me':'');s.textContent=tn(id);l.appendChild(s);});body.appendChild(l);}
  if(d.matches.length){
    const R=Math.round(Math.log2(c.size));const br=document.createElement('div');br.className='bracket';
    for(let r=1;r<=R;r++){const col=document.createElement('div');col.className='bcol';const h=document.createElement('div');h.className='bh';h.textContent=RNAME(r,R);col.appendChild(h);const bms=document.createElement('div');bms.className='bms';col.appendChild(bms);
      d.matches.filter(m=>m.round===r).sort((a,b)=>a.slot-b.slot).forEach(m=>{const mb=document.createElement('div');mb.className='bm st-'+m.status+((m.home===myId||m.away===myId)?' mine':'');
        [[m.home,m.home_score],[m.away,m.away_score]].forEach(([t,sc])=>{const row=document.createElement('div');row.className='bt'+(m.winner&&m.winner===t?' win':m.winner&&t?' lose':'');
          const n=document.createElement('span');n.textContent=t?tn(t):(r===1&&m.status==='played'?'(bay)':'…');const s2=document.createElement('b');s2.textContent=sc??'';row.append(n,s2);mb.appendChild(row);});
        const mine=myId&&(m.home===myId||m.away===myId);
        if(mine&&m.status==='ready'){const a=document.createElement('div');a.className='bact';
          if(now>=start-15*60e3)a.appendChild(B('Maça gir',()=>joinLeagueMatch(m,TT,true),'go'));
          a.appendChild(B('Skoru gir',()=>{const v=prompt(`${tn(m.home)} – ${tn(m.away)} skoru (örnek 3-2):`);const x=v&&v.match(/^\s*(\d{1,2})\s*[-–: ]\s*(\d{1,2})\s*$/);if(x)go('cup_report',{p_match:m.id,p_home:+x[1],p_away:+x[2]});}));mb.appendChild(a);}
        if(mine&&m.status==='reported'){const a=document.createElement('div');a.className='bact';
          if(cap&&m.reported_by!==myId)a.append(B('Onayla',()=>go('cup_confirm',{p_match:m.id,p_ok:true}),'go'),B('İtiraz',()=>go('cup_confirm',{p_match:m.id,p_ok:false})));
          else{const s3=document.createElement('span');s3.className='note';s3.textContent='Onay bekleniyor';a.appendChild(s3);}mb.appendChild(a);}
        bms.appendChild(mb);});
      br.appendChild(col);}
    if(c.status==='done'){const col=document.createElement('div');col.className='bcol champ';col.innerHTML='<div class="bh">Şampiyon</div><div class="bms"><div class="bchamp">🏆<b></b></div></div>';col.querySelector('b').textContent=tn(c.winner);br.appendChild(col);}
    body.appendChild(br);}
}
async function renderLeague(){
  const box=$('leagueGrid');box.innerHTML='<p class="note">Yükleniyor…</p>';
  await DB.leagueTick().catch(()=>{});
  let ts,mt,lm;try{[ts,mt,lm]=await Promise.all([DB.teams(),DB.myTeam().catch(()=>null),DB.leagueMatches().catch(()=>[])]);}catch(e){box.innerHTML='';const p=document.createElement('p');p.className='err';p.textContent='Lig bilgisi alınamadı: '+errText(e);box.appendChild(p);return;}
  myTeamCache=mt;box.innerHTML='';const myId=mt&&mt.team&&mt.team.id;const cap=mt&&mt.role==='kaptan';
  const TT={};ts.forEach(t=>TT[t.id]=t);const tn=id=>TT[id]?TT[id].name:'?';
  const LI=await DB.leagueInfo(myId).catch(()=>({titles:[],hist:[]}));const TITLES={};LI.titles.forEach(x=>{(TITLES[x.team_id]=TITLES[x.team_id]||[]).push(x);});
  const titleEl=id=>{const a=TITLES[id];if(!a||!a.length)return null;const s=document.createElement('span');s.className='ttl';s.textContent='🏆'+(a.length>1?a.length:'');s.title=a.map(x=>`${x.tier}. Kademe şampiyonu · ${seasonName(x.season)}`).join('\n');return s;};
  {const hd=document.createElement('section');hd.className='lseason';const n=new Date();
    hd.innerHTML='<b></b><span></span>';hd.querySelector('b').textContent=`⚽ ${seasonName(n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0'))} lig sezonu`;
    hd.querySelector('span').textContent=`Bitişe ${seasonLeft()} · sezon sonunda her kademede ilk 2 bir üste çıkar, son 2 bir alta düşer (en az 5 takım varsa) · kademe birincisi 🏆 kupa alır · puanlar sıfırlanır`;
    const h=LI.hist[0];if(h){const r=document.createElement('div');r.className='lsres '+(h.new_tier<h.tier?'up':h.new_tier>h.tier?'down':'');
      r.textContent=`Geçen sezon (${seasonName(h.season)}): ${h.tier}. Kademede ${h.pos}. oldunuz · ${h.points} puan`+(h.pos===1&&h.played>0?' · 🏆 Şampiyon!':'')+(h.new_tier<h.tier?` · ↑ ${h.new_tier}. Kademeye yükseldiniz`:h.new_tier>h.tier?` · ↓ ${h.new_tier}. Kademeye düştünüz`:' · kademenizde kaldınız');hd.appendChild(r);}
    box.appendChild(hd);}
  const act=async(fn,args,msgEl)=>{try{await DB.leagueRpc(fn,args);renderLeague();}catch(e){if(msgEl)msgEl.textContent=errText(e);}};
  const btn=(txt,cls,fn)=>{const b=document.createElement('button');b.className='chip'+(cls?' '+cls:'');b.textContent=txt;b.onclick=fn;return b;};
  renderCup(box,TT,myId,cap);
  renderRanking(box);
  // ---- Maçlarım ----
  if(myId){const me=TT[myId]||mt.team;const sec=document.createElement('section');sec.className='lmine';
    sec.innerHTML='<h3>Takımımın maçları</h3><div class="lmlist"></div><p class="err lmmsg"></p>';const list=sec.querySelector('.lmlist'),msg=sec.querySelector('.lmmsg');
    const mine=lm.filter(m=>m.home===myId||m.away===myId).filter(m=>['proposed','accepted','reported'].includes(m.status)||Date.now()-new Date(m.updated_at).getTime()<3*864e5);
    if(!mine.length)list.innerHTML='<p class="note">Henüz planlanmış maçınız yok.'+(cap?' Aşağıdan bir rakibe gün ve saat teklif et.':' Kaptanınız rakiplere maç teklif edebilir.')+'</p>';
    mine.forEach(m=>{const row=document.createElement('div');row.className='lmrow st-'+m.status;const home=m.home===myId;const opp=home?m.away:m.home;
      const t=new Date(m.scheduled_at).getTime(),now=Date.now();
      row.innerHTML='<div class="lmwhen"></div><div class="lmteams"></div><span class="lmst"></span><div class="lmact"></div>';
      row.querySelector('.lmwhen').textContent=fmtWhen(m.scheduled_at);
      row.querySelector('.lmteams').textContent=`${tn(m.home)} ${m.home_score!=null?m.home_score+' – '+m.away_score:'vs'} ${tn(m.away)}`;
      row.querySelector('.lmst').textContent=LM_ST[m.status]||m.status;
      const A=row.querySelector('.lmact');
      if(m.status==='proposed'){if(cap&&!home){A.append(btn('Kabul et','go',()=>act('respond_league_match',{p_match:m.id,p_accept:true},msg)),btn('Reddet','',()=>act('respond_league_match',{p_match:m.id,p_accept:false},msg)));}
        else{const s=document.createElement('span');s.className='note';s.textContent=home?'Rakip kaptanın cevabı bekleniyor':'Kaptanınızın cevabı bekleniyor';A.append(s);if(cap&&home)A.append(btn('Geri çek','',()=>act('cancel_league_match',{p_match:m.id},msg)));}}
      if(m.status==='accepted'){if(now>t-15*60e3)A.append(btn('Maça gir','go',()=>joinLeagueMatch(m,TT)));
        else{const s=document.createElement('span');s.className='note';const mins=Math.round((t-now)/60e3);s.textContent=mins<120?`${mins} dk sonra`:`Maç odası 15 dk önce açılır`;A.append(s);}
        if(cap&&now<t)A.append(btn('İptal','',()=>act('cancel_league_match',{p_match:m.id},msg)));
        if(now>t-30*60e3){A.append(btn('Skoru elle gir','',()=>{const v=prompt(`${tn(m.home)} – ${tn(m.away)} skoru (örnek 3-2):`);const r=v&&v.match(/^\s*(\d{1,2})\s*[-–: ]\s*(\d{1,2})\s*$/);if(r)act('report_league_result',{p_match:m.id,p_home:+r[1],p_away:+r[2]},msg);}));}}
      if(m.status==='reported'){if(cap&&m.reported_by!==myId)A.append(btn('Skoru onayla','go',()=>act('confirm_league_result',{p_match:m.id,p_ok:true},msg)),btn('İtiraz et','',()=>act('confirm_league_result',{p_match:m.id,p_ok:false},msg)));
        else{const s=document.createElement('span');s.className='note';s.textContent='Rakip kaptanın onayı bekleniyor';A.append(s);}}
      list.appendChild(row);});
    if(cap){const opps=ts.filter(t=>t.tier===me.tier&&t.id!==myId&&!lm.some(m=>['proposed','accepted','reported'].includes(m.status)&&[m.home,m.away].includes(t.id)&&[m.home,m.away].includes(myId)));
      const f=document.createElement('form');f.className='lmform';
      const d=new Date(Date.now()+864e5);d.setMinutes(0,0,0);d.setHours(21);const loc=new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,16);
      f.innerHTML=`<b>Maç teklif et</b><select required><option value="">Rakip seç (${me.tier}. Kademe)</option></select><input type="datetime-local" required value="${loc}"><button class="big" type="submit">Teklif gönder</button>`;
      const sel=f.querySelector('select');opps.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=`${t.name} (${t.abbr})`;sel.appendChild(o);});
      if(!opps.length){sel.disabled=true;sel.options[0].textContent='Bu ligde teklif edilecek rakip yok';}
      f.onsubmit=e=>{e.preventDefault();const w=new Date(f.querySelector('input').value);if(!sel.value||isNaN(w))return;act('propose_league_match',{p_opp:sel.value,p_when:w.toISOString()},msg);};
      sec.appendChild(f);}
    box.appendChild(sec);}
  // ---- Ligler ----
  for(let tier=1;tier<=6;tier++){
    const list=ts.filter(t=>t.tier===tier).sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
    const sec=document.createElement('section');sec.className='ltier'+(list.some(t=>t.id===myId)?' mine':'');
    sec.innerHTML=`<header><img src="assets/tier${tier}.webp" alt=""><b>${tier}. Kademe · ${TIER_NAMES[tier-1]}</b><span>${list.length} takım${tier===1?' · şampiyonluk':tier===6?' · herkes buradan başlar':' · ↑ ilk 2 · ↓ son 2'}</span></header>`;
    if(list.length){const wrap=document.createElement('div');wrap.style.overflowX='auto';const tb=document.createElement('table');
      tb.innerHTML='<tr><th>#</th><th>Takım</th><th class="n">O</th><th class="n">G</th><th class="n">B</th><th class="n">M</th><th class="n">AV</th><th class="n">P</th></tr>';
      const zones=list.length>=5;
      list.forEach((t,i)=>{const tr=document.createElement('tr');const cls=[];if(t.id===myId)cls.push('me');
        if(zones&&tier>1&&i<2)cls.push('zup');if(zones&&tier<6&&i>=list.length-2)cls.push('zdown');if(zones&&tier===1&&i===0)cls.push('zchamp');tr.className=cls.join(' ');
        tr.innerHTML=`<td>${i+1}</td><td></td><td class="n">${t.played}</td><td class="n">${t.won}</td><td class="n">${t.drawn}</td><td class="n">${t.lost}</td><td class="n">${t.gf-t.ga}</td><td class="n">${t.points}</td>`;
        tr.children[1].append(badgeEl(t.kit,18),document.createTextNode(t.name+' ('+t.abbr+')'));{const L=teamLvl(t.xp);if(L.l>=2){const sp=document.createElement('span');sp.className='tlv'+(L.l>=10?' l10':L.l>=5?' l5':'');sp.textContent='Sv.'+L.l;sp.title=`Takım seviyesi ${L.l} · ${L.xp} XP`;tr.children[1].append(sp);}}const te=titleEl(t.id);if(te)tr.children[1].append(te);tb.appendChild(tr);});
      wrap.appendChild(tb);sec.appendChild(wrap);
      const fx=lm.filter(m=>m.tier===tier&&(m.status==='accepted'||m.status==='played'||m.status==='reported')).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
      const up=fx.filter(m=>m.status!=='played').slice(0,6),done=fx.filter(m=>m.status==='played').slice(-6).reverse();
      if(up.length||done.length){const fb=document.createElement('div');fb.className='lfix';
        const add=(m,label)=>{const r=document.createElement('div');r.className='lfrow'+(m.home===myId||m.away===myId?' me':'');r.innerHTML='<span class="w"></span><span class="h"></span><b></b><span class="a"></span>';
          r.querySelector('.w').textContent=label;r.querySelector('.h').textContent=tn(m.home);r.querySelector('b').textContent=m.home_score!=null?`${m.home_score} – ${m.away_score}`:'vs';r.querySelector('.a').textContent=tn(m.away);fb.appendChild(r);};
        if(up.length){const h=document.createElement('div');h.className='lfh';h.textContent='Fikstür';fb.appendChild(h);up.forEach(m=>add(m,fmtWhen(m.scheduled_at)));}
        if(done.length){const h=document.createElement('div');h.className='lfh';h.textContent='Son sonuçlar';fb.appendChild(h);done.forEach(m=>add(m,new Date(m.scheduled_at).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})));}
        sec.appendChild(fb);}}
    box.appendChild(sec);}
}

// =====================================================================
// ---------- Açılış ----------
// =====================================================================
$('gateForm').addEventListener('submit',async e=>{e.preventDefault();
  const n=cleanStr($('gNick').value,14).trim();if(n.length<2){$('gateMsg').textContent='Takma ad en az 2 karakter olmalı.';return;}
  if(hasBad(n)){$('gateMsg').textContent='Bu takma ad uygun değil, başka bir ad seç.';return;}
  const jn=String($('gNum').value||'').trim();if(!/^[1-9][0-9]?$/.test(jn)){$('gateMsg').textContent='Forma numaranı seç (1–99).';return;}
  prof.avatar=jn;
  prof.name=n;save();DB.saveProfile().catch(()=>{});enterMain();});
function enterMain(){
  const chk=()=>DB.restrictions().then(r=>{Object.assign(MOD,r||{});
    if(MOD.banned_until&&new Date(MOD.banned_until)>new Date()){leaveRoom(true);try{NET.lobby&&NET.lobby.leave();}catch(e){}NET.lobby=null;show('gate');$('gateForm').hidden=true;
      $('gateMsg').textContent='Hesabın '+new Date(MOD.banned_until).toLocaleString('tr-TR',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})+' tarihine kadar oyundan uzaklaştırıldı.'+(MOD.ban_reason?' Sebep: '+MOD.ban_reason:'');}}).catch(()=>{});
  chk();setInterval(chk,120000);loadExtra();DB.pingActive().catch(()=>{});setInterval(()=>DB.pingActive().catch(()=>{}),10*60e3);
  loadFriends(true);setInterval(()=>loadFriends(),60000);
  DB.questStatus().then(q=>{QSTARS=Number(q.stars)||0;if(prof.trail&&LOCKS.trail[prof.trail]>QSTARS)prof.trail='none';if(prof.ball&&LOCKS.ball[prof.ball]>QSTARS)prof.ball='classic';}).catch(()=>{});
  enforceOwned();markLocks();loadOwned();setInterval(loadOwned,10*60e3);
  setTimeout(checkAdminRoute,300);DB.adminRpc('is_admin').then(v=>{IS_ADMIN=!!v;const b=$('adminBtn');if(b)b.hidden=!IS_ADMIN;}).catch(()=>{});
  DB.claimRewards().then(r=>{MYREW=Array.isArray(r)?r.filter(x=>cleanTier(x.tier)):[];pushLobby();if(NET.room)pushRoom();}).catch(()=>{});
  DB.myRating().then(r=>{MYR={r:Number(r.rating)||1000,g:Number(r.games)||0};renderMe();pushLobby();}).catch(()=>{});
  renderMe();showMain('rooms');netConnect();setTimeout(()=>handleDeepLink(),400);DB.myTeam().then(m=>{myTeamCache=m;renderMe();}).catch(()=>{});}
(async()=>{
  show('gate');$('gNick').value=prof.name||'';$('gNum').value=/^[1-9][0-9]?$/.test(prof.avatar||'')&&prof.name?prof.avatar:'';$('gateGo').disabled=true;$('gateMsg').textContent='Bağlanıyor…';
  try{await backendInit();
    const p=await DB.getProfile().catch(()=>null);
    if(p){prof.name=p.nick||prof.name;prof.avatar=p.avatar||prof.avatar;prof.nameColor=p.name_color||prof.nameColor;JCARDS=Number(p.jersey_cards??1);save();}
    $('gateGo').disabled=false;$('gateMsg').textContent='Nick\'le hemen girersin. Google ile bağlarsan profilin, takımın ve satın aldıkların her cihazda seninle gelir.';
    if(prof.name&&p){$('gNick').value=prof.name;enterMain();}
  }catch(e){console.error(e);$('gateGo').disabled=false;$('gateMsg').textContent='Sunucuya bağlanılamadı ('+errText(e)+'). Yine de girip botlara karşı oynayabilirsin.';}
})();

if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
// ---------- Telefonda yakınlaştırma koruması ----------
['gesturestart','gesturechange'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
{let lastTap=0;$('game').addEventListener('touchend',e=>{const n=Date.now();if(n-lastTap<320&&e.target.tagName!=='INPUT')e.preventDefault();lastTap=n;},{passive:false});}
function resetZoom(){const m=document.querySelector('meta[name=viewport]');if(!m)return;const c=m.content;m.content=c.replace('initial-scale=1,','initial-scale=1.0001,');setTimeout(()=>{m.content=c;},60);}
if(window.visualViewport){let zt=0;visualViewport.addEventListener('resize',()=>{clearTimeout(zt);zt=setTimeout(()=>{if(visualViewport.scale>1.02&&!$('game').hidden&&document.activeElement?.tagName!=='INPUT')resetZoom();},700);});}
// ---------- Ana ekrana ekle (uygulama gibi) ----------
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let installEvt=null;
function showInstall(){let later=0;try{later=Number(localStorage.getItem('uzk-install-later')||0);}catch(e){}
  $('installBox').hidden=isStandalone()||Date.now()-later<3*86400e3||!(installEvt||isIOS);}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;showInstall();});
addEventListener('appinstalled',()=>{installEvt=null;$('installBox').hidden=true;});
$('installBtn').onclick=async()=>{if(installEvt){installEvt.prompt();try{await installEvt.userChoice;}catch(e){}installEvt=null;showInstall();}else $('iosInstall').hidden=false;};
$('installLater').onclick=()=>{try{localStorage.setItem('uzk-install-later',String(Date.now()));}catch(e){}$('installBox').hidden=true;};
$('iosInstallOk').onclick=()=>{$('iosInstall').hidden=true;};
$('iosInstall').addEventListener('click',e=>{if(e.target.id==='iosInstall')$('iosInstall').hidden=true;});
showInstall();

// =====================================================================
// ---------- Reklam alanları ve çerez onayı ----------
// Reklam ağı onaylanınca config.js içindeki ads ayarı doldurulur; boşken hiçbir reklam yüklenmez.
// =====================================================================
const ADS=Object.assign({provider:'',interstitialEvery:3},CFG.ads||{});
let consent=null;try{consent=localStorage.getItem('uzk-consent');}catch(e){}
function showConsent(){$('consent').hidden=false;}
function setConsent(v){consent=v;try{localStorage.setItem('uzk-consent',v);}catch(e){}$('consent').hidden=true;adsInit();}
$('consentAll').onclick=()=>setConsent('all');$('consentMin').onclick=()=>setConsent('min');$('openConsent').onclick=showConsent;
if(!consent)showConsent();
const adsOn=()=>!!ADS.provider&&!prof.premium&&!!consent;
let adsReady=false,matchesSinceAd=0;
function adsInit(){
  if(!adsOn()||adsReady)return;adsReady=true;
  // Buraya reklam ağının kendi yükleme kodu gelecek (kişiselleştirme: consent==='all').
  $('adLobby').hidden=false;$('adReward').hidden=false;
}
function adAfterMatch(){if(!adsOn())return;if(++matchesSinceAd<ADS.interstitialEvery)return;matchesSinceAd=0;/* ağın maç arası reklam çağrısı */}
$('adReward').onclick=()=>{/* ağın ödüllü video çağrısı; izlenince 1 günlük deneme verilir */};
adsInit();
