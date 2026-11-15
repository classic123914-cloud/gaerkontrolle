// SPDX-License-Identifier: GPL-3.0-only
import {parseSpokenReading} from './speech-reading.js';
import {normalizeTankNumber} from './domain.js';
import {localStamp} from './measurement-entry.js';
import {html as esc} from './fermentation-chart.js';
export function setupSpeechReading({getState,onOpen,message}){
 const dialog=document.createElement('dialog');dialog.id='speech-dialog';
 dialog.innerHTML='<h2>Messung sprechen</h2><p>Zum Beispiel: „Tank 12, 82 Oechsle, 18 Komma 5 Grad.“</p><p class="hint">Du kannst auch das Mikrofon deiner Smartphone-Tastatur im Textfeld verwenden. Ob diese Diktierfunktion offline arbeitet, hängt von deinem Gerät ab.</p><label>Gesprochene Messung<textarea id="speech-text" rows="3" maxlength="1000" placeholder="Tank 12, 82 Oechsle, 18 Komma 5 Grad"></textarea></label><button id="speech-mic" type="button" class="secondary">Mikrofon starten</button><button id="speech-install" type="button" class="secondary" hidden>Deutsches Offline-Sprachpaket laden</button><label class="inline-check"><input id="speech-network" type="checkbox"> Browserdienst erlauben: Audio kann an einen externen Spracherkennungsdienst übertragen werden.</label><p id="speech-status" role="status"></p><button id="speech-parse" type="button">Text auswerten</button><form id="speech-review" hidden><h3>Erkannte Angaben prüfen</h3><label>Gärung<select name="wine" required></select></label><div class="form-grid"><label>Messwert<input name="value" inputmode="decimal" required></label><label>Einheit<select name="unit"><option>°Oe</option><option>°Brix</option><option>g/mL</option></select></label><label>Temperatur °C<input name="temperature" inputmode="decimal"></label><label>Datum<input name="date" type="date" required></label><label>Uhrzeit<input name="time" type="time" required></label></div><p class="hint">Mit „Ins Messformular übernehmen“ wird noch nichts gespeichert. Dort Messverfahren und Werte prüfen und „Wert speichern“ wählen.</p><button>Ins Messformular übernehmen</button></form><button id="speech-close" type="button" class="secondary">Schließen</button>';
 document.body.append(dialog);const $=s=>dialog.querySelector(s),Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 let recognition=null,localAvailable=false,token=0;
 function controls(){ $('#speech-mic').disabled=!Recognition||!window.isSecureContext||!localAvailable&&!$('#speech-network').checked; }
 function review(){
  $('#speech-review').hidden=true;
  try{
   const parsed=parseSpokenReading($('#speech-text').value),s=getState();
   const tank=s.tanks.find(t=>normalizeTankNumber(t.number)===normalizeTankNumber(parsed.number));
   if(!tank)throw Error('Tank '+parsed.number+' ist nicht vorhanden. Tanknummer im Text korrigieren.');
   const wines=s.fermentations.filter(b=>b.tankId===tank.id&&!b.completed);if(!wines.length)throw Error('Für diesen Tank gibt es keine laufende Gärung.');
   const form=$('#speech-review');form.elements.wine.innerHTML=(wines.length>1?'<option value="">Gärung ausdrücklich auswählen</option>':'')+wines.map(b=>`<option value="${esc(b.id)}">Tank ${esc(tank.number)} · ${esc(b.number||b.name)}</option>`).join('');
   form.elements.value.value=parsed.originalInput;form.elements.unit.value=parsed.unit;form.elements.temperature.value=parsed.temperatureOriginalInput;
   Object.assign(form.elements.date,{value:localStamp().date});form.elements.time.value=localStamp().time;
   form.hidden=false;$('#speech-status').textContent='Erkannte Angaben prüfen und bei Bedarf korrigieren.';
  }catch(error){$('#speech-status').textContent=error.message;}
 }
 $('#speech-parse').onclick=review;$('#speech-text').oninput=()=>{$('#speech-review').hidden=true;};
 $('#speech-network').onchange=()=>{if(!localAvailable&&!$('#speech-network').checked)recognition?.abort();controls();};
 $('#speech-mic').onclick=()=>{
  if(recognition){recognition.stop();return;}if($('#speech-mic').disabled)return;
  recognition=new Recognition();recognition.lang='de-DE';recognition.continuous=false;recognition.interimResults=false;
  if(localAvailable)recognition.processLocally=true;
  const current=token;$('#speech-mic').textContent='Aufnahme beenden';$('#speech-status').textContent=localAvailable?'Lokale Spracherkennung hört zu …':'Browser-Spracherkennung hört zu. Ein externer Dienst kann verwendet werden.';
  recognition.onresult=event=>{if(current!==token)return;$('#speech-text').value=event.results[0][0].transcript;review();};
  recognition.onerror=event=>{if(current===token)$('#speech-status').textContent='Spracherkennung nicht möglich ('+event.error+'). Text eingeben oder über die Tastatur diktieren.';};
  recognition.onend=()=>{recognition=null;$('#speech-mic').textContent='Mikrofon starten';};
  try{recognition.start();}catch(error){recognition=null;$('#speech-mic').textContent='Mikrofon starten';$('#speech-status').textContent=error.message;}
 };
 $('#speech-install').onclick=async()=>{try{const current=token;$('#speech-install').disabled=true;const installed=await Recognition.install({langs:['de-DE'],processLocally:true});if(current!==token)return;localAvailable=installed;$('#speech-status').textContent=installed?'Deutsches Sprachpaket ist lokal verfügbar.':'Sprachpaket konnte nicht installiert werden.';controls();}catch(error){$('#speech-status').textContent=error.message;}finally{$('#speech-install').disabled=false;}};
 $('#speech-review').onsubmit=event=>{
  event.preventDefault();const form=event.target,id=form.elements.wine.value,s=getState(),wine=s.fermentations.find(b=>b.id===id&&!b.completed);
  if(!wine){$('#speech-status').textContent='Gärung nicht mehr verfügbar. Bitte Text neu auswerten.';return;}
  onOpen(id,'entry');const target=document.querySelector('#measurement-form'),unit=form.elements.unit.value;
  target.elements.parameter.value=unit==='g/mL'?'Dichte':'Mostgewicht';target.elements.parameter.onchange();
  if(unit!=='°Oe'||!target.elements.unit.value.startsWith('°Oe'))target.elements.unit.value=unit;
  target.elements.value.value=form.elements.value.value;target.elements.temperature.value=form.elements.temperature.value;target.elements.date.value=form.elements.date.value;target.elements.time.value=form.elements.time.value;
  target.elements.technique.value='density';target.dispatchEvent(new Event('input'));dialog.close();message('Sprachvorschlag übernommen. Messverfahren und Werte prüfen und speichern.');
 };
 $('#speech-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{token++;recognition?.abort();recognition=null;$('#speech-network').checked=false;});
 document.addEventListener('click',async event=>{if(!event.target.closest('[data-speech-reading]'))return;
  const current=++token;$('#speech-text').value='';$('#speech-review').hidden=true;$('#speech-network').checked=false;$('#speech-install').hidden=true;localAvailable=false;controls();
  $('#speech-status').textContent=Recognition&&window.isSecureContext?'Lokale Spracherkennung wird geprüft.':'Kein verfügbares Browser-Mikrofon. Text eingeben oder über die Tastatur diktieren.';dialog.showModal();
  if(Recognition&&'processLocally' in Recognition.prototype&&typeof Recognition.available==='function')try{const status=await Recognition.available({langs:['de-DE'],processLocally:true});if(current!==token)return;localAvailable=status==='available';$('#speech-install').hidden=!['downloadable','downloading'].includes(status)||typeof Recognition.install!=='function';$('#speech-status').textContent=localAvailable?'Deutsch wird auf diesem Gerät erkannt.':'Deutsch ist lokal nicht verfügbar. Tastatur-Diktat verwenden oder Browserdienst ausdrücklich erlauben.';controls();}catch{if(current===token)$('#speech-status').textContent='Lokale Spracherkennung nicht verfügbar. Text eingeben oder Tastatur-Diktat verwenden.';}
  else if(Recognition&&window.isSecureContext)$('#speech-status').textContent='Dieser Browser bietet keine geprüfte lokale Spracherkennung. Text eingeben, Tastatur-Diktat verwenden oder Browserdienst ausdrücklich erlauben.';
 });
 return {dialog};
}
