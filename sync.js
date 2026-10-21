import {archiveAPI as api} from './cloud.js';
import {metadata,mergeArchives,sha256} from './sync-model.js';
export function setupSync({db,refresh,setBusy,isBusy,toast,account,checkAccount}) {
 const status=document.querySelector('#sync-status'),button=document.querySelector('#sync-now'),login=document.querySelector('#sync-login');let running=false,timer,enabled=true;
 const setting=key=>new Promise((resolve,reject)=>{const r=db.transaction('settings').objectStore('settings').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const snapshot=()=>new Promise((resolve,reject)=>{const tx=db.transaction(['images','settings']),r=tx.objectStore('images').getAll(),s=tx.objectStore('settings'),f=s.get('folders'),b=s.get('sync-base'),v=s.get('local-revision');tx.oncomplete=()=>resolve({images:r.result,folders:f.result||[],base:b.result||{images:[],folders:[]},version:v.result||0});tx.onabort=tx.onerror=()=>reject(tx.error);});
 function schedule(){if(!enabled||running)return;status.textContent='変更を同期しています…';clearTimeout(timer);timer=setTimeout(()=>{if(!document.hidden)run();},1800);}
 async function run(){if(running)return;if(isBusy()){clearTimeout(timer);timer=setTimeout(run,1800);return;}running=true;clearTimeout(timer);button.disabled=true;login.hidden=true;setBusy(true,'画像を消さずに同期しています…');try{
  await checkAccount();const local=await snapshot();if(!enabled){enabled=true;await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(true,'sync-enabled');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  const images=[];for(const [i,x] of local.images.entries()){status.textContent=`原本を確認中 ${i+1} / ${local.images.length}枚`;images.push({...metadata(x),hash:x.hash||await sha256(x.blob),type:x.blob.type,size:x.blob.size});}
  const byHash=new Map(local.images.map((x,i)=>[images[i].hash,x]));
  let merged,remote;for(let attempt=0;attempt<3;attempt++){
   remote=await (await api('/api/archive')).json();merged=await mergeArchives({images,folders:local.folders},remote,local.base);
   if(merged.images.reduce((n,x)=>n+x.size,0)>300*1048576)throw Error('同期すると合計300MBを超えます。画像は両方の端末に残しています。');
   const uploaded=new Set(remote.images.map(x=>x.hash));for(const [i,x] of merged.images.entries()){if(uploaded.has(x.hash))continue;const original=byHash.get(x.hash);if(!original)throw Error('同期する原本が見つかりません');status.textContent=`非公開の保存先へ送信中 ${i+1} / ${merged.images.length}枚`;await api(`/api/blob/${x.hash}`,{method:'PUT',headers:{'Content-Type':x.type},body:original.blob});uploaded.add(x.hash);}
   try {if(JSON.stringify({images:merged.images,folders:merged.folders})!==JSON.stringify({images:remote.images,folders:remote.folders}))await api('/api/archive',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:remote.revision,images:merged.images,folders:merged.folders})});break;}catch(e){if(!e.conflict||attempt===2)throw e;}
  }
  const values=[];for(const [i,x] of merged.images.entries()){let original=byHash.get(x.hash);if(!original){status.textContent=`この端末に原本を受信中 ${i+1} / ${merged.images.length}枚`;const blob=await (await api(`/api/blob/${x.hash}`)).blob();if(blob.size!==x.size||await sha256(blob)!==x.hash)throw Error('原本の照合に失敗しました。もう一度同期してください。');original={blob};byHash.set(x.hash,original);}values.push({...x,blob:original.blob,thumb:original.thumb});}
  await new Promise((resolve,reject)=>{const tx=db.transaction(['images','settings'],'readwrite'),s=tx.objectStore('settings'),r=s.get('local-revision');let changed=false;r.onsuccess=()=>{if((r.result||0)!==local.version){changed=true;tx.abort();return;}for(const x of values)tx.objectStore('images').put(x);s.put(merged.folders,'folders');s.put({images:merged.images,folders:merged.folders},'sync-base');s.put(local.version+1,'local-revision');};tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(changed?Error('別のタブで編集されました。編集内容を保持しています。もう一度同期してください。'):tx.error);});
  await refresh();status.textContent=`同期済み：${merged.images.length}枚 · ${new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}${merged.conflicts?'（同時編集は別画像として保管）':''}`;button.textContent='今すぐ同期';
 }catch(e){status.textContent=e.message||'同期できませんでした。端末の画像は保持しています。';toast(status.textContent);}finally{running=false;button.disabled=false;setBusy(false);}}
 button.onclick=()=>run();schedule();
 window.addEventListener('online',schedule);window.addEventListener('focus',schedule);setInterval(()=>{if(!document.hidden&&!isBusy())schedule();},60000);
 return schedule;
}
