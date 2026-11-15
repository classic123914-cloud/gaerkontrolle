// SPDX-License-Identifier: GPL-3.0-only
import {createDictationRound,roundCommand} from './dictation-round.js';
import {html as esc} from './fermentation-chart.js';
import {unitLabel,OE_DE,OE_JUICE} from './units.js';

export function setupDictationRound({getState,commit,onFinish}){
 const dialog=document.createElement('dialog');dialog.id='dictation-round-dialog';dialog.setAttribute('aria-labelledby','dictation-round-title');dialog.setAttribute('translate','no');
 dialog.innerHTML=`<h2 id="dictation-round-title">Messrunde diktieren</h2>
 <p id="dictation-intro">Einmal starten, jeden Tank nennen und die vorgelesenen Werte mit „Speichern“ bestätigen. Spracherkennung und Befehle: Deutsch.</p>
 <p id="dictation-capability" class="hint"></p><p id="dictation-https" hidden><a class="button secondary" href="handy-einrichten.html">Handy einmalig für die sichere Messrunde einrichten</a><a class="button secondary" href="https://192.168.178.36:8443/">Nach Einrichtung: sichere App öffnen</a></p>
 <div id="dictation-settings" class="form-grid"><label>Jahrgang<select id="dictation-vintage"></select></label><label>Messverfahren<select id="dictation-technique"><option value="density">Dichtemessung</option><option value="refractometer">Refraktometer</option></select></label><label>Einheit<select id="dictation-unit"></select></label></div>
 <p class="hint" id="dictation-example">Beispiel: „Tank zwölf, zweiundachtzig Oechsle, achtzehn Komma fünf Grad.“ Nach dem Vorlesen „Speichern“ sagen. Für jeden weiteren Tank genauso fortfahren.</p>
 <label class="inline-check" id="dictation-service"><input id="dictation-network" type="checkbox"> Browser-Spracherkennung erlauben, falls Deutsch nicht lokal verfügbar ist. Audio kann dabei an den Spracherkennungsdienst des Browsers übertragen werden.</label>
 <button id="dictation-install" class="secondary" hidden>Deutsches Offline-Sprachpaket laden</button>
 <p id="dictation-wake" class="hint" role="status"></p>
 <p id="dictation-status" class="dictation-status" role="status" aria-live="polite">Bereit.</p>
 <p id="dictation-count">0 Messungen gespeichert</p>
 <div class="actions"><button id="dictation-start">Messrunde starten</button><button id="dictation-resume" hidden>Messrunde fortsetzen</button><button id="dictation-save" class="secondary" hidden>Speichern</button><button id="dictation-correct" class="secondary" hidden>Korrigieren</button><button id="dictation-pause" class="secondary" hidden>Pause</button><button id="dictation-finish" class="secondary" hidden>Messrunde beenden</button><button id="dictation-close" class="secondary">Schließen</button></div>
 <details><summary>Sprachbefehle</summary><p>Speichern · Korrigieren · Wiederholen · Pause · Weiter · Messrunde beenden</p><p>In der Pause hört die App weiter auf „Weiter“ und „Messrunde beenden“. Bitte die App sichtbar lassen. Bei einem Anruf, einem App-Wechsel oder einer Bildschirmsperre kann der Browser unterbrechen. Bestätigte Messungen bleiben gespeichert.</p></details>`;
 document.body.append(dialog);const $=s=>dialog.querySelector(s);
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 let round=null,active=false,suspended=false,speaking=false,localAvailable=false,recognition=null,wake=null,wakeRequest=null,timer=null,speechTimer=null,finalTimer=null,finalBuffer='',listenToken=0,speechToken=0,openToken=0;
 const status=text=>{$('#dictation-status').textContent=text;};
 function render(){
  const snapshot=round?.snapshot();
  for(const id of ['intro','example','settings','service','capability'])$('#dictation-'+id).hidden=active;
  const count=snapshot?.count||0;$('#dictation-count').textContent=`${count} ${count===1?'Messung':'Messungen'} gespeichert`;
  $('#dictation-start').hidden=active;$('#dictation-close').hidden=active;
  $('#dictation-start').disabled=!window.isSecureContext||!Recognition||!window.speechSynthesis||!window.SpeechSynthesisUtterance||!localAvailable&&!$('#dictation-network').checked;
  $('#dictation-resume').hidden=!active||!suspended;
  for(const id of ['save','correct']){$('#dictation-'+id).hidden=!active||!snapshot?.pending;$('#dictation-'+id).disabled=suspended||speaking||snapshot?.paused;}
  $('#dictation-pause').hidden=!active;$('#dictation-pause').disabled=suspended||speaking;$('#dictation-pause').textContent=snapshot?.paused?'Weiter':'Pause';
  $('#dictation-finish').hidden=!active;
  for(const field of dialog.querySelectorAll('#dictation-settings select,#dictation-network,#dictation-install'))field.disabled=active;
 }
 function stopListening(){clearTimeout(timer);clearTimeout(finalTimer);timer=null;finalTimer=null;finalBuffer='';listenToken++;const previous=recognition;recognition=null;try{previous?.abort();}catch{}}
 function releaseWake(){const previous=wake;wake=null;previous?.release().catch(()=>{});}
 async function keepAwake(){
  if(!active||document.hidden||wake||wakeRequest)return;
  if(!navigator.wakeLock){$('#dictation-wake').textContent='Automatisches Wachhalten wird hier nicht unterstützt. Bildschirm-Zeitlimit am Gerät für die Messrunde ausschalten.';return;}
  let request;
  try{
   request=navigator.wakeLock.request('screen');wakeRequest=request;
   const lock=await request;
   if(!active||document.hidden){await lock.release();return;}
   wake=lock;$('#dictation-wake').textContent='Bildschirm bleibt während der Messrunde eingeschaltet.';
   lock.addEventListener('release',()=>{if(wake===lock){wake=null;if(active)$('#dictation-wake').textContent='Bildschirm-Wachfunktion wurde vom Gerät beendet. Bildschirm-Zeitlimit prüfen oder die Messrunde fortsetzen.';}});
  }catch{$('#dictation-wake').textContent='Das Gerät hat das Wachhalten nicht erlaubt. Bildschirm-Zeitlimit am Gerät für die Messrunde ausschalten.';}
  finally{if(wakeRequest===request)wakeRequest=null;}
 }
 function interrupt(text){
  suspended=true;stopListening();clearTimeout(speechTimer);speechToken++;speaking=false;window.speechSynthesis?.cancel();releaseWake();
  status(text+' Bereits bestätigte Messungen sind gespeichert. Zum Weiterarbeiten „Messrunde fortsetzen“ antippen.');render();
 }
 function listen(){
  if(!active||suspended||speaking||document.hidden||recognition)return;
  const token=++listenToken;
  const rec=new Recognition();recognition=rec;rec.lang='de-DE';rec.continuous=true;rec.interimResults=false;
  if(localAvailable)rec.processLocally=true;
  rec.onresult=event=>{
   if(token!==listenToken||suspended||speaking)return;
   // Browsers may split tank, value and temperature into separate final results.
   // Join them across a short speaking pause; commands remain immediate.
   for(let i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal){
    const text=event.results[i][0].transcript.trim();
    if(!finalBuffer&&roundCommand(text)){stopListening();receive(text);return;}
    finalBuffer+=(finalBuffer?' ':'')+text;
   }
   clearTimeout(finalTimer);finalTimer=setTimeout(()=>{
    const text=finalBuffer;
    // Stop capture before reading back, so the app cannot confirm itself.
    stopListening();if(text)receive(text);
   },1200);
  };
  rec.onerror=event=>{
   if(token!==listenToken)return;
   if(event.error==='no-speech')return;
   interrupt(event.error==='not-allowed'||event.error==='service-not-allowed'?'Mikrofonzugriff wurde nicht erlaubt.':'Spracherkennung unterbrochen ('+event.error+').');
  };
  rec.onend=()=>{if(token!==listenToken)return;recognition=null;if(active&&!suspended&&!speaking)timer=setTimeout(listen,500);};
  try{rec.start();}catch{interrupt('Das Mikrofon konnte nicht gestartet werden.');}
 }
 function announce(text,finished=false){
  stopListening();clearTimeout(speechTimer);const token=++speechToken;speaking=true;status(text);render();
  window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='de-DE';utterance.rate=.95;
  utterance.onend=()=>{if(token!==speechToken)return;clearTimeout(speechTimer);speaking=false;render();if(!finished&&active&&!suspended)timer=setTimeout(listen,350);};
  utterance.onerror=()=>{if(token===speechToken&&!finished)interrupt('Die Sprachausgabe wurde unterbrochen.');};
  speechTimer=setTimeout(()=>{if(token===speechToken){if(finished){speaking=false;render();}else interrupt('Die Sprachausgabe hat nicht geantwortet.');}},Math.max(15000,text.length*100));
  try{window.speechSynthesis.speak(utterance);}catch{interrupt('Die Sprachausgabe konnte nicht gestartet werden.');}
 }
 function stop(){
  active=false;suspended=false;stopListening();clearTimeout(speechTimer);speechToken++;speaking=false;window.speechSynthesis?.cancel();releaseWake();render();
 }
 function receive(text){
  if(!active||suspended)return;
  try{
   const result=round.handle(text);
   if(result.ended){stop();announce(result.text,true);onFinish?.();}
   else announce(result.text);
  }catch(error){announce(error.message+' Es wurde nichts gespeichert.');}
 }
 function unitOptions(){
  const unit=$('#dictation-unit').value;
  const units=$('#dictation-technique').value==='refractometer'?[OE_DE,OE_JUICE,'°Brix']:[OE_DE,OE_JUICE,'°Brix','g/mL'];
  $('#dictation-unit').innerHTML=units.map(u=>`<option value="${esc(u)}">${esc(unitLabel(u))}</option>`).join('');
  if(units.includes(unit))$('#dictation-unit').value=unit;
 }
 $('#dictation-technique').onchange=unitOptions;
 $('#dictation-network').onchange=render;
 $('#dictation-start').onclick=()=>{
  if($('#dictation-start').disabled)return;
  round=createDictationRound({getState,commit,config:{vintage:$('#dictation-vintage').value,technique:$('#dictation-technique').value,unit:$('#dictation-unit').value}});
  active=true;suspended=false;keepAwake();announce('Messrunde gestartet. Tanknummer, Messwert mit Einheit und Temperatur nennen.');
 };
 $('#dictation-resume').onclick=()=>{if(!active)return;suspended=false;keepAwake();announce(round.handle('wiederholen').text);};
 $('#dictation-save').onclick=()=>receive('speichern');$('#dictation-correct').onclick=()=>receive('korrigieren');
 $('#dictation-pause').onclick=()=>receive(round.snapshot().paused?'weiter':'pause');
 $('#dictation-finish').onclick=()=>{if(!round)return;const result=round.handle('messrunde beenden');stop();announce(result.text,true);onFinish?.();};
 $('#dictation-close').onclick=()=>dialog.close();
 dialog.addEventListener('cancel',event=>{if(active){event.preventDefault();$('#dictation-finish').click();}});
 dialog.addEventListener('close',()=>{openToken++;stop();});
 document.addEventListener('visibilitychange',()=>{if(active&&document.hidden)interrupt('Die App war nicht mehr sichtbar.');});
 window.addEventListener('pagehide',()=>{if(active)interrupt('Die Messrunde wurde unterbrochen.');});
 $('#dictation-install').onclick=async()=>{
  const token=openToken;$('#dictation-install').disabled=true;
  try{const installed=await Recognition.install({langs:['de-DE'],processLocally:true});if(token!==openToken)return;localAvailable=installed;$('#dictation-capability').textContent=localAvailable?'Deutsch wird lokal auf diesem Gerät erkannt.':'Das Offline-Sprachpaket konnte nicht geladen werden.';}catch{if(token===openToken)$('#dictation-capability').textContent='Das Offline-Sprachpaket konnte nicht geladen werden.';}
  finally{if(token===openToken){$('#dictation-install').disabled=false;render();}}
 };
 document.addEventListener('click',async event=>{
  if(!event.target.closest('[data-dictation-round]'))return;
  if(dialog.open)return;
  const token=++openToken;round=null;localAvailable=false;
  const state=getState(),years=[...new Set(state.fermentations.map(b=>b.vintage).filter(Boolean))].sort().reverse();
  $('#dictation-vintage').innerHTML='<option value="">Alle Jahrgänge</option><option value="__none">Ohne Zuordnung</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join('');
  try{const year=localStorage.getItem('kellerwirtschaft.selectedVintage')||'';if([...$('#dictation-vintage').options].some(o=>o.value===year))$('#dictation-vintage').value=year;}catch{}
  $('#dictation-technique').value='density';unitOptions();$('#dictation-unit').value=state.preferences.mustUnit;
  $('#dictation-network').checked=false;$('#dictation-install').hidden=true;
  $('#dictation-wake').textContent='Während der Messrunde wird der Bildschirm automatisch wach gehalten, sofern das Gerät dies erlaubt.';
  status('Bereit. Jede Messung wird erst nach deinem gesprochenen „Speichern“ übernommen.');
  $('#dictation-capability').textContent=!window.isSecureContext?'Für Mikrofon und Bildschirm-Wachfunktion die App über eine vertrauenswürdige HTTPS-Adresse öffnen. Über diese HTTP-Vorschau kann die Messrunde nicht gestartet werden.':!Recognition?'Dieser Browser unterstützt keine fortlaufende Spracherkennung. Einen Browser mit Spracherkennung verwenden oder Messdaten von Hand erfassen.':!window.speechSynthesis?'Dieser Browser unterstützt keine Sprachausgabe.':'Lokale deutsche Spracherkennung wird geprüft …';
  $('#dictation-https').hidden=window.isSecureContext;render();dialog.showModal();
  if(!window.isSecureContext||!Recognition)return;
  if('processLocally' in Recognition.prototype&&typeof Recognition.available==='function'){
   try{
    const availability=await Recognition.available({langs:['de-DE'],processLocally:true});if(token!==openToken)return;
    localAvailable=availability==='available';$('#dictation-install').hidden=availability!=='downloadable'||typeof Recognition.install!=='function';
   }catch{if(token!==openToken)return;}
  }
  if(token!==openToken)return;
  $('#dictation-capability').textContent=localAvailable?'Deutsch wird lokal auf diesem Gerät erkannt.':'Lokale deutsche Spracherkennung ist hier nicht verfügbar. Bei Bedarf den Browserdienst oben ausdrücklich erlauben.';render();
 });
 return {dialog};
}
