import {JSDOM} from 'jsdom';import {indexedDB} from 'fake-indexeddb';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname.replace(/\/$/,'');
const dom=new JSDOM(await fs.readFile(root+'/index.html','utf8'),{url:'http://localhost/'});
Object.assign(globalThis,{document:dom.window.document,window:dom.window,indexedDB,alert:()=>{}});
class Reader{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onload();},e=>{this.error=e;this.onerror();});}}
globalThis.FileReader=Reader;
globalThis.Image=class{naturalWidth=2;naturalHeight=2;set src(v){this._src=v;if(v)queueMicrotask(()=>this.onload());}get src(){return this._src;}};
dom.window.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
dom.window.HTMLCanvasElement.prototype.toBlob=function(cb,type){cb(new Blob(['thumbnail'],{type}));};
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
const db=await new Promise((r,j)=>{const q=indexedDB.open('atelier04-private-archive-device-v1',2);q.onupgradeneeded=()=>{q.result.createObjectStore('images',{keyPath:'id'});q.result.createObjectStore('settings');};q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});
const image={id:'old-1',title:'old',album:'',note:'',date:'2026-11-10T10:00:00',added:1,favorite:false,trashed:false,blob:new Blob(['original'],{type:'image/png'}),width:2,height:2};
await new Promise(r=>{const t=db.transaction('images','readwrite');t.objectStore('images').put(image);t.oncomplete=r;});
await import(root+'/local-app.js');
const $=s=>document.querySelector(s);assert.equal($('#count').textContent,'01');
// New addition persists bytes, not a Blob.
await $('#files').onchange({target:{files:[new File(['new image'],'new.png',{type:'image/png'})],value:''}});
let rows=await new Promise(r=>{const q=db.transaction('images').objectStore('images').getAll();q.onsuccess=()=>r(q.result)});assert.equal(rows.length,2);assert.ok(rows.find(x=>x.id!=='old-1').bytes instanceof ArrayBuffer);assert.ok(rows.find(x=>x.id==='old-1').blob);
await $('#backup').onclick();assert.ok($('#backup-ready').open);let link=$('#backup-links a');const backup=await (await fetch(link.href)).json();assert.equal(backup.images.length,2);assert.equal(backup.images.find(x=>x.id===image.id).data,image.blob.type?`data:image/png;base64,${Buffer.from('original').toString('base64')}`:'');
// Exercise explicit original-file preparation from the detail dialog.
await $('#grid').onclick({target:$('#grid [data-open]')});
await $('#export-settings-one').onclick();
$('[name=export-format][value=original]').checked=true;
await $('#prepare').onclick();
await new Promise(r=>setTimeout(r,30));
assert.equal($('#export-error').textContent,'');assert.equal($('#export-ready').hidden,false);
assert.ok($('#export-links a').download.endsWith('.png'));
$('#export-dialog').close();
// Existing duplicate is preserved; changed payload is restored under a new ID.
$('#backup-ready').close();await $('#backup-file').onchange({target:{files:[new File([JSON.stringify(backup)],'backup.json')],value:''}});
assert.equal($('#count').textContent,'02');backup.images[0].data='data:image/png;base64,'+Buffer.from('different').toString('base64');await $('#backup-file').onchange({target:{files:[new File([JSON.stringify(backup)],'backup.json')],value:''}});assert.equal($('#count').textContent,'03');
// Invalid restore does not partially commit. The expected validation error is logged.
backup.images[1].date='invalid';await $('#backup-file').onchange({target:{files:[new File([JSON.stringify(backup)],'bad.json')],value:''}});assert.equal($('#count').textContent,'03');
console.log('PASS: legacy read, new byte storage, JSON backup contents, duplicate restore, conflict preservation, malformed restore rollback');db.close();
