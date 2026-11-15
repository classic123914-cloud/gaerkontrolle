// SPDX-License-Identifier: GPL-3.0-only
import {parseSpokenReading} from './speech-reading.js';
import {normalizeTankNumber} from './domain.js';
import {localStamp,makeReading} from './measurement-entry.js';
import {unitLabel} from './units.js';

export function roundCommand(text){
 const value=String(text).toLocaleLowerCase('de-DE').trim().replace(/[.,!?;:]+$/,'').trim();
 return ({speichern:'save',bestätigen:'save',korrigieren:'correct',verwerfen:'correct',pause:'pause',weiter:'resume',wiederholen:'repeat','messrunde beenden':'finish'})[value]||null;
}
export function createDictationRound({getState,commit,config,now=()=>new Date()}){
 const settings={...config};let pending=null,count=0,paused=false,ended=false;
 const snapshot=()=>({pending:pending?{...pending}:null,count,paused,ended});
 function reply(text){return {text,...snapshot()};}
 function readback(){return pending?`Tank ${pending.number}: ${pending.originalInput} ${pending.spokenUnit}, ${pending.temperatureOriginalInput?pending.temperatureOriginalInput+' Grad':'Temperatur nicht angegeben'}. Zum Bestätigen Speichern sagen, sonst Korrigieren.`:'Nächsten Tank und Messwerte nennen.';}
 function handle(text){
  if(ended)return reply('Die Messrunde ist beendet.');
  const command=roundCommand(text);
  if(command==='finish'){ended=true;pending=null;return reply(`Messrunde beendet. ${count} Messungen gespeichert.`);}
  if(command==='pause'){paused=true;return reply('Pause. Zum Fortsetzen Weiter sagen.');}
  if(command==='resume'){paused=false;return reply(readback());}
  if(paused)return reply('Die Messrunde pausiert. Zum Fortsetzen Weiter sagen.');
  if(command==='repeat')return reply(readback());
  if(command==='correct'){pending=null;return reply('Vorschlag verworfen. Tank und Messwerte noch einmal nennen.');}
  if(command==='save'){
   if(!pending)return reply('Kein Messvorschlag vorhanden. Nächsten Tank und Messwerte nennen.');
   const state=getState(),wine=state.fermentations.find(b=>b.id===pending.fermentationId&&!b.completed);
   const current=state.fermentations.filter(b=>b.tankId===pending.tankId&&!b.completed&&(!settings.vintage||(settings.vintage==='__none'?!b.vintage:b.vintage===settings.vintage)));
   if(!wine||wine.tankId!==pending.tankId||current.length!==1||current[0].id!==wine.id||!state.tanks.some(t=>t.id===pending.tankId))throw Error('Tankzuordnung wurde geändert. Korrigieren sagen und die Messung neu diktieren.');
   const measurement=makeReading({...pending,method:'Messrunde diktiert',technique:settings.technique,parameter:settings.unit==='g/mL'?'Dichte':'Mostgewicht',unit:settings.unit});
   commit({...state,measurements:[...state.measurements,measurement]});
   const number=pending.number;count++;pending=null;
   return reply(`Tank ${number} gespeichert. Nächsten Tank und Messwerte nennen.`);
  }
  if(pending)return reply('Zuerst den vorgelesenen Vorschlag mit Speichern bestätigen oder Korrigieren sagen.');
  const parsed=parseSpokenReading(text),state=getState();
  if(parsed.unit!==(settings.unit.startsWith('°Oe')?'°Oe':settings.unit))throw Error(`Bitte die gewählte Einheit ${unitLabel(settings.unit)} nennen oder eine neue Messrunde mit anderer Einheit starten.`);
  const tanks=state.tanks.filter(t=>normalizeTankNumber(t.number)===normalizeTankNumber(parsed.number));
  if(tanks.length!==1)throw Error(`Tank ${parsed.number} ist nicht eindeutig vorhanden. Bitte Tanknummer prüfen und neu sprechen.`);
  const tank=tanks[0],wines=state.fermentations.filter(b=>b.tankId===tank.id&&!b.completed&&(!settings.vintage||(settings.vintage==='__none'?!b.vintage:b.vintage===settings.vintage)));
  if(wines.length!==1)throw Error(wines.length?'Mehrere laufende Gärungen in diesem Tank. Vorher die Zuordnung in der App klären.':'Keine laufende Gärung für diesen Tank und Jahrgang vorhanden.');
  const stamp=localStamp(now());
  pending={...parsed,tankId:tank.id,fermentationId:wines[0].id,...stamp,spokenUnit:parsed.unit==='°Oe'?'Oechsle':parsed.unit==='°Brix'?'Brix':'Gramm pro Milliliter'};
  return reply(readback());
 }
 return {handle,snapshot};
}
