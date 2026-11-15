// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {validateState as validateV1} from './domain-v1.js';
import {migrateState as migrateV2} from './domain-v2.js';
import {UNITS as LEGACY_UNITS} from './domain-v1.js';
import {OE_DE,OE_JUICE,defaultPreferences,validatePreferences,resolveMostWeight} from './units.js';
export {numberInput,validDate,CORRECTION_UNITS} from './domain-v1.js';
import {numberInput,validDate} from './domain-v1.js';
export const UNITS=[...LEGACY_UNITS,OE_DE,OE_JUICE];

export const newState=()=>({schemaVersion:3,preferences:defaultPreferences(),tanks:[],measurements:[],corrections:[],calculations:[],sources:[],volumeReadings:[],memos:[],photos:[]});
function ensure(ok,message){if(!ok)throw Error(message);}
export function normalizeTankNumber(value){return String(value).trim().replace(/\s+/g,' ').toLocaleUpperCase('de-DE');}
function timestamp(value){return typeof value==='string'&&!Number.isNaN(Date.parse(value));}
function text(value,max){return typeof value==='string'&&value.length<=max;}
function chronological(a,b){return a.date.localeCompare(b.date)||(a.time??'').localeCompare(b.time??'')||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id);}
export function volumeHistory(state,tankId){return state.volumeReadings.filter(r=>r.tankId===tankId).sort(chronological);}
export function currentVolume(state,tankId){return volumeHistory(state,tankId).at(-1)??null;}
export function memoHistory(state,tankId){return state.memos.filter(m=>m.tankId===tankId).sort(chronological);}
export function currentMemo(state,tankId){return memoHistory(state,tankId).at(-1)??null;}
export function validateState(state){
 ensure(state?.schemaVersion===3,'Unbekannte Sicherungsversion.');
 validatePreferences(state.preferences);
 ensure(Array.isArray(state.tanks)&&Array.isArray(state.volumeReadings)&&Array.isArray(state.memos)&&Array.isArray(state.photos),'Unvollständige Vinora-Daten.');
 const numbers=new Set();
 for(const tank of state.tanks){
  ensure(text(tank.number,60)&&(tank.number.trim()!==''||tank.needsNumberReview===true),'Tanknummer fehlt.');
  if(tank.number.trim()){const key=normalizeTankNumber(tank.number);ensure(!numbers.has(key),'Tanknummer ist bereits vorhanden.');numbers.add(key);}
  ensure(text(tank.name,100)&&tank.name.trim()!=='','Bezeichnung fehlt.');
  ensure(tank.capacityL===null||(Number.isFinite(tank.capacityL)&&tank.capacityL>0),'Ungültiges Tankvolumen.');
 }
 // Shared validation for original measurements and versioned calculation snapshots.
 // Designations may repeat; only physical tank numbers must be unique.
 const measurements=state.measurements.map(m=>m.parameter==='Mostgewicht'&&[OE_DE,OE_JUICE].includes(m.unit)?{...m,unit:'°Oe'}:m);
 const calculations=state.calculations.map(c=>{
  if(!c.inputs?.mostWeight)return c;
  const input=c.inputs.mostWeight;
  ensure(numberInput(input.originalInput)===input.value,'Ungültiger Originalwert des Ausgangsmostgewichts.');
  const resolved=resolveMostWeight(input,c.inputs.oeScale);
  ensure(c.inputs.oeScale===resolved.scale,'Oechsle-Skala der Prognose stimmt nicht überein.');
  ensure(c.derivedMostWeight&&['value','unit','scale','conversionVersion','status'].every(key=>c.derivedMostWeight[key]===resolved[key]),'Abgeleitetes Mostgewicht stimmt nicht mit der Eingabe überein.');
  return {...c,inputs:{...c.inputs,oe:{value:resolved.value,originalInput:String(resolved.value),unit:'°Oe'}}};
 });
 validateV1({...state,schemaVersion:1,tanks:state.tanks.map(t=>({...t,name:t.id,note:''})),measurements,calculations});
 ensure(state.volumeReadings.length<=100000&&state.memos.length<=100000,'Zu viele Einträge.');
 const ids=new Set([...state.tanks,...state.measurements,...state.corrections,...state.calculations].map(x=>x.id));
 const tanks=new Set(state.tanks.map(t=>t.id));
 const photos=new Set();
 for(const photo of state.photos){
  ensure(photo&&text(photo.id,100)&&photo.id!==''&&!ids.has(photo.id),'Ungültige Foto-Kennung.');ids.add(photo.id);photos.add(photo.id);
  ensure(text(photo.name,500)&&['image/jpeg','image/png','image/webp','image/bmp'].includes(photo.mimeType),'Ungültiger Fototyp.');
  ensure(Number.isInteger(photo.size)&&photo.size>0&&photo.size<=20*1024*1024&&/^[a-f0-9]{64}$/.test(photo.sha256),'Ungültige Foto-Metadaten.');
  ensure(timestamp(photo.createdAt)&&text(photo.ocrText,20000),'Ungültiger Fotozeitpunkt oder OCR-Text.');
 }
 for(const item of [...state.volumeReadings,...state.memos]){
  ensure(item&&text(item.id,100)&&item.id!==''&&!ids.has(item.id),'Ungültige oder doppelte Kennung.');ids.add(item.id);
  ensure(tanks.has(item.tankId)&&validDate(item.date)&&timestamp(item.createdAt),'Ungültiger Eintragsbezug oder Zeitpunkt.');
  ensure(text(item.time,5)&&(item.time===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)),'Ungültige Uhrzeit.');
 }
 for(const reading of state.volumeReadings){
  ensure(reading.unit==='L'&&Number.isFinite(reading.value)&&reading.value>=0,'Ungültige Menge im Tank.');
  ensure(numberInput(reading.originalInput)===reading.value,'Originaleingabe der Menge stimmt nicht überein.');
  ensure(reading.capacitySnapshotL===null||(Number.isFinite(reading.capacitySnapshotL)&&reading.capacitySnapshotL>0),'Ungültiger Tankvolumenstand.');
  ensure(reading.capacitySnapshotL===null||reading.value<=reading.capacitySnapshotL,'Menge ist größer als das Tankvolumen zum Erfassungszeitpunkt.');
 }
 for(const memo of state.memos){
  for(const key of ['wineNumber','variety','vintage','site','qualityLevel','description'])ensure(text(memo[key],key==='description'?2000:200),'Ungültiger Merkzettel.');
  ensure(memo.vintage===''||/^\d{4}$/.test(memo.vintage),'Jahrgang bitte vierstellig angeben.');
  ensure(memo.photoId==null||photos.has(memo.photoId),'Merkzettelfoto fehlt in den Metadaten.');
 }
 ensure(state.photos.every(photo=>state.memos.some(m=>m.photoId===photo.id)),'Foto ohne zugehörigen Merkzettel.');
 return state;
}
export function migrateState(input){
 if(![1,2].includes(input?.schemaVersion))return validateState(input);
 const previous=migrateV2(input);
 return validateState({...structuredClone(previous),schemaVersion:3,preferences:defaultPreferences()});
}
export function deleteTank(state,id){const memos=state.memos.filter(m=>m.tankId!==id);return {...state,tanks:state.tanks.filter(t=>t.id!==id),measurements:state.measurements.filter(m=>m.tankId!==id),corrections:state.corrections.filter(c=>c.tankId!==id),calculations:state.calculations.filter(c=>c.tankId!==id),volumeReadings:state.volumeReadings.filter(r=>r.tankId!==id),memos,photos:state.photos.filter(p=>memos.some(m=>m.photoId===p.id))};}
export function series(state,tankId,unit){return state.measurements.filter(m=>m.tankId===tankId&&m.unit===unit).sort(chronological);}
