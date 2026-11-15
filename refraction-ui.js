// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {WINE_TYPES,latestSugar} from './measurement-tracks.js';
import {sugarFields,withSugarFields} from './measurement-tracks-ui.js';
import {numberInput} from './domain-v1.js';
import {refractionToBrix,FERMENTATION_CORRECTION_STATUS} from './refraction.js';
import {unitLabel,densityEntryUnits} from './units.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
export function refractionSectionHTML(state,tank){
 const samples=new Set(state.measurements.filter(m=>m.tankId===tank.id&&m.sampleGroupId).map(m=>m.sampleGroupId));
 return `<section class="card"><p class="eyebrow">DICHTE & LICHTBRECHUNG</p><h2>Eine Probe, zusammengehörige Werte</h2><p>Erfasse Dichte und Refraktion derselben Probe. Beide Originalwerte bleiben mit Datum, Temperatur und Probenzustand im Verlauf erhalten.</p><form id="refraction-sample-form"><div class="form-grid"><label>Datum<input name="date" type="date" required value="${date()}"></label><label>Uhrzeit (optional)<input name="time" type="time"></label><label>Probenzustand<select name="stage"><option value="unknown">Unbekannt</option><option value="unfermented">Unvergorener Most / alkoholfrei</option><option value="fermenting">In Gärung</option><option value="finished">Vergorener Wein</option></select></label><label>Weinart<select name="wineType"><option value="unknown">Bitte angeben</option><option value="white">Weißwein</option><option value="red">Rotwein</option><option value="rose">Rosé</option></select></label><label>Lichtbrechung<input name="refraction" inputmode="decimal" required placeholder="z. B. 1,36384"></label><label>Refraktionseinheit<select name="refractionUnit">${['nD','°Brix'].map(u=>`<option value="${u}" ${state.preferences.refractionUnit===u?'selected':''}>${esc(unitLabel(u))}</option>`).join('')}</select></label><label>Dichte derselben Probe<input name="density" inputmode="decimal" required placeholder="z. B. 1,0800"></label><label>Dichteeinheit<select name="densityUnit">${densityEntryUnits(state.preferences.densityUnit).map(u=>`<option value="${u}" ${state.preferences.densityUnit===u?'selected':''}>${esc(unitLabel(u))}</option>`).join('')}</select></label><label>Temperatur °C<input name="temperature" required inputmode="decimal" placeholder="z. B. 20"></label><label>Aktuelle Gesamtsäure g/L (optional)<input name="acid" inputmode="decimal"></label><label>Messmethode / Geräte (optional)<input name="method" maxlength="200"></label>${sugarFields('sample')}</div><p class="hint">Aktuelle Säure bleibt getrennt von der Anfangssäure der Alkoholprognose. Temperatur angeben, auf die sich die Werte beziehen.</p><button>Probenwerte speichern</button><output id="refraction-sample-result" aria-live="polite"></output></form><p class="hint">${samples.size} Proben im Verlauf. ${esc(FERMENTATION_CORRECTION_STATUS.reason)} Deshalb wird aus Gärwerten hier kein Alkohol- oder Restzuckergehalt ausgegeben.</p></section>`;
}
export function attachRefractionSection(tank,{getState,commit,render,message,run}){
 document.querySelector('#refraction-sample-form').onsubmit=e=>{e.preventDefault();run(()=>{
  const form=new FormData(e.target),temperatureOriginalInput=form.get('temperature'),temperatureC=numberInput(temperatureOriginalInput),stage=form.get('stage');
  const shared={tankId:tank.id,date:form.get('date'),time:form.get('time'),temperatureC,temperatureOriginalInput,method:form.get('method'),origin:'manual',sourceId:null,createdAt:new Date().toISOString(),sampleGroupId:crypto.randomUUID(),sampleStage:stage,wineType:form.get('wineType')};
  const entry=(parameter,key,unit)=>({id:crypto.randomUUID(),...shared,parameter,technique:parameter==='Dichte'?'density':parameter==='Lichtbrechung'?'refractometer':'other',originalInput:form.get(key),value:numberInput(form.get(key)),unit});
  const entries=[entry('Lichtbrechung','refraction',form.get('refractionUnit')),entry('Dichte','density',form.get('densityUnit'))];
  if(entries[1].value<=0)throw Error('Dichte muss positiv sein.');
  if(form.get('acid').trim()){const acid=entry('Gesamtsäure','acid','g/L');if(acid.value<0)throw Error('Aktuelle Säure darf nicht negativ sein.');entries.push(acid);}
  const state=getState();const next=withSugarFields({...state,measurements:[...state.measurements,...entries]},entries[0].id,form,'sample');commit(next);render();
  let info='Zusammengehörige Originalwerte gespeichert. '+WINE_TYPES[form.get('wineType')]+'. Aktuelle Säure: '+(form.get('acid').trim()||'nicht erfasst')+' g/L. Berechneter Alkohol und Restzucker aus Dichte, Refraktion und Säure: noch nicht validiert.';
  if(stage==='unfermented'&&temperatureC===20&&entries[0].unit==='nD'){
   try{info+=' Entspricht '+new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(refractionToBrix(entries[0].value,{temperature:20,stage}).value)+' °Brix (OIV-Tabelle, interpoliert).';}catch{info+=' nD liegt außerhalb der hinterlegten OIV-Umrechnung; Originalwert bleibt gespeichert.';}
  }else if(stage==='fermenting'||stage==='finished')info+=' Alkoholkorrektur noch nicht validiert; kein berechneter Alkoholwert.';
  document.querySelector('#refraction-sample-result').textContent=info;message(info);
 });};
}
