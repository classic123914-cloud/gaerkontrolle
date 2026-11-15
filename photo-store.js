// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
const DB='kellerbuch-photos-v1',STORE='photos';
async function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Fotospeicher ist nicht verfügbar.'));});}
export async function storePhoto(blob,metadata){
 const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(blob,metadata.id);tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Foto konnte lokal nicht gespeichert werden.'));tx.onabort=()=>reject(Error('Fotospeicherung abgebrochen.'));});}finally{db.close();}
}
export async function getPhoto(id){const db=await database();try{return await new Promise((resolve,reject)=>{const request=db.transaction(STORE).objectStore(STORE).get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Foto konnte nicht gelesen werden.'));});}finally{db.close();}}
export async function deletePhotos(ids){if(!ids.length)return;const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');for(const id of ids)tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Foto konnte nicht entfernt werden.'));});}finally{db.close();}}
export async function preparePhoto(file,ocrText){
 if(file.size>20*1024*1024)throw Error('Foto ist größer als 20 MB.');
 const bytes=await file.arrayBuffer();
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 const metadata={id:crypto.randomUUID(),name:file.name||'merkzettel.jpg',mimeType:file.type,size:file.size,sha256:Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join(''),createdAt:new Date().toISOString(),ocrText:String(ocrText).slice(0,20000)};
 await storePhoto(file,metadata);return metadata;
}
function dataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Fotoexport fehlgeschlagen.'));reader.readAsDataURL(blob);});}
export async function exportPhotoAttachments(photos){const attachments=[];for(const metadata of photos){const blob=await getPhoto(metadata.id);if(!blob)throw Error('Foto fehlt im lokalen Speicher: '+metadata.name+'. Sicherung wurde nicht erstellt.');const attachment={id:metadata.id,dataURL:await dataURL(blob)};await decodePhotoAttachment(attachment,metadata);attachments.push(attachment);}return attachments;}
export async function decodePhotoAttachment(attachment,metadata){
 const encoded=attachment.dataURL.split(',')[1];const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
 if(bytes.length!==metadata.size)throw Error('Fotogröße stimmt nicht mit der Sicherung überein.');
 const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 if(hash!==metadata.sha256)throw Error('Foto-Prüfsumme stimmt nicht überein.');
 return {blob:new Blob([bytes],{type:metadata.mimeType}),hash};
}
export async function restorePhotoAttachments(attachments,photos){
 const blobs=[];
 for(const attachment of attachments){
  const metadata=photos.find(p=>p.id===attachment.id);if(!metadata)throw Error('Foto ohne Metadaten.');
  const {blob,hash}=await decodePhotoAttachment(attachment,metadata);
  // IDs are immutable: never overwrite a different existing original before the state commit.
  const existing=await getPhoto(metadata.id);
  if(existing){const oldHash=await crypto.subtle.digest('SHA-256',await existing.arrayBuffer());if(Array.from(new Uint8Array(oldHash),n=>n.toString(16).padStart(2,'0')).join('')!==hash)throw Error('Foto-Kennung kollidiert mit einer anderen lokalen Originaldatei.');}
  blobs.push([metadata.id,blob]);
 }
 if(!blobs.length)return;
 const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');for(const [id,blob] of blobs)tx.objectStore(STORE).put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Fotos konnten nicht wiederhergestellt werden.'));tx.onabort=()=>reject(Error('Fotoimport abgebrochen.'));});}finally{db.close();}
}
