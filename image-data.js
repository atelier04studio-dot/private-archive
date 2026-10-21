import {sha256} from './sync-model.js';

// Read the bytes rather than retaining a File/IndexedDB-backed Blob reference.
export async function detachedBlob(blob, type = blob.type) {
 const bytes = await blob.arrayBuffer();
 if (!bytes.byteLength || bytes.byteLength !== blob.size) throw Error('画像データを読み込めませんでした');
 return new Blob([bytes], {type});
}
export async function verifiedOriginal(item, download, force = false) {
 async function verify(source) {
  const blob = await detachedBlob(source, item.type || source.type);
  if (item.hash && (blob.size !== item.size || await sha256(blob) !== item.hash)) throw Error('原本の照合に失敗しました');
  return blob;
 }
 if (!force) { try { return await verify(item.blob); } catch (error) { if (!item.hash) throw error; } }
 if (!/^[a-f0-9]{64}$/.test(item.hash || '')) throw Error('未同期の画像です。端末の原本を残したまま、先に同期してください。');
 return verify(await download(item.hash));
}
export function blobDataURL(blob) {
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
}
export async function imageLoad(blob) {
 // Data URLs avoid a revoked or file-backed Blob URL during iOS decoding/drawing.
 const source = await blobDataURL(await detachedBlob(blob));
 return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('画像を読み込めません。「画像の読み込みを修復」をお試しください。'));image.src=source});
}
