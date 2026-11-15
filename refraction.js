// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {REFRACTIVE_INDICES as indices} from './refractive-table.js';
export const REFRACTION_VERSION='oiv-as2-02-r2012-table-ii-linear-10-40-v1';
export const FERMENTATION_CORRECTION_STATUS=Object.freeze({available:false,status:'awaiting-validation',reason:'Die Alkoholkorrektur aus Dichte und Lichtbrechung während der Gärung ist noch nicht fachlich validiert.'});
function conditions({temperature,stage}={}){
 if(temperature!==20)throw Error('Umrechnung nur für auf 20 °C bezogene Werte; keine automatische Temperaturkorrektur.');
 if(stage!=='unfermented')throw Error('Diese Umrechnung gilt nur für unvergorene, alkoholfreie Proben. Für die Gärung ist die Alkoholkorrektur noch nicht validiert.');
}
export function brixToRefractiveIndex(value,context){
 conditions(context);
 if(!Number.isFinite(value)||value<10||value>40)throw Error('OIV-Umrechnung hier nur von 10 bis 40 °Brix.');
 const x=(value-10)*10,i=Math.min(Math.floor(x),indices.length-2),fraction=x-i;
 return {value:indices[i]+fraction*(indices[i+1]-indices[i]),unit:'nD',temperature:20,modelVersion:REFRACTION_VERSION,status:'table-interpolation'};
}
export function refractionToBrix(value,context){
 conditions(context);
 if(!Number.isFinite(value)||value<indices[0]||value>indices.at(-1))throw Error(`OIV-Umrechnung hier nur für nD von ${indices[0]} bis ${indices.at(-1)} (10–40 °Brix).`);
 let lo=0,hi=indices.length-1;
 while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(indices[mid]<=value)lo=mid;else hi=mid;}
 return {value:10+(lo+(value-indices[lo])/(indices[hi]-indices[lo]))/10,unit:'°Brix',temperature:20,modelVersion:REFRACTION_VERSION,status:'table-interpolation'};
}
export function validateRefractionMeasurement(m){
 if(m.parameter==='Lichtbrechung'){
  if(!['nD','°Brix'].includes(m.unit)||!Number.isFinite(m.value)||(m.unit==='nD'?(m.value<1||m.value>2):(m.value<0||m.value>100)))throw Error('Ungültiger Refraktionswert: nD 1–2 oder °Brix 0–100.');
 }
 if(m.sampleGroupId!==undefined){
  if(typeof m.sampleGroupId!=='string'||!m.sampleGroupId||m.sampleGroupId.length>100||!['unfermented','fermenting','finished','unknown'].includes(m.sampleStage))throw Error('Ungültige Zuordnung der Probenmessung.');
  if((m.parameter==='Dichte'&&m.value<=0)||(m.parameter==='Gesamtsäure'&&m.value<0))throw Error('Ungültige Dichte oder aktuelle Säure der Probe.');
 }
}
export function validateSampleGroups(measurements){
 const groups=new Map();
 for(const m of measurements){if(m.sampleGroupId===undefined)continue;const group=groups.get(m.sampleGroupId)??[];group.push(m);groups.set(m.sampleGroupId,group);}
 for(const group of groups.values()){
  const first=group[0];
  if(group.length>3||new Set(group.map(m=>m.parameter)).size!==group.length||group.some(m=>!['Lichtbrechung','Dichte','Gesamtsäure'].includes(m.parameter)||m.tankId!==first.tankId||m.date!==first.date||m.time!==first.time||m.sampleStage!==first.sampleStage||m.temperatureC!==first.temperatureC||m.wineType!==first.wineType))throw Error('Zusammengehörige Probenmessungen stimmen nicht überein.');
 }
}
