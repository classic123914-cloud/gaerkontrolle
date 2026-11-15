// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {numberInput,validDate} from './domain-v1.js';
export const TECHNIQUES=Object.freeze({density:'Dichtemessung',refractometer:'Refraktometer',other:'Analyse / sonstige Messung',unknown:'Messverfahren nicht zugeordnet'});
export const WINE_TYPES=Object.freeze({white:'Weißwein',red:'Rotwein',rose:'Rosé',unknown:'Weinart nicht angegeben'});
export function techniqueFor(m){return m.technique??(m.parameter==='Dichte'?'density':m.parameter==='Lichtbrechung'?'refractometer':'unknown');}
export function techniqueLabel(m){return TECHNIQUES[techniqueFor(m)];}
export function techniqueCompatible(m,technique){return Object.hasOwn(TECHNIQUES,technique)&&(m.parameter!=='Dichte'||technique==='density')&&(m.parameter!=='Lichtbrechung'||technique==='refractometer');}
export function splitTracks(measurements){return Object.keys(TECHNIQUES).map(key=>({key,label:TECHNIQUES[key],measurements:measurements.filter(m=>techniqueFor(m)===key)})).filter(t=>t.measurements.length);}
export function latestSugar(state,measurementId){return state.sugarAnalyses.filter(a=>a.measurementIds.includes(measurementId)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).at(-1)??null;}
export function addSugarAnalysis(state,measurementId,{id,originalInput,method,date,createdAt}){
 const measurement=state.measurements.find(m=>m.id===measurementId);if(!measurement)throw Error('Zugehörige Messung fehlt.');
 const value=numberInput(originalInput);if(value<0)throw Error('Restzucker darf nicht negativ sein.');
 if(typeof method!=='string'||!method.trim()||method.length>200)throw Error('Quelle / Analysemethode für Restzucker angeben.');
 if(!validDate(date))throw Error('Gültiges Analysedatum angeben.');
 const measurementIds=state.measurements.filter(m=>m.id===measurementId||(measurement.sampleGroupId&&m.sampleGroupId===measurement.sampleGroupId&&m.tankId===measurement.tankId)).map(m=>m.id);
 const analysis={id,tankId:measurement.tankId,measurementIds,kind:'analysis',value,originalInput,unit:'g/L',method:method.trim(),date,createdAt};
 return {...state,sugarAnalyses:[...state.sugarAnalyses,analysis]};
}
export function setTechnique(state,measurementId,technique,changedAt){
 const current=state.measurements.find(m=>m.id===measurementId);if(!current||!techniqueCompatible(current,technique))throw Error('Messverfahren passt nicht zur Messgröße.');
 if(technique===techniqueFor(current))return state;
 return {...state,measurements:state.measurements.map(m=>m.id===measurementId?{...m,technique,techniqueHistory:[...(m.techniqueHistory??[]),{previous:techniqueFor(m),technique,changedAt}]}:m)};
}
export function deleteMeasurement(state,id){
 if(state.measurements.some(m=>m.supersedesId===id))throw Error('Zuerst die zugehörige Korrektur löschen. Das Original bleibt bis dahin erhalten.');
 return {...state,photos:state.photos.filter(p=>state.measurements.some(m=>m.id!==id&&m.photoId===p.id)||state.memos.some(m=>m.photoId===p.id)||state.sources.some(s=>s.photoId===p.id)),measurements:state.measurements.filter(m=>m.id!==id),sugarAnalyses:state.sugarAnalyses.map(a=>({...a,measurementIds:a.measurementIds.filter(mid=>mid!==id)})).filter(a=>a.measurementIds.length)};
}
export function validateMeasurementTracks(state){
 if(!Array.isArray(state.sugarAnalyses)||!Array.isArray(state.sugarCalculations)||state.sugarCalculations.length!==0)throw Error('Restzuckerberechnungen sind noch nicht validiert.');
 for(const m of state.measurements){
  if(!techniqueCompatible(m,techniqueFor(m))||(m.wineType!==undefined&&!Object.hasOwn(WINE_TYPES,m.wineType)))throw Error('Ungültiges Messverfahren oder Weinart.');
  if(m.techniqueHistory!==undefined){
   if(!Array.isArray(m.techniqueHistory)||m.techniqueHistory.length>1000)throw Error('Ungültiger Verlauf des Messverfahrens.');
   for(const h of m.techniqueHistory)if(!Object.hasOwn(TECHNIQUES,h.previous)||!techniqueCompatible(m,h.technique)||typeof h.changedAt!=='string'||!Number.isFinite(Date.parse(h.changedAt)))throw Error('Ungültige Zuordnung im Methodenverlauf.');
   if(m.techniqueHistory.length&&m.techniqueHistory.at(-1).technique!==m.technique)throw Error('Aktuelles Messverfahren stimmt nicht mit dem Verlauf überein.');
  }
 }
 const ids=new Set([...state.tanks,...state.measurements,...state.calculations,...state.corrections,...state.photos,...state.memos,...state.volumeReadings,...state.sources].map(x=>x.id));
 if(state.sugarAnalyses.length>100000)throw Error('Zu viele Restzuckeranalysen.');
 for(const a of state.sugarAnalyses){
  if(typeof a.id!=='string'||!a.id||a.id.length>100||ids.has(a.id)||a.kind!=='analysis'||a.unit!=='g/L'||!Number.isFinite(a.value)||a.value<0||numberInput(a.originalInput)!==a.value||!validDate(a.date)||typeof a.createdAt!=='string'||!Number.isFinite(Date.parse(a.createdAt))||typeof a.method!=='string'||!a.method.trim()||a.method.length>200||!Array.isArray(a.measurementIds)||!a.measurementIds.length||new Set(a.measurementIds).size!==a.measurementIds.length)throw Error('Ungültige Restzuckeranalyse.');
  ids.add(a.id);
  const targets=a.measurementIds.map(id=>state.measurements.find(m=>m.id===id));
  if(targets.some(m=>!m||m.tankId!==a.tankId)||targets.length>1&&targets.some(m=>!m.sampleGroupId||m.sampleGroupId!==targets[0].sampleGroupId))throw Error('Restzuckeranalyse gehört nicht zu derselben Probe.');
 }
}
