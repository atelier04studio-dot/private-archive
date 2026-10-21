import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validDate,readExifDate,withExif,withPngExif,zipFiles} from './media.js';
import {mergeArchives} from './sync-model.js';
const original={id:'a',title:'original',album:'作品',note:'',date:'2024-02-29T12:34:56',dateSource:'exif',favorite:false,trashed:false,added:1,width:1,height:1,hash:'a'.repeat(64),type:'image/png',size:1};
const archive=(image=original)=>({images:[image],folders:['作品']});
test('remote trash wins against unchanged local image',async()=>{
 const r=await mergeArchives(archive(),archive({...original,trashed:true}),archive());
 assert.equal(r.images[0].trashed,true);assert.equal(r.conflicts,0);
});
test('concurrent edits preserve both versions and retries do not duplicate',async()=>{
 const local=archive({...original,title:'phone'}),remote=archive({...original,title:'mac'});
 const first=await mergeArchives(local,remote,archive());
 assert.equal(first.images.length,2);assert.equal(first.conflicts,1);
 assert.equal(first.images[0].title,'mac');assert.match(first.images[1].title,/phone/);
 const again=await mergeArchives(local,first,archive());assert.equal(again.images.length,2);
});
test('remote unchanged allows local move, empty folder deletion propagates',async()=>{
 const base={...archive(),folders:['作品','空']};
 const local={images:[{...original,album:'新作'}],folders:['新作']};
 const result=await mergeArchives(local,base,base);
 assert.equal(result.images[0].album,'新作');assert.deepEqual(result.folders,['新作']);
});
test('JPEG export writes chosen original/today date without changing source',async()=>{
 const jpeg=new Uint8Array(await readFile(new URL('./cover.jpg',import.meta.url)));
 const before=jpeg.slice();
 for(const date of ['2024-02-29T12:34:56','2026-10-21T10:00:00'])assert.equal(readExifDate(withExif(jpeg,date)),date);
 assert.deepEqual(jpeg,before);
});
test('PNG date replacement preserves image data and source bytes',()=>{
 const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64'));
 const before=png.slice(),date='2020-01-02T03:04:05';
 const result=withPngExif(withPngExif(png,'2026-10-21T00:00:00'),date);
 assert.equal(readExifDate(result),date);assert.deepEqual(png,before);
 assert.equal(new TextDecoder().decode(result).split('eXIf').length-1,1);
 const idat=b=>{const v=new DataView(b.buffer,b.byteOffset,b.byteLength);for(let p=8;p+12<=b.length;){const n=v.getUint32(p);if(new TextDecoder().decode(b.slice(p+4,p+8))==='IDAT')return b.slice(p,p+n+12);p+=n+12;}};
 assert.deepEqual(idat(result),idat(png));
});
test('invalid dates and malformed PNG are rejected',()=>{
 assert.equal(validDate('2025-02-29T12:00:00'),false);
 assert.throws(()=>withExif(new Uint8Array([255,216]),'not-a-date'));
 assert.throws(()=>withPngExif(new Uint8Array([137,80,78]),'2026-10-21T00:00:00'));
 assert.equal(readExifDate(new Uint8Array([255,216,255,225,255,255])),null);
});
test('ZIP carries both original payloads and UTF-8 names',async()=>{
 const files=[new File(['red'],'赤.png'),new File(['blue'],'青.png')];
 const b=new Uint8Array(await (await zipFiles(files)).arrayBuffer());const v=new DataView(b.buffer);
 let p=0;for(const f of files){assert.equal(v.getUint32(p,true),0x04034b50);assert.equal(v.getUint16(p+6,true),0x800);const n=v.getUint16(p+26,true),size=v.getUint32(p+18,true);assert.equal(new TextDecoder().decode(b.slice(p+30,p+30+n)),f.name);assert.equal(new TextDecoder().decode(b.slice(p+30+n,p+30+n+size)),await f.text());p+=30+n+size;}
 assert.equal(v.getUint16(b.length-12,true),2);
});
