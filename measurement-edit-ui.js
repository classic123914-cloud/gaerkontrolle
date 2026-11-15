// SPDX-License-Identifier: GPL-3.0-only
import {correctReading} from './measurement-entry.js';
import {html as esc} from './fermentation-chart.js';
export function setupMeasurementEditor({getState,commit,render,message}){
 const dialog=document.createElement('dialog');dialog.id='measurement-edit-dialog';document.body.append(dialog);
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-edit-measurement]');if(!button)return;
  const id=button.dataset.editMeasurement,m=getState().measurements.find(m=>m.id===id);if(!m)return;
  const original=JSON.stringify(m);
  dialog.innerHTML=`<h2>Messwert korrigieren</h2><p>Original: ${esc(m.originalInput)} ${esc(m.unit)} · ${esc(m.date)} ${esc(m.time)}. Die Originalmessung und ihre Quelle bleiben erhalten. Kurve und Übersicht verwenden die Korrektur.</p><form><label>Messwert (${esc(m.unit)})<input name="value" inputmode="decimal" value="${esc(m.originalInput)}" required></label><label>Temperatur °C<input name="temperature" inputmode="decimal" value="${esc(m.temperatureOriginalInput)}"></label><label>Datum<input name="date" type="date" value="${esc(m.date)}" required></label><label>Uhrzeit<input name="time" type="time" step="1" value="${esc(m.time)}"></label><label>Grund der Korrektur (optional)<input name="reason" maxlength="200"></label><p class="error" role="alert"></p><div class="actions"><button type="button" class="secondary">Abbrechen</button><button>Korrektur speichern</button></div></form>`;
  dialog.querySelector('[type=button]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=event=>{
   event.preventDefault();try{
    if(JSON.stringify(getState().measurements.find(m=>m.id===id))!==original)throw Error('Messung inzwischen geändert. Bitte neu öffnen.');
    const f=new FormData(event.target);commit(correctReading(getState(),id,{date:f.get('date'),time:f.get('time'),originalInput:f.get('value'),temperatureOriginalInput:f.get('temperature'),correctionReason:f.get('reason')}));
    dialog.close();render();message('Korrektur gespeichert. Originalmessung bleibt im Verlauf erhalten.');
   }catch(error){dialog.querySelector('.error').textContent=error.message;}
  };dialog.showModal();
 });
}
