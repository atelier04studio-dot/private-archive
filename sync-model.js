export function metadata(x) {
 const keys=['id','title','album','note','date','dateSource','favorite','trashed','added','width','height','hash','type','size'];
 return Object.fromEntries(keys.map(k=>[k,x[k]]));
}
const same=(a,b)=>JSON.stringify(a?metadata(a):null)===JSON.stringify(b?metadata(b):null);
export async function sha256(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function mergeArchives(local,remote,base={images:[],folders:[]}) {
 const old=new Map(base.images.map(x=>[x.id,x])),result=new Map(remote.images.map(x=>[x.id,x]));let conflicts=0;
 for(const x of local.images){const r=result.get(x.id),b=old.get(x.id);if(!r||same(x,r)){result.set(x.id,x);continue;}if(same(x,b))continue;if(same(r,b)){result.set(x.id,x);continue;}
  const id=await sha256(new Blob([JSON.stringify(metadata(x))]));
  if(!result.has(id)){result.set(id,{...x,id,title:`${x.title.slice(0,130)}（別の端末との変更を保管）`});conflicts++;}
 }
 const folders=new Set([...remote.folders,...local.folders]);for(const p of base.folders){if(!local.folders.includes(p)||!remote.folders.includes(p))folders.delete(p);}
 for(const x of result.values()){const bits=x.album.split('/').filter(Boolean);for(let i=1;i<=bits.length;i++)folders.add(bits.slice(0,i).join('/'));}
 return {images:[...result.values()],folders:[...folders].sort(),conflicts};
}
