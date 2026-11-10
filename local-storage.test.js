import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeRecord,decodeRecord,sameOriginal,canShareFiles} from './local-storage.js';
test('persist byte arrays and reconstruct original and thumbnail after structured clone',async()=>{
 const item={id:'one',title:'原本',blob:new Blob([new Uint8Array([0,255,42])],{type:'image/png'}),thumb:new Blob(['thumb'],{type:'image/webp'})};
 const encoded=await encodeRecord(item);assert.equal(encoded.blob,undefined);assert.ok(encoded.bytes instanceof ArrayBuffer);
 const decoded=decodeRecord(structuredClone(encoded));assert.ok(await sameOriginal(item,decoded));assert.equal(decoded.blob.type,'image/png');assert.equal(await decoded.thumb.text(),'thumb');assert.equal(decoded.title,item.title);
});
test('legacy records remain readable without destructive migration',()=>{const old={id:'old',blob:new Blob(['old'])};assert.equal(decodeRecord(old),old)});
test('unreadable original fails before any write; duplicate detection preserves damaged and differing originals',async()=>{
 const damaged={blob:{arrayBuffer:async()=>{throw Error('missing')}}};await assert.rejects(encodeRecord(damaged));assert.equal(await sameOriginal(damaged,{blob:new Blob(['x'])}),false);assert.equal(await sameOriginal({blob:new Blob(['x'])},{blob:new Blob(['y'])}),false);
});
test('sharing requires both supported file types and share API',()=>{assert.equal(canShareFiles([],{canShare:()=>true}),false);assert.equal(canShareFiles([],{share(){},canShare:()=>true}),true);assert.equal(canShareFiles([],{share(){},canShare(){throw Error()}}),false)});
