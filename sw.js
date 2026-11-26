// Offline support: keeps the app's own files on the device. Your data is never sent here; it lives in this device's browser storage.
const VERSION="orion-v5-2026-11-26";
const CORE=["./","./index.html","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(req.mode==="navigate"){ // app page: try network for updates, fall back to the saved copy when offline
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(VERSION).then(x=>x.put("./index.html",c));return r}).catch(()=>caches.match("./index.html")));return}
  if(url.origin===location.origin||url.host.endsWith("fonts.googleapis.com")||url.host.endsWith("fonts.gstatic.com")){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{const c=r.clone();caches.open(VERSION).then(x=>x.put(req,c));return r})))}
});
