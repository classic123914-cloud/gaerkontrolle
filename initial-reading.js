// SPDX-License-Identifier: GPL-3.0-only
import {numberInput,validDate} from './domain-v1.js';
import {resolveMostWeight,MUST_UNITS} from './units.js';
import {predictNaturalAlcohol,correctedAlcohol} from './calculations.js';

export function initialForecast({id,tankId,createdAt,originalInput,unit,acid,fermentation,oeScale,correction=null}){
 const mostWeight={originalInput,value:numberInput(originalInput),unit};
 const derivedMostWeight=resolveMostWeight(mostWeight,oeScale);
 const initialAcid={originalInput:acid,value:numberInput(acid),unit:'g/L'};
 const inputs={mostWeight,oeScale:derivedMostWeight.scale,initialAcid,fermentation};
 const base=predictNaturalAlcohol({oe:derivedMostWeight.value,initialAcid:initialAcid.value,fermentation});
 return {id,tankId,createdAt,modelVersion:base.modelVersion,inputs,derivedMostWeight,base,correction:correction?structuredClone(correction):null,corrected:correctedAlcohol(base.alcoholGL,correction)};
}

// Only an explicitly declared pre-fermentation reading can create initial values.
export function appendInitialReading(state,measurement,{acid,fermentation,acidId,forecastId}){
 if(measurement.parameter!=='Mostgewicht')throw Error('Ausgangswerte benötigen ein Ausgangsmostgewicht.');
 const forecast=initialForecast({id:forecastId,tankId:measurement.tankId,createdAt:measurement.createdAt,originalInput:measurement.originalInput,unit:measurement.unit,acid,fermentation,oeScale:state.preferences.oeScale,correction:state.corrections.find(c=>c.tankId===measurement.tankId)});
 return {...state,measurements:[...state.measurements,...initialReadingPair({...measurement,measurementRole:'initial'},acid,acidId)],calculations:[...state.calculations,forecast]};
}

function initialReadingPair(most,acid,acidId){
 return [most,{...most,id:acidId,parameter:'Gesamtsäure',unit:'g/L',originalInput:acid,value:numberInput(acid),technique:'other',method:'',temperatureOriginalInput:'',temperatureC:null}];
}
// A separate pair of original readings; never creates a natural alcohol forecast.
export function appendSugarInitialReading(state,measurement,{acid,acidId}){
 const pair=initialReadingPair({...measurement,measurementRole:'sugar-initial',sugarBaselineId:measurement.id},acid,acidId);
 pair.forEach(validateSugarInitialReading);
 return {...state,measurements:[...state.measurements,...pair]};
}
export function validateSugarInitialReading(m){
 if(m.measurementRole!=='sugar-initial')return;
 if(typeof m.sugarBaselineId!=='string'||!m.sugarBaselineId||!validDate(m.date)||!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(m.time??''))throw Error('Für Restzucker-Ausgangswerte Datum und Uhrzeit der gemeinsamen Messung angeben.');
 if(m.parameter==='Mostgewicht'){
  if(m.sugarBaselineId!==m.id||!MUST_UNITS.includes(m.unit)||!Number.isFinite(m.value)||m.value<0)throw Error('Mostgewicht nach der Anreicherung angeben.');
 }else if(m.parameter!=='Gesamtsäure'||m.unit!=='g/L'||!Number.isFinite(m.value)||m.value<0||m.value>50)throw Error('Gesamtsäure zum selben Messzeitpunkt angeben (0–50 g/L).');
}
export function sugarInitialReadings(measurements){
 const most=measurements.filter(m=>m.measurementRole==='sugar-initial'&&m.parameter==='Mostgewicht').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).at(-1);
 if(!most)return null;
 const acid=measurements.find(m=>m.measurementRole==='sugar-initial'&&m.parameter==='Gesamtsäure'&&m.sugarBaselineId===most.sugarBaselineId&&m.fermentationId===most.fermentationId&&m.tankId===most.tankId&&m.date===most.date&&m.time===most.time);
 if(!acid)return null;
 validateSugarInitialReading(most);validateSugarInitialReading(acid);
 return {most,acid};
}
