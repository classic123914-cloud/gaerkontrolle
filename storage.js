// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {newState,validateState,migrateState} from './domain.js';
export const STORAGE_KEY='kellerwirtschaft.v1';
export function load(storage=localStorage) {
  const raw=storage.getItem(STORAGE_KEY);
  return raw === null ? newState() : migrateState(JSON.parse(raw));
}
export function save(state,storage=localStorage) {
  validateState(state);
  storage.setItem(STORAGE_KEY,JSON.stringify(state));
}
export function exportBackup(state,attachments=[]) {
  validateState(state);
  validateAttachments(state,attachments);
  const json=JSON.stringify({format:'kellerwirtschaft-backup',version:6,exportedAt:new Date().toISOString(),data:state,attachments},null,2);
  if(json.length>100*1024*1024)throw Error('Die Gesamtsicherung ist größer als 100 MB. Bitte kleinere Merkzettelfotos verwenden.');
  return json;
}
export function parseBackup(text) {
  return parseBackupEnvelope(text).data;
}
function validateAttachments(state,attachments){
  if(!Array.isArray(attachments)||attachments.length!==state.photos.length||new Set(attachments.map(p=>p?.id)).size!==attachments.length)throw Error('Sicherung enthält nicht alle Merkzettelfotos.');
  for(const attachment of attachments){
    const photo=state.photos.find(p=>p.id===attachment?.id);
    if(!photo||typeof attachment.dataURL!=='string'||!attachment.dataURL.startsWith('data:'+photo.mimeType+';base64,')||!/^data:image\/(?:jpeg|png|webp|bmp);base64,[A-Za-z0-9+/]+={0,2}$/.test(attachment.dataURL))throw Error('Ungültige Fotodatei in der Sicherung.');
    const base64=attachment.dataURL.split(',')[1];
    const size=base64.length*3/4-(base64.endsWith('==')?2:base64.endsWith('=')?1:0);
    if(size!==photo.size)throw Error('Fotogröße in der Sicherung stimmt nicht überein.');
  }
}
export function parseBackupEnvelope(text) {
  if (text.length > 100*1024*1024) throw Error('Die Sicherung ist größer als 100 MB.');
  const b=JSON.parse(text);
  if (b?.format!=='kellerwirtschaft-backup' || ![1,2,3,4,5,6].includes(b.version) || b.data?.schemaVersion!==b.version) throw Error('Keine unterstützte Vinora-Sicherung.');
  const data=migrateState(b.data),attachments=b.attachments??[];validateAttachments(data,attachments);
  return {data,attachments};
}
