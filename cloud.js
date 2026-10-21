import {supabase} from './client.js';
import {account,checkAccount} from './account.js';
const bucket='private-archive';
function errorOf(error){const e=new Error(error?.message||'クラウドに接続できません。');if(error?.code==='40001')e.conflict=true;return e;}
export async function archiveAPI(path,options={}){
 await checkAccount();
 if(path==='/api/archive'){
  if(options.method==='PUT'){
   const {revision,images,folders}=JSON.parse(options.body);
   const {data,error}=await supabase.rpc('pa_save_archive',{expected_revision:revision,new_manifest:{images,folders}});
   if(error)throw errorOf(error);return {json:async()=>data};
  }
  const {data,error}=await supabase.from('pa_archives').select('revision,manifest').eq('owner_id',account.id).maybeSingle();
  if(error)throw errorOf(error);return {json:async()=>data?{revision:data.revision,...data.manifest}:{revision:0,images:[],folders:[]}};
 }
 const hash=path.split('/').pop();if(!/^[a-f0-9]{64}$/.test(hash))throw Error('画像の識別情報が正しくありません。');
 const key=account.id+'/'+hash;
 if(options.method==='PUT'){
  const {error}=await supabase.storage.from(bucket).upload(key,options.body,{contentType:options.body.type,cacheControl:'3600',upsert:false});
  if(error&&String(error.statusCode)!=='409'&&!/already exists|Duplicate/i.test(error.message))throw errorOf(error);
  // Immutable hash paths: never overwrite an existing original.
  return {json:async()=>({ok:true})};
 }
 const {data,error}=await supabase.storage.from(bucket).download(key);if(error)throw errorOf(error);return {blob:async()=>data};
}
