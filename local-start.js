// Preserve the registered OAuth callback for the retained cloud edition.
const query=new URLSearchParams(location.search);
if(query.has('code')||query.has('error')||/access_token=/.test(location.hash)){
 location.replace(new URL('./cloud.html'+location.search+location.hash,location.href));
}else{
 import('./local-app.js').catch(()=>{document.querySelector('#empty h3').textContent='画像室を開けませんでした';document.querySelector('#empty p').textContent='通信を確認して開き直してください。保存済み画像は削除していません。';});
}
