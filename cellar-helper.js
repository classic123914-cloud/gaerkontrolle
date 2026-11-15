// SPDX-License-Identifier: GPL-3.0-only
import {brixToOe,oeToBrix} from './units.js';
import {convertMustWeightDensity} from './calculations.js';
import {numberInput} from './domain-v1.js';
export function cellarConversion({task,value,scale,densityUnit,stage,temperature}){
 if(stage!=='unfermented')throw Error(stage==='fermenting'||stage==='finished'?'Der Most gärt schon oder ist bereits Wein. Diese Umrechnung ist dafür nicht geeignet. Erfasse den abgelesenen Wert als Messung.':'Bitte auswählen, ob der Most schon gärt.');
 if(temperature!=='20')throw Error('Bitte prüfen: Der angezeigte Wert muss für 20 °C gelten. Andere Temperaturen werden hier nicht umgerechnet.');
 const input=numberInput(value);
 if(task==='brix')return {...brixToOe(input,scale),input,inputUnit:'°Brix',outputUnit:'°Oe'};
 if(task==='oe')return {value:oeToBrix(input,scale),input,inputUnit:'°Oe',outputUnit:'°Brix',status:scale==='de'?'working-rule':'published-formula'};
 if(task==='density')return {value:convertMustWeightDensity(input,densityUnit,'°Oe',20),input,inputUnit:densityUnit,outputUnit:'°Oe',status:'density-definition'};
 throw Error('Bitte auswählen, was dein Messgerät anzeigt.');
}
export function cellarHelperHTML(p){return `<div class="cellar-helper"><h3>Was zeigt dein Messgerät an?</h3><p>Lies die Zahl und die Einheit am Gerät ab. Hier kannst du den Wert umrechnen.</p><form id="cellar-convert-form"><div class="form-grid"><label>Anzeige am Gerät<select name="task"><option value="brix">Brix (°Brix)</option><option value="density">Dichte (z. B. 1,0800 g/mL)</option><option value="oe">Oechsle (°Oe)</option></select></label><label id="cellar-value-label">Abgelesener Wert<input name="value" required inputmode="decimal" placeholder="z. B. 20"></label><label id="cellar-density-label" hidden>Einheit der Dichte<select name="densityUnit"><option value="g/mL" ${p.densityUnit==='g/mL'?'selected':''}>g/mL – z. B. 1,0800</option>${p.densityUnit==='kg/m³'?'<option value="kg/m³" selected>kg/m³ · bisherige Laboreinstellung</option>':''}<option value="d20/20" ${p.densityUnit==='d20/20'?'selected':''}>d20/20 – z. B. 1,0800</option></select></label><label id="cellar-scale-label">Oechsle-Skala<select name="scale"><option value="de" ${p.oeScale==='de'?'selected':''}>Traubenmost-Skala (Deutsch, D)</option><option value="juice" ${p.oeScale==='juice'?'selected':''}>Saftskala</option></select></label><label>Gärt der Most schon?<select name="stage" required><option value="">Bitte auswählen</option><option value="unfermented">Nein, noch nicht</option><option value="fermenting">Ja, er gärt</option><option value="finished">Die Gärung ist beendet</option><option value="unknown">Weiß ich nicht</option></select></label><label>Für welche Temperatur gilt die Anzeige?<select name="temperature" required><option value="">Bitte auswählen</option><option value="20">20 °C</option><option value="other">Andere Temperatur / weiß ich nicht</option></select></label></div><p class="hint">Nur für Most, der noch nicht gärt. Das Gerät muss den Wert für 20 °C anzeigen.</p><button>Ergebnis anzeigen</button><output id="cellar-convert-result" aria-live="polite"></output></form></div>`;}
export function attachCellarHelper(){
 const form=document.querySelector('#cellar-convert-form'),output=document.querySelector('#cellar-convert-result');
 form.elements.task.onchange=()=>{const task=form.elements.task.value;document.querySelector('#cellar-density-label').hidden=task!=='density';document.querySelector('#cellar-scale-label').hidden=task==='density';form.elements.value.value='';form.elements.value.placeholder=task==='density'?'z. B. 1,0800':task==='oe'?'z. B. 85':'z. B. 20';output.textContent='';};
 form.onsubmit=e=>{e.preventDefault();output.textContent='';output.className='';try{
  const f=Object.fromEntries(new FormData(form)),r=cellarConversion(f),format=(v,d)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(v);
  const scale=r.outputUnit==='°Oe'?(f.task==='density'?' (aus der Dichte)':f.scale==='de'?' (Traubenmost-Skala)':' (Saftskala)'):'';
  output.textContent=`${format(r.input,5)} ${r.inputUnit} entsprechen etwa ${format(r.value,r.outputUnit==='°Oe'?0:1)} ${r.outputUnit}${scale}.`;
  if(r.status==='working-rule')output.textContent+=' Orientierungswert nach der +2-°Oe-Regel. Für genaue Werte gilt die Skala deines Geräts.';
  output.className='cellar-answer';
 }catch(error){output.textContent=error.message;output.className='error';}};
}
