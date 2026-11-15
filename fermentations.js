import {effectiveReadings} from './measurement-entry.js';
// SPDX-License-Identifier: GPL-3.0-only
// Wine identity is separate from the current physical vessel.
export const wineKey=s=>String(s).normalize('NFC').trim().toLocaleUpperCase('de-DE');
export function withFermentations(state){
 const batches=[...(state.fermentations??[])];
 for(const tank of state.tanks)if(!batches.some(b=>b.tankId===tank.id||b.id==='f-'+tank.id)){
  const memo=state.memos.filter(m=>m.tankId===tank.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).at(-1);
  const proposed=memo?.wineNumber?.trim()??'';
  batches.push({id:'f-'+tank.id,number:batches.some(b=>proposed&&wineKey(b.number)===wineKey(proposed))?'':proposed,vintage:memo?.vintage||'',name:memo?.description||tank.name,variety:memo?.variety||'',tankId:tank.id,completed:false,favorite:false,assignments:[]});
 }
 return {...state,fermentations:batches,csvImports:state.csvImports??[],measurements:state.measurements.map(m=>m.fermentationId?m:{...m,fermentationId:batches.find(b=>b.tankId===m.tankId)?.id}),calculations:state.calculations.map(c=>c.fermentationId?c:{...c,fermentationId:batches.find(b=>b.tankId===c.tankId)?.id})};
}
export function wineReadings(state,id){return effectiveReadings(state.measurements.filter(m=>m.fermentationId===id)).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.createdAt.localeCompare(b.createdAt));}
export function updateFermentation(state,id,patch,at=new Date().toISOString()){
 const b=state.fermentations.find(b=>b.id===id);if(!b)throw Error('Gärung fehlt.');
 const next={...b,...patch};
 if(next.number&&state.fermentations.some(x=>x.id!==id&&wineKey(x.number)===wineKey(next.number)))throw Error('Weinnummer bereits vergeben.');
 if(next.tankId!==b.tankId){if(!state.tanks.some(t=>t.id===next.tankId))throw Error('Zieltank fehlt.');next.assignments=[...b.assignments,{from:b.tankId,to:next.tankId,at}];}
 return {...state,fermentations:state.fermentations.map(x=>x.id===id?next:x)};
}
export function validateFermentations(state){
 if(state.fermentations===undefined&&state.csvImports===undefined)return;
 if(!Array.isArray(state.fermentations)||!Array.isArray(state.csvImports)||state.fermentations.length>10000)throw Error('Ungültige Gärungsübersicht.');
 const ids=new Set(),numbers=new Set();
 for(const b of state.fermentations){
  if(!b||typeof b.id!=='string'||!b.id||b.id.length>200||ids.has(b.id)||typeof b.number!=='string'||b.number.length>100||typeof b.name!=='string'||b.name.length>2000||!state.tanks.some(t=>t.id===b.tankId)||typeof b.completed!=='boolean'||typeof b.favorite!=='boolean'||!Array.isArray(b.assignments))throw Error('Ungültige Gärung.');
  if(b.variety!==undefined&&(typeof b.variety!=='string'||b.variety.length>200))throw Error('Ungültige Rebsorte.');
  if(b.vintage!==undefined&&(typeof b.vintage!=='string'||b.vintage.length>20))throw Error('Ungültiger Jahrgang.');
  ids.add(b.id);if(b.aliases!==undefined&&(!Array.isArray(b.aliases)||b.aliases.some(a=>typeof a!=='string'||a.length>100)))throw Error('Ungültige Wein-ID-Aliasse.');for(const value of new Set([b.number,...(b.aliases??[])].filter(Boolean).map(wineKey))){if(numbers.has(value))throw Error('Doppelte Weinnummer oder CSV-Zuordnung.');numbers.add(value);}
  for(const a of b.assignments)if(!state.tanks.some(t=>t.id===a.from)&&a.from!==null||!state.tanks.some(t=>t.id===a.to)||!Number.isFinite(Date.parse(a.at)))throw Error('Ungültiger Tankwechsel.');
 }
 for(const m of [...state.measurements,...state.calculations])if(m.fermentationId!==undefined&&!ids.has(m.fermentationId))throw Error('Messung oder Prognose ohne Gärung.');
}
