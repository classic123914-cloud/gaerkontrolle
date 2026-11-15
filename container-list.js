// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {numberInput} from './domain-v1.js';
const key=value=>String(value).normalize('NFC').trim().replace(/\s+/g,' ').toLocaleUpperCase('de-DE');
export function capacityFromList(input){
 let value=String(input).trim().replace(/\s*(?:Liter|L)$/i,'').trim();
 if(/^\d{1,3}(?:[. ]\d{3})+(?:,\d+)?$/.test(value))value=value.replace(/[. ]/g,'');
 const result=numberInput(value);if(result<=0)throw Error('Fassungsvermögen muss größer als null sein.');return result;
}
export function rowsFromListText(text){
 if(typeof text!=='string')return [];
 const rows=[];
 for(const rawLine of text.slice(0,20000).split(/\r?\n/)){
  const line=rawLine.trim();if(!/^\d+\s*[;|\t ]/.test(line))continue;
  const delimited=line.split(/[;|\t]+/).map(s=>s.trim());let values;
  if(delimited.length===5)values=delimited;
  else{
   const match=line.match(/^(\d+)\s+([\p{L}]+\s+\d[\p{L}\p{N}./_-]*|\S*\d[\p{L}\p{N}./_-]*)\s+(.+?)\s+(\d[\d.,]*(?:\s*(?:Liter|L))?)\s+(.+)$/u);
   if(match)values=match.slice(1);
  }
  if(values)rows.push({selected:false,listRow:values[0],number:values[1],name:values[2],capacityOriginalInput:values[3],location:values[4],rawLine});
  if(rows.length===200)break;
 }
 return rows;
}
export function reviewedListRow(row){
 const clean={listRow:String(row.listRow).trim(),number:String(row.number).trim(),name:String(row.name).trim(),capacityOriginalInput:String(row.capacityOriginalInput).trim(),location:String(row.location).trim()};
 if(!/^\d{1,8}$/.test(clean.listRow)||Number(clean.listRow)<1)throw Error('Laufende Zeilennummer fehlt oder ist ungültig.');
 if(!clean.number||clean.number.length>60)throw Error('Behälternummer fehlt oder ist zu lang.');
 if(!clean.name||clean.name.length>100)throw Error('Bezeichnung fehlt oder ist zu lang.');
 if(!clean.location||clean.location.length>200)throw Error('Aufstellungsort fehlt oder ist zu lang.');
 return {...clean,capacityL:capacityFromList(clean.capacityOriginalInput)};
}
export function importContainerList(state,rows,{photo,id,createdAt,makeId}){
 const selected=rows.filter(r=>r.selected);if(!selected.length)throw Error('Mindestens eine geprüfte Zeile auswählen.');
 if(selected.length>200)throw Error('Höchstens 200 Zeilen je Scan übernehmen.');
 const numbers=new Set(state.tanks.filter(t=>t.number).map(t=>key(t.number))),lineNumbers=new Set();
 const entries=selected.map(row=>{
  const reviewed=reviewedListRow(row),number=key(reviewed.number);
  if(numbers.has(number))throw Error('Behälternummer '+reviewed.number+' ist bereits vorhanden oder doppelt. Bestehende Tanks bleiben unverändert.');
  if(lineNumbers.has(reviewed.listRow))throw Error('Laufende Zeilennummer '+reviewed.listRow+' ist in der Auswahl doppelt.');
  numbers.add(number);lineNumbers.add(reviewed.listRow);
  return {tankId:makeId(),rawLine:String(row.rawLine??'').slice(0,2000),reviewed};
 });
 const source={id,type:'container-list',origin:photo?'photo':'manual',photoId:photo?.id??null,createdAt,rows:entries};
 const tanks=entries.map(({tankId,reviewed})=>({id:tankId,number:reviewed.number,name:reviewed.name,capacityL:reviewed.capacityL,listRow:reviewed.listRow,location:reviewed.location,listSourceId:id,updatedAt:createdAt,needsNumberReview:false}));
 return {...state,tanks:[...state.tanks,...tanks],sources:[...state.sources,source],photos:photo?[...state.photos,photo]:state.photos};
}
export function validateContainerSources(state){
 if(!Array.isArray(state.sources)||state.sources.length>1000)throw Error('Ungültige Behälterlisten-Quellen.');
 const ids=new Set([...state.tanks,...state.measurements,...state.calculations,...state.corrections,...state.photos,...state.memos,...state.volumeReadings].map(r=>r.id));
 for(const source of state.sources){
  if(source?.type!=='container-list'||typeof source.id!=='string'||!source.id||source.id.length>100||ids.has(source.id)||(source.photoId===null?source.origin!=='manual':!state.photos.some(p=>p.id===source.photoId))||!Number.isFinite(Date.parse(source.createdAt))||!Array.isArray(source.rows)||!source.rows.length||source.rows.length>200)throw Error('Ungültige Quelle der Behälterliste.');
  ids.add(source.id);const tanks=new Set(),numbers=new Set(),lines=new Set();
  for(const row of source.rows){
   const reviewed=reviewedListRow(row.reviewed);
   if(typeof row.tankId!=='string'||!row.tankId||row.tankId.length>100||tanks.has(row.tankId)||numbers.has(key(reviewed.number))||lines.has(reviewed.listRow)||typeof row.rawLine!=='string'||row.rawLine.length>2000||reviewed.capacityL!==row.reviewed.capacityL)throw Error('Ungültige geprüfte Zeile der Behälterliste.');
   tanks.add(row.tankId);numbers.add(key(reviewed.number));lines.add(reviewed.listRow);
  }
 }
 for(const tank of state.tanks){
  if(tank.listRow!==undefined&&(typeof tank.listRow!=='string'||tank.listRow.length>30))throw Error('Ungültige laufende Nummer.');
  if(tank.location!==undefined&&(typeof tank.location!=='string'||tank.location.length>200))throw Error('Ungültiger Aufstellungsort.');
  if(tank.listSourceId!==undefined&&!state.sources.some(s=>s.id===tank.listSourceId&&s.rows.some(r=>r.tankId===tank.id)))throw Error('Quelle des Behälters fehlt.');
 }
}
