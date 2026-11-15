// SPDX-License-Identifier: GPL-3.0-only
import {numberInput,validDate} from './domain-v1.js';
import {techniqueCompatible} from './measurement-tracks.js';
export function localStamp(date=new Date()){
 const pad=n=>String(n).padStart(2,'0');
 return {date:`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,time:`${pad(date.getHours())}:${pad(date.getMinutes())}`};
}
// Broad entry checks, not a diagnosis or a retroactive rejection of old data.
export function checkReading(m,{imported=false}={}){
 const ranges={'°Oe':[-100,300],'°Oe (DE)':[-100,300],'°Oe (Saft)':[-100,300],'°Brix':[-10,90],KMW:[-10,60],'g/mL':[.7,1.6],'d20/20':[.7,1.6],'kg/m³':[700,1600],nD:[1.3,1.6],'°C':[-50,100]};
 const range=m.unit.startsWith('°Oe')?[-100,300]:ranges[m.unit];
 if(!imported&&m.unit.startsWith('°Oe')&&!Number.isInteger(m.value))throw Error('°Oe bitte als ganze Zahl eingeben.');
 if(!Number.isFinite(m.value)||range&&(m.value<range[0]||m.value>range[1]))throw Error('Messwert unplausibel. Zahl, Dezimalstelle und Einheit prüfen.');
 if(m.temperatureC!==null&&m.temperatureC!==undefined&&(!Number.isFinite(m.temperatureC)||m.temperatureC< -50||m.temperatureC>100))throw Error('Temperatur unplausibel. Dezimalstelle prüfen (z. B. 18,5 °C).');
 if(['Gesamtsäure','Alkohol (Analyse)'].includes(m.parameter)&&m.value<0)throw Error('Dieser Analysenwert darf nicht negativ sein.');
 return m;
}
export function makeReading({tankId,fermentationId,date,time,parameter,unit,originalInput,temperatureOriginalInput='',technique='density',wineType='unknown',method='',id=crypto.randomUUID(),createdAt=new Date().toISOString()}){
 if(!validDate(date)||typeof time!=='string'||time!==''&&!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))throw Error('Datum oder Uhrzeit ungültig.');
 const m={id,tankId,fermentationId,date,time,parameter,unit,originalInput,value:numberInput(originalInput),temperatureOriginalInput,temperatureC:temperatureOriginalInput.trim()?numberInput(temperatureOriginalInput):null,technique,wineType,method,origin:'manual',sourceId:null,createdAt};
 if(!techniqueCompatible(m,technique))throw Error('Messverfahren passt nicht zur Messgröße.');
 return checkReading(m);
}
export function effectiveReadings(rows){const replaced=new Set(rows.map(m=>m.supersedesId).filter(Boolean));return rows.filter(m=>!replaced.has(m.id));}
export function correctReading(state,id,patch,options={}){
 const old=state.measurements.find(m=>m.id===id);
 if(!old||state.measurements.some(m=>m.supersedesId===id))throw Error('Bitte die aktuelle Fassung der Messung korrigieren.');
 if(old.sampleGroupId||['initial','sugar-initial'].includes(old.measurementRole))throw Error('Zusammengehörige Proben und Ausgangswerte bitte über ihren ursprünglichen Erfassungsweg berichtigen.');
 const corrected=makeReading({...old,...patch,tankId:old.tankId,fermentationId:old.fermentationId,parameter:old.parameter,unit:old.unit,id:options.id??crypto.randomUUID(),createdAt:options.createdAt??new Date().toISOString()});
 return {...state,measurements:[...state.measurements,{...corrected,createdAt:old.createdAt,correctedAt:corrected.createdAt,supersedesId:id,correctionReason:String(patch.correctionReason??'').trim().slice(0,200)}]};
}
export function validateRevisions(state){
 const byId=new Map(state.measurements.map(m=>[m.id,m])),seen=new Set();
 for(const m of state.measurements)if(m.supersedesId!==undefined){
  const old=byId.get(m.supersedesId);
  if(!old||m.origin!=='manual'||old.tankId!==m.tankId||old.fermentationId!==m.fermentationId||old.parameter!==m.parameter||old.unit!==m.unit||seen.has(old.id)||typeof m.correctedAt!=='string'||!Number.isFinite(Date.parse(m.correctedAt))||typeof m.correctionReason!=='string'||m.correctionReason.length>200)throw Error('Ungültiger Bezug einer Messwertkorrektur.');
  seen.add(old.id);const chain=new Set([m.id]);let current=old;
  while(current){if(chain.has(current.id))throw Error('Zirkuläre Messwertkorrektur.');chain.add(current.id);current=byId.get(current.supersedesId);}
 }
}
export function measurementsCSV(state){
 const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
 const replaced=new Set(state.measurements.map(m=>m.supersedesId).filter(Boolean));
 const header=['Messung-ID','Weinnummer','Tanknummer','Datum','Uhrzeit','Messgröße','Originalwert','Einheit','Temperatur °C','Messverfahren','Gerät / Details','Quelle','Stand','Korrigiert Messung-ID'];
 return '\uFEFF'+[header,...state.measurements.map(m=>[m.id,state.fermentations?.find(b=>b.id===m.fermentationId)?.number,state.tanks.find(t=>t.id===m.tankId)?.number,m.date,m.time,m.parameter,m.originalInput,m.unit,m.temperatureOriginalInput,m.technique,m.method,m.origin,replaced.has(m.id)?'ersetzt':'aktuell',m.supersedesId])].map(row=>row.map(value=>{const s=String(value??'');return cell(/^[=+@\t\r]|^-\s*[^\d.,]/.test(s)?"'"+s:s);}).join(';')).join('\r\n');
}
