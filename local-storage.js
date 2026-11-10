// Store owned bytes, never a persistent file-backed Blob reference.
export async function encodeRecord(item) {
 const {blob,thumb,bytes,thumbBytes,...meta}=item;
 const original=await blob.arrayBuffer();
 if(!original.byteLength||original.byteLength!==blob.size)throw Error('原本を読み込めません。元画像またはバックアップから復元してください。');
 return {...meta,bytes:original,type:blob.type,thumbBytes:thumb?await thumb.arrayBuffer():null,thumbType:thumb?.type,storageVersion:3};
}
export function decodeRecord(row) {
 if(!row.bytes)return row; // Old records stay intact until a successful save.
 const {bytes,thumbBytes,...meta}=row;
 return {...meta,blob:new Blob([bytes],{type:row.type}),thumb:thumbBytes?new Blob([thumbBytes],{type:row.thumbType}):null};
}
export function canShareFiles(files,nav=navigator){try{return !!nav.share&&!!nav.canShare?.({files});}catch{return false;}}
export async function sameOriginal(a,b){
 try {const aa=new Uint8Array(await a.blob.arrayBuffer()),bb=new Uint8Array(await b.blob.arrayBuffer());return aa.length===bb.length&&aa.every((v,i)=>v===bb[i]);}catch{return false;}
}
