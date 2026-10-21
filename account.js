import {supabase,configured} from './client.js';
let locked=false;
export function lockAccount(message='ログイン状態を確認してください。'){
 locked=true;window.dispatchEvent(new Event('private-archive-lock'));document.documentElement.classList.add('account-locked');
 document.querySelector('#account-message').textContent=message;
 document.querySelectorAll('#grid img,#detail-image').forEach(i=>i.removeAttribute('src'));
}
async function identity(){
 if(!configured)throw Error('保存先の接続設定を準備中です。まだ画像は登録できません。');
 const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw Error('Googleでログインしてください。');
 const {data:allowed,error:membershipError}=await supabase.rpc('pa_is_member');
 if(membershipError)throw Error('保存先に接続できません。接続設定を確認してください。');
 if(!allowed)throw Error('このアカウントはまだ利用登録されていません。');
 return {id:data.user.id,email:data.user.email};
}
export const account=await identity().catch(e=>{lockAccount(e.message);throw e;});
export async function checkAccount(){
 try{const now=await identity();if(now.id!==account.id||locked)throw Error('ログインが変わりました。ページを開き直してください。');return now;}
 catch(e){lockAccount(e.message);throw e;}
}
document.querySelector('#account-email').textContent=account.email||'ログイン中';
document.documentElement.classList.remove('account-locked');
document.querySelector('#signout').addEventListener('click',async e=>{e.preventDefault();lockAccount('ログアウトしました。端末内の未同期データはこのアカウント専用に保持しています。');await supabase.auth.signOut({scope:'local'});location.replace(new URL('./login.html',location.href));});
supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session&&session.user.id!==account.id))lockAccount('アカウントが変わりました。ページを開き直してください。');});
window.addEventListener('storage',e=>{if(e.key==='atelier04-private-archive-auth')checkAccount().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(document.hidden)document.documentElement.classList.add('account-locked');else checkAccount().then(()=>document.documentElement.classList.remove('account-locked')).catch(()=>{});});
