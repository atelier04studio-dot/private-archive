const CACHE='private-archive-local-20261102-1';
const ASSETS=['./index.html','./local-start.js','./local-app.js','./style.css','./cover.jpg','./manifest.webmanifest','./image-data.js','./sync-model.js','./media.js'];
const urls=new Set(ASSETS.map(p=>new URL(p,self.location).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('private-archive-local-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 // Never intercept OAuth, the legacy cloud edition, Supabase, or user images.
 if(event.request.method!=='GET'||u.search||u.hash)return;
 const root=new URL('./',self.location).href;
 const key=u.href===root?new URL('./index.html',self.location).href:u.href;
 if(!urls.has(key))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(key,copy)).catch(()=>{});}
  return response;
 }).catch(()=>caches.match(key).then(r=>r||Response.error())));
});
