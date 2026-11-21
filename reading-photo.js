import {setupImageCrop} from './image-crop.js';
// SPDX-License-Identifier: GPL-3.0-only
import {imageForOCR} from './scanner.js';
import {ocrModel} from './ocr-languages.js';
import {preparePhoto,deletePhotos,getPhoto} from './photo-store.js';
import {html as esc} from './fermentation-chart.js';
import {numberInput} from './domain-v1.js';
// Only numbers with an adjacent unit are suggestions. Scale graduations are never a reading.
export function readingCandidates(text){
 const result=[];const re=/([+−-]?(?:\d+[.,]?\d*|[.,]\d+))[^\S\r\n]*(°\s*(?:Oe|Öchsle|Oechsle|Bx|Brix|C)|g\s*\/\s*(?:mL|cm[³3®])|nD)(?=$|[^\p{L}\p{N}])/giu;
 for(const m of text.normalize('NFC').matchAll(re)){
  const originalInput=m[1].replace('−','-'),u=m[2].replace(/\s/g,''),unit=/Oe|Öchsle|Oechsle/i.test(u)?'°Oe':/Bx|Brix/i.test(u)?'°Brix':/°C/i.test(u)?'°C':/nD/i.test(u)?'nD':'g/mL';
  const candidate={originalInput,unit};
  if(u.endsWith('®'))candidate.unitNeedsCheck=m[2];
  const duplicate=result.findIndex(x=>x.originalInput===originalInput&&x.unit===unit);
  if(duplicate===-1)result.push(candidate);
  else if(!candidate.unitNeedsCheck)result[duplicate]=candidate;
 }return result;
}

function displayContext(text,tankNumber,formTime){
 const tanks=[...new Set(Array.from(text.matchAll(/\bTank(?:[ \t]*:[ \t]*|[ \t]+)([\p{L}\p{N}][\p{L}\p{N}._/-]*)/giu),m=>m[1]))];
 const times=[...new Set(Array.from(text.matchAll(/(?<![\d:])(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?![\d:])/g),m=>m[0]))];
 const tank=tanks.length===1?tanks[0]:'',time=times.length===1?times[0]:'';
 const check=[];
 if(tank&&tank.toLowerCase()!==tankNumber.toLowerCase())check.push('Tanknummer');
 if(time&&time.slice(0,formTime.length||5)!==formTime)check.push('Messzeit');
 return {seen:[tank&&'Tank '+tank,time&&time+' Uhr'].filter(Boolean).join(' · '),check:check.join(' und ')};
}

export function setupReadingPhoto({getState,getWineId,message}){
 const drafts=new Map();let file=null,raw='',busy=false,worker=null,job=0,wineId=null,tankNumber='',formTime='';
 const dialog=document.createElement('dialog');dialog.id='reading-photo-dialog';dialog.innerHTML=`
  <h2>Messgerät fotografieren</h2>
  <div class="reading-photo-context"><p id="reading-photo-target" translate="no"></p><p id="reading-photo-display" role="status" hidden></p></div>
  <p>Display gerade, scharf und ohne Spiegelung fotografieren. Analoge Skalen durch das Okular aufnehmen und selbst ablesen.</p>
  <label>Gerät<select id="reading-device"><option value="density">DMA 35 / Dichtemessgerät</option><option value="digital">Digitales Refraktometer</option><option value="optical">Analoges Refraktometer (Okular)</option></select></label>
  <button id="reading-capture"><span class="scan-action-icon" aria-hidden="true"></span>Foto aufnehmen / auswählen</button>
  <input id="reading-file" type="file" accept="image/jpeg,image/png,image/webp,image/bmp" capture="environment" hidden>
  <p id="reading-photo-status" role="status"></p><div id="reading-suggestions"></div>
  <details><summary>Erkannter Originaltext</summary><pre id="reading-ocr" translate="no"></pre></details>
  <label class="inline-check"><input type="checkbox" id="reading-keep"> Originalfoto behalten (optional)</label>
  <div class="actions"><button class="secondary" id="reading-photo-cancel">Abbrechen</button><button id="reading-photo-accept" disabled>Zum Messformular übernehmen</button></div>`;document.body.append(dialog);
 const $=s=>dialog.querySelector(s);
 const cropHost=document.createElement('section');cropHost.className='image-crop';cropHost.hidden=true;$('#reading-file').after(cropHost);const crop=setupImageCrop(cropHost);
 const readCrop=document.createElement('button');readCrop.id='reading-read-crop';readCrop.textContent='Display-Ausschnitt lesen';readCrop.hidden=true;cropHost.after(readCrop);
 let candidates=[],contextHint='';
 function clearRecognition(){
  raw='';candidates=[];contextHint='';
  $('#reading-suggestions').replaceChildren();
  $('#reading-ocr').textContent='';
  $('#reading-photo-display').hidden=true;
  $('#reading-photo-display').textContent='';
 }
 async function selectPhoto(f){if(busy)return;busy=true;const token=++job;$('#reading-capture').disabled=true;$('#reading-photo-accept').disabled=true;readCrop.disabled=true;$('#reading-device').disabled=true;file=null;crop.clear();clearRecognition();try{const canvas=await imageForOCR(f,3000);if(token!==job)return;file=f;crop.load(canvas);readCrop.hidden=$('#reading-device').value==='optical';$('#reading-photo-status').textContent=readCrop.hidden?'Hell-Dunkel-Grenze selbst ablesen und Wert im Formular eintragen.':'Rahmen um Display und Einheit ziehen, dann den Ausschnitt lesen.';}catch(error){if(token===job){crop.clear();readCrop.hidden=true;$('#reading-photo-status').textContent=error.message;}}finally{if(token===job){busy=false;$('#reading-device').disabled=false;$('#reading-capture').disabled=false;readCrop.disabled=false;$('#reading-photo-accept').disabled=!file;}}}
 readCrop.onclick=()=>{if(file&&!busy)read(file);};
 async function read(f){if(busy)return;const token=++job;let localWorker;busy=true;$('#reading-photo-accept').disabled=true;$('#reading-capture').disabled=true;
  clearRecognition();
  try{readCrop.disabled=true;$('#reading-device').disabled=true;cropHost.inert=true;file=f;
   if($('#reading-device').value==='optical'){$('#reading-photo-status').textContent='Hell-Dunkel-Grenze selbst ablesen und Wert im Formular eintragen.';return;}
   const canvas=crop.canvas();
   $('#reading-photo-status').textContent='Display wird lokal gelesen …';if(!window.Tesseract)throw Error('OCR-Modul nicht verfügbar.');
   localWorker=await window.Tesseract.createWorker(ocrModel(getState().preferences.language),1,{workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,corePath:new URL('./vendor/ocr/core/',import.meta.url).href,langPath:new URL('./vendor/ocr/lang',import.meta.url).href,workerBlobURL:false,cacheMethod:'none'});
   if(token!==job)return;worker=localWorker;await localWorker.setParameters({tessedit_pageseg_mode:'6'});const {data}=await localWorker.recognize(canvas);if(token!==job)return;
   raw=data.text.slice(0,20000);$('#reading-ocr').textContent=raw;candidates=readingCandidates(raw);
   const context=displayContext(raw,tankNumber,formTime);
   if(context.seen){
    contextHint=`Auf dem Foto erkannt: ${context.seen}.${context.check?' '+context.check+' vor dem Speichern prüfen.':''}`;
    $('#reading-photo-display').textContent=contextHint;
    $('#reading-photo-display').hidden=false;
   }
   const notes=new Set();
   const options=candidates.map((c,i)=>{
    const decimalOechsle=c.unit==='°Oe'&&!Number.isInteger(numberInput(c.originalInput));
    if(decimalOechsle)notes.add('Nur ganze °Oe können übernommen werden. Dezimalwerte werden nicht gerundet.');
    if(c.unitNeedsCheck)notes.add(`Dichte-Einheit undeutlich (${c.unitNeedsCheck}). Den Vorschlag nur wählen, wenn am Display g/cm³ steht.`);
    return `<option value="${i}" ${decimalOechsle?'disabled':''}>${esc(c.originalInput)} ${esc(c.unit)}${c.unitNeedsCheck?' · Einheit prüfen':''}</option>`;
   }).join('');
   const temperatures=candidates.map((c,i)=>c.unit==='°C'?`<option value="${i}">${esc(c.originalInput)} °C</option>`:'').join('');
   $('#reading-suggestions').innerHTML=candidates.length?`
    ${[...notes].map(note=>`<p class="hint">${esc(note)}</p>`).join('')}
    <label>Messwert auf dem Foto prüfen<select id="reading-candidate"><option value="">Wert von Hand eingeben</option>${options}</select></label>
    ${temperatures?`<label>Temperatur hinzufügen<select id="reading-temperature-candidate"><option value="">Keine Temperatur übernehmen</option>${temperatures}</select></label>`:''}`:'';
   $('#reading-photo-status').textContent=candidates.length?'Passenden Wert mit Einheit auswählen.':'Kein Wert mit lesbarer Einheit. Display erneut lesen oder Wert von Hand eingeben.';
  }catch(error){if(token===job)$('#reading-photo-status').textContent='Erkennung nicht möglich: '+error.message+' Foto prüfen und Wert selbst eintragen.';}
  finally{if(localWorker){await localWorker.terminate().catch(()=>{});if(worker===localWorker)worker=null;}if(token===job){busy=false;$('#reading-capture').disabled=false;readCrop.disabled=false;cropHost.inert=false;$('#reading-photo-accept').disabled=!file;}}
 }
 $('#reading-capture').onclick=()=>$('#reading-file').click();$('#reading-file').onchange=()=>{const f=$('#reading-file').files[0];$('#reading-file').value='';if(f)selectPhoto(f);};
 $('#reading-device').onchange=()=>{if(file&&!busy){readCrop.hidden=$('#reading-device').value==='optical';read(file);}};$('#reading-photo-cancel').onclick=()=>dialog.close();
 $('#reading-photo-accept').onclick=async()=>{if(!file||busy)return;busy=true;$('#reading-photo-accept').disabled=true;let photo;const token=job;
  try{const form=document.querySelector('#measurement-form');if(!form||wineId!==getWineId())throw Error('Gärung gewechselt. Foto bitte neu zuordnen.');
   const choice=$('#reading-candidate')?.selectedOptions[0],c=choice?.value&&!choice.disabled?candidates[Number(choice.value)]:null;
   photo=$('#reading-keep').checked?await preparePhoto(file,raw):null;if(token!==job)throw Error('Fotoübernahme abgebrochen.');const previous=drafts.get(wineId);
   drafts.set(wineId,{photo,device:$('#reading-device').value,recognized:c?{originalInput:c.originalInput,unit:c.unit}:null,contextHint});if(previous?.photo)deletePhotos([previous.photo.id]).catch(()=>{});
   if(c){form.elements.parameter.value=c.unit==='°C'?'Temperatur':c.unit==='g/mL'?'Dichte':c.unit==='nD'?'Lichtbrechung':'Mostgewicht';form.elements.parameter.onchange();form.elements.value.value=c.originalInput;
    if(c.unit==='°Oe'){// Never infer the instrument's scale from OCR.
     if(!form.elements.unit.value.startsWith('°Oe'))form.elements.unit.value='°Oe';
    }else form.elements.unit.value=c.unit;
    form.elements.technique.value=c.unit==='°C'?'other':$('#reading-device').value==='density'?'density':'refractometer';
   }
   const tempChoice=$('#reading-temperature-candidate')?.value;
   if(c?.unit!=='°C'&&tempChoice)form.elements.temperature.value=candidates[Number(tempChoice)].originalInput;
   form.dispatchEvent(new Event('input'));
   showDraft();dialog.close();message('Wert, Einheit und Messzeit prüfen und speichern.');
  }catch(error){if(photo&&drafts.get(wineId)?.photo?.id!==photo.id)deletePhotos([photo.id]).catch(()=>{});$('#reading-photo-status').textContent=error.message;}
  finally{busy=false;$('#reading-photo-accept').disabled=!file;}
 };
 dialog.onclose=()=>{$('#reading-device').disabled=false;crop.clear();readCrop.hidden=true;cropHost.inert=false;clearRecognition();job++;if(worker)worker.terminate().catch(()=>{});file=null;busy=false;};
 const viewer=document.createElement('dialog');viewer.innerHTML='<h2>Originalfoto der Messung</h2><img alt="Gespeichertes Gerätefoto"><pre translate="no"></pre><button>Schließen</button>';viewer.className='reading-photo-view';document.body.append(viewer);let viewURL;viewer.querySelector('button').onclick=()=>viewer.close();viewer.onclose=()=>{if(viewURL)URL.revokeObjectURL(viewURL);};
 document.addEventListener('click',async event=>{const b=event.target.closest('[data-reading-photo]');if(!b)return;try{const photo=getState().photos.find(p=>p.id===b.dataset.readingPhoto),blob=await getPhoto(photo.id);if(!blob)throw Error('Originalfoto fehlt.');viewURL=URL.createObjectURL(blob);viewer.querySelector('img').src=viewURL;viewer.querySelector('pre').textContent=photo.ocrText;viewer.showModal();}catch(error){message(error.message,true);}});
 function showDraft(){
  const status=document.querySelector('#reading-photo-draft'),draft=drafts.get(getWineId());
  if(status&&draft)status.textContent=[draft.contextHint,draft.photo?'Originalfoto wird mitgespeichert.':'Das Foto wird verworfen.'].filter(Boolean).join(' ');
 }
 return {
  attach(){
   const button=document.querySelector('#reading-photo');
   if(button)button.onclick=()=>{
    wineId=getWineId();if(!wineId)return;
    const state=getState(),wine=state.fermentations.find(b=>b.id===wineId);
    tankNumber=state.tanks.find(t=>t.id===wine?.tankId)?.number||'';
    formTime=document.querySelector('#measurement-form [name=time]').value;
    const target=[tankNumber&&'Tank '+tankNumber,wine?.number,wine?.name,formTime?formTime+' Uhr im Formular':'Messzeit offen'].filter(Boolean);
    $('#reading-photo-target').textContent=target.join(' · ');
    $('#reading-keep').checked=false;
    $('#reading-photo-status').textContent='';
    $('#reading-photo-accept').disabled=true;
    $('#reading-capture').disabled=false;
    dialog.showModal();
   };
   showDraft();
  },
  stage(next,id){const d=drafts.get(getWineId());return d?.photo?{...next,photos:[...next.photos,d.photo],measurements:next.measurements.map(m=>m.id===id?{...m,photoId:d.photo.id,photoDevice:d.device,recognizedInput:d.recognized}:m)}:next;},
  saved(){drafts.delete(getWineId());}
 };
}
