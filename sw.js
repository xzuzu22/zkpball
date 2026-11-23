// Zkpball: uygulama kabuğunu önbelleğe alır; ağ varsa her zaman yenisini kullanır.
const C='uzk-v4';
const SHELL=['./','index.html','style.css','app.js','config.js','manifest.webmanifest','assets/logo.webp','assets/bg.jpg','assets/icon-192.png','assets/premium.webp','assets/tier1.webp','assets/tier2.webp','assets/tier3.webp','assets/tier4.webp','assets/tier5.webp','assets/tier6.webp'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  const net=e.request.mode==='navigate'?fetch(e.request.url,{cache:'no-cache',credentials:'same-origin'}):fetch(e.request,{cache:'no-cache'});
  e.respondWith(net.then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request)));});

// Telefon bildirimleri
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{};}catch(_){d={body:e.data&&e.data.text()};}
  e.waitUntil(self.registration.showNotification(d.title||'Zkpball',{body:d.body||'',icon:'assets/icon-192.png',badge:'assets/icon-192.png',tag:d.tag||'uzk',renotify:true,data:{url:d.url||'./'},vibrate:[120,60,120]}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if(c.url.startsWith(self.registration.scope)&&'focus' in c){c.postMessage({uzkOpen:url});return c.focus();}}return self.clients.openWindow(url);}));});
