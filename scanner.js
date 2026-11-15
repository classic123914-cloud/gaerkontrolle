import {ocrModel} from './ocr-languages.js';
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {candidatesFromText,matchingTank} from './scan-domain.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function imageForOCR(file,maxEdge=1800){
 if(!['image/jpeg','image/png','image/webp','image/bmp'].includes(file.type))throw Error('Bitte ein Foto als JPEG, PNG, WebP oder BMP wählen.');
 if(file.size>20*1024*1024)throw Error('Das Foto ist größer als 20 MB.');
 const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
 const factor=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*factor);canvas.height=Math.round(bitmap.height*factor);
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas;
}
export function setupScanner({getState,getSelectedTankId,onTankSelected,onNewNumber,onMemoPhoto,message}){
 let callback=null,photoURL=null,busy=false,mode='select',activeFile=null,worker=null,token=0,rawText='';
 function updateConfirm(){
  const number=$('#scan-number').value.trim(),tank=matchingTank(getState(),number);$('#scan-reread').disabled=busy||!activeFile;
  $('#scan-confirm').disabled=busy||(mode==='memo'?!activeFile:!number);
  if(mode==='select'){
   $('#scan-confirm').textContent=tank?'Tank öffnen':'Neuen Tank vorbereiten';
   $('#scan-next-step').textContent=!number?'Nach dem Lesen die Nummer prüfen. Ein vorhandener Tank wird geöffnet.':tank?`Tank ${tank.number} ist vorhanden. „Tank öffnen“ führt zu seinen Mengen und Messwerten.`:'Diese Nummer ist noch nicht angelegt. Im nächsten Schritt Bezeichnung und Tankvolumen ergänzen und mit „Tank anlegen“ speichern.';
  }else $('#scan-next-step').textContent='';
 }
 function open(nextMode,tankId){
  if(nextMode==='memo'&&!getState().tanks.some(t=>t.id===tankId)){message('Bitte zuerst einen Tank auswählen.',true);return false;}
  mode=nextMode;activeFile=null;rawText='';
  callback=mode==='memo'?async()=>onMemoPhoto({file:activeFile,text:$('#scan-text').value,rawText,tankId}):async()=>{
   const number=$('#scan-number').value.trim();
   if(mode==='field')$('#tank-form').elements.number.value=number;
   else{const tank=matchingTank(getState(),number);if(tank)onTankSelected(tank.id);else onNewNumber(number);}
  };
  $('#scan-title').textContent=mode==='memo'?'Merkzettel fotografieren':mode==='field'?'Tanknummer vom Schild übernehmen':'Tank über seine Nummer finden';
  $('#scan-eyebrow').textContent=mode==='memo'?'MERKZETTEL PER FOTO':'TANKNUMMER PER FOTO';
  $('#scan-photo').alt=mode==='memo'?'Aufgenommenes Foto des Merkzettels':'Aufgenommenes Foto der Tanknummer';
  $('#scan-number-label').hidden=mode==='memo';$('#scan-text-label').hidden=mode!=='memo';$('#scan-candidates').hidden=mode==='memo';
  $('#scan-confirm').textContent=mode==='memo'?'Foto und Text zur Prüfung übernehmen':'Tanknummer bestätigen';
  $('#scan-number').value='';$('#scan-text').value='';$('#scan-candidates').innerHTML='';
  $('#scan-status').textContent=mode==='memo'?'Merkzettel scharf fotografieren oder ein Foto hineinziehen. Originalfoto und Texterkennung bleiben lokal.':'Nur die aufgedruckte Tanknummer möglichst groß, gerade und scharf fotografieren. Erkennung lokal auf diesem Gerät.';
  $('#scan-photo').hidden=true;updateConfirm();$('#scan-dialog').showModal();return true;
 }
 async function recognize(file){
  if(busy)return;
  const job=++token;let localWorker;
  busy=true;activeFile=null;rawText='';$('#scan-photo').hidden=true;$('#scan-capture').disabled=true;$('#scan-number').value='';$('#scan-text').value='';$('#scan-candidates').innerHTML='';updateConfirm();
  try{
   const canvas=await imageForOCR(file);if(job!==token)return;
   activeFile=file;if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(file);$('#scan-photo').src=photoURL;$('#scan-photo').hidden=false;
   $('#scan-status').textContent=mode==='memo'?'Merkzettel wird auf diesem Gerät gelesen …':'Tanknummer wird auf diesem Gerät gelesen …';
   if(!window.Tesseract)throw Error('OCR-Modul ist nicht geladen. Bitte die App vollständig aktualisieren.');
   localWorker=await window.Tesseract.createWorker(ocrModel(getState().preferences.language),1,{workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,corePath:new URL('./vendor/ocr/core/',import.meta.url).href,langPath:new URL('./vendor/ocr/lang',import.meta.url).href,workerBlobURL:false,cacheMethod:'none'});
   if(job!==token)return;worker=localWorker;
   await localWorker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
   const {data}=await localWorker.recognize(canvas);if(job!==token)return;
   if(mode==='memo'){
    rawText=data.text.slice(0,20000);
    $('#scan-text').value=data.text.slice(0,20000);
    $('#scan-status').textContent='Erkannten Text prüfen. Foto und Text werden erst nach Übernahme und anschließendem Speichern des Merkzettels dauerhaft zugeordnet. Rebsorte, Jahrgang und weitere Felder bitte selbst zuordnen.';
   }else{
    const candidates=candidatesFromText(data.text);
    $('#scan-candidates').innerHTML=candidates.length?`<label>Erkannte Vorschläge<select><option value="">Bitte auswählen</option>${candidates.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label>`:'';
    if(candidates.length===1)$('#scan-number').value=candidates[0];
    $('#scan-status').textContent=candidates.length?'Erkennung prüfen und gegebenenfalls korrigieren. Erst „Tanknummer bestätigen“ übernimmt die Nummer.':'Keine eindeutige Tanknummer erkannt. Foto wiederholen oder Nummer manuell eingeben.';
   }
  }catch(error){if(job===token)$('#scan-status').textContent='Erkennung nicht möglich: '+error.message+(mode==='memo'?' Das Foto kann trotzdem übernommen und der Text manuell ergänzt werden.':' Bitte die Tanknummer manuell eingeben.');}
  finally{
   if(localWorker)await localWorker.terminate().catch(()=>{});
   if(job===token){worker=null;busy=false;$('#scan-capture').disabled=false;updateConfirm();}
  }
 }
 $('#scan-tank').onclick=()=>open('select');$('#scan-number-field').onclick=()=>open('field');
 $('#scan-close').onclick=()=>$('#scan-dialog').close();$('#scan-capture').onclick=()=>$('#scan-file').click();
 $('#scan-number').oninput=updateConfirm;$('#scan-reread').onclick=()=>{if(activeFile&&!busy)recognize(activeFile);};
 $('#scan-confirm').onclick=async()=>{if(busy||$('#scan-confirm').disabled)return;busy=true;updateConfirm();try{await callback();$('#scan-dialog').close();}catch(error){$('#scan-status').textContent=error.message;}finally{busy=false;updateConfirm();}};
 $('#scan-candidates').onchange=e=>{if(e.target.value){$('#scan-number').value=e.target.value;updateConfirm();}};
 $('#scan-dialog').addEventListener('close',()=>{token++;if(worker)worker.terminate().catch(()=>{});worker=null;busy=false;$('#scan-capture').disabled=false;if(photoURL){URL.revokeObjectURL(photoURL);photoURL=null;}$('#scan-photo').removeAttribute('src');$('#scan-file').value='';activeFile=null;});
 $('#scan-file').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)recognize(file);};
 return {openMemo:tankId=>open('memo',tankId),openFile:(target,file)=>{if(target==='scan'&&$('#scan-dialog').open){recognize(file);return;}if(open(target==='memo'?'memo':'select',getSelectedTankId()))recognize(file);}};
}
