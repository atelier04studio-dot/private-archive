import {supabase,configured,appURL} from './client.js';
const message=document.querySelector('#login-message'),button=document.querySelector('#google-login');
if(!configured)message.textContent='保存先を準備中です。設定が完了するまでログインできません。';
else{button.disabled=false;message.textContent='画像はアカウントごとに非公開で保存します。';button.onclick=async()=>{button.disabled=true;try{const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:appURL,queryParams:{prompt:'select_account'}}});if(error)throw error;}catch(error){message.textContent=error.message||'接続できません。もう一度お試しください。';button.disabled=false;}};}
