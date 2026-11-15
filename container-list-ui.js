import {removeTableRules} from './table-ocr.js';
import {setupImageCrop} from './image-crop.js';
import {ocrModel} from './ocr-languages.js';
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {rowsFromListText,reviewedListRow,importContainerList} from './container-list.js';
import {imageForOCR} from './scanner.js';
import {preparePhoto,deletePhotos,getPhoto} from './photo-store.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields=[['listRow','Lfd. Nr.'],['number','Behälternummer'],['name','Bezeichnung'],['capacityOriginalInput','Fassungsvermögen L'],['location','Aufstellungsort']];
const normalize=s=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleUpperCase('de-DE');
export function setupContainerList({getState,onImport,message}){
 let rows=[],file=null,rawText='',photoURL=null,busy=false,saving=false,job=0,worker=null;
 const dialog=$('#container-list-dialog');
 const cropHost=document.createElement('section');cropHost.hidden=true;cropHost.className='image-crop';$('#container-list-photo').after(cropHost);
 const crop=setupImageCrop(cropHost);
 const readButton=document.createElement('button');readButton.id='container-list-read-crop';readButton.textContent='Ausschnitt lesen';readButton.hidden=true;cropHost.after(readButton);
 function cropControls(){readButton.hidden=!file;readButton.disabled=busy||!file;cropHost.inert=busy;}
 function controls(){for(const id of ['container-list-capture','container-list-reparse','container-list-add','container-list-text'])$('#'+id).disabled=busy;$('#container-list-close').disabled=saving;$('#container-list-reread').disabled=busy||!file;const count=rows.filter(r=>r.selected).length;$('#container-list-save').disabled=busy||!count;$('#container-list-save').textContent=count>1?`${count} Tanks anlegen`:'Tank anlegen';$('#container-list-save-help').textContent=busy?'Bitte warten …':count?`${count} Tank${count>1?'s':''} ausgewählt. Mit „Tank anlegen“ speichern.`:'Kreuze die Zeilen an, die du als Tanks anlegen möchtest.';$('#container-list-rows').inert=busy;}
 function review(){
  const known=new Set(getState().tanks.filter(t=>t.number).map(t=>normalize(t.number)));
  $('#container-list-rows').innerHTML=rows.length?`<table><caption>Jede Zeile mit dem Foto vergleichen. Nur angekreuzte Zeilen werden angelegt.</caption><thead><tr><th>Übernehmen</th>${fields.map(([,label])=>`<th>${label}</th>`).join('')}<th>Prüfung</th></tr></thead><tbody>${rows.map((row,i)=>{let warning='Angaben prüfen';try{reviewedListRow(row);if(known.has(normalize(row.number)))warning='Tank bereits vorhanden – nicht erneut anlegen';}catch(error){warning=error.message;}return `<tr data-row="${i}"><td><input type="checkbox" data-field="selected" aria-label="Zeile ${i+1} geprüft übernehmen" ${row.selected?'checked':''}></td>${fields.map(([key,label])=>`<td><input data-field="${key}" aria-label="${label}, Zeile ${i+1}" value="${esc(row[key])}" maxlength="${key==='location'?200:key==='name'?100:60}"></td>`).join('')}<td class="hint" data-row-status>${esc(warning)}</td></tr>`;}).join('')}</tbody></table>`:'<p>Keine Tabellenzeilen sicher erkannt. Text und Foto vergleichen oder eine Zeile manuell ergänzen.</p>';
  $('#container-list-count').textContent=rows.length+' Vorschläge · '+rows.filter(r=>r.selected).length+' zur Übernahme ausgewählt';controls();
 }
 function open(){if(dialog.open)return;rows=[];file=null;rawText='';$('#container-list-text').value='';$('#container-list-photo').hidden=true;$('#container-list-status').textContent='Behälterliste möglichst gerade und scharf fotografieren. Lfd. Nr., Behälternummer, Bezeichnung, Fassungsvermögen und Aufstellungsort müssen sichtbar sein.';review();dialog.showModal();}
 async function selectPhoto(nextFile){
  if(busy)return;const token=++job;busy=true;controls();cropControls();
  try{const canvas=await imageForOCR(nextFile,3000);if(token!==job)return;file=nextFile;rawText='';rows=[];$('#container-list-text').value='';crop.load(canvas);$('#container-list-photo').hidden=true;$('#container-list-status').textContent='Tabelle im Foto auswählen, dann „Ausschnitt lesen“ wählen. Das Originalfoto bleibt unverändert.';}
  catch(error){if(token===job)$('#container-list-status').textContent='Foto nicht geöffnet: '+error.message;}
  finally{if(token===job){busy=false;review();cropControls();}}
 }
 async function recognize(nextFile){
  if(busy)return;const token=++job;busy=true;file=null;rawText='';rows=[];$('#container-list-text').value='';review();let localWorker;
  try{
   file=nextFile;cropControls();const canvas=crop.canvas(removeTableRules);if(token!==job)return;
   $('#container-list-status').textContent='Behälterliste wird lokal gelesen …';
   if(!window.Tesseract)throw Error('OCR-Modul ist nicht geladen.');
   localWorker=await window.Tesseract.createWorker(ocrModel(getState().preferences.language),1,{workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,corePath:new URL('./vendor/ocr/core/',import.meta.url).href,langPath:new URL('./vendor/ocr/lang',import.meta.url).href,workerBlobURL:false,cacheMethod:'none'});
   if(token!==job)return;worker=localWorker;
   await localWorker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
   const {data}=await localWorker.recognize(canvas);if(token!==job)return;
   rawText=data.text.slice(0,20000);$('#container-list-text').value=rawText;rows=rowsFromListText(rawText);
   $('#container-list-status').textContent='OCR liefert Vorschläge. Lfd. Nr. und Behälternummer getrennt prüfen, Fehler korrigieren und gewünschte Zeilen ankreuzen. Nicht erkannte Zeilen aus dem Foto manuell ergänzen.';
  }catch(error){if(token===job)$('#container-list-status').textContent='Erkennung nicht möglich: '+error.message+(file?' Zeilen können anhand des Fotos manuell ergänzt werden.':' Bitte ein gültiges Foto auswählen.');}
  finally{if(localWorker)await localWorker.terminate().catch(()=>{});if(token===job){worker=null;busy=false;review();cropControls();}}
 }
 $('#scan-container-list').onclick=open;
 $('#container-list-close').onclick=()=>dialog.close();$('#container-list-capture').onclick=()=>$('#container-list-file').click();
 $('#container-list-file').onchange=e=>{const next=e.target.files[0];e.target.value='';if(next)selectPhoto(next);};
 readButton.onclick=()=>{if(file&&!busy)recognize(file);};
 $('#container-list-reread').onclick=()=>{if(file&&!busy)recognize(file);};
 $('#container-list-reparse').onclick=()=>{rows=rowsFromListText($('#container-list-text').value);review();};
 $('#container-list-add').onclick=()=>{if(rows.length>=200){$('#container-list-status').textContent='Höchstens 200 Zeilen je Scan.';return;}rows.push({selected:false,listRow:'',number:'',name:'',capacityOriginalInput:'',location:'',rawLine:''});review();};
 $('#container-list-rows').oninput=e=>{
  const index=e.target.closest('[data-row]')?.dataset.row,key=e.target.dataset.field;if(index===undefined||!key)return;
  rows[Number(index)][key]=key==='selected'?e.target.checked:e.target.value;
  const row=rows[Number(index)];let status='Angaben prüfen';try{reviewedListRow(row);if(getState().tanks.some(t=>normalize(t.number)===normalize(row.number)))status='Tank bereits vorhanden – nicht erneut anlegen';}catch(error){status=error.message;}
  e.target.closest('tr').querySelector('[data-row-status]').textContent=status;
  $('#container-list-count').textContent=rows.length+' Vorschläge · '+rows.filter(r=>r.selected).length+' zur Übernahme ausgewählt';controls();
 };
 $('#container-list-save').onclick=async()=>{
  if(busy)return;busy=true;saving=true;controls();let photo;
  try{
   // Validate all selected rows before writing the original image to IndexedDB.
   const createdAt=new Date().toISOString(),id=crypto.randomUUID();
   importContainerList(getState(),rows,{photo:{id:'preview'},id,createdAt,makeId:()=>crypto.randomUUID()});
   photo=file&&$('#container-list-keep').checked?await preparePhoto(file,rawText):null;
   const next=importContainerList(getState(),rows,{photo,id,createdAt,makeId:()=>crypto.randomUUID()});
   onImport(next);const hadPhoto=Boolean(photo);photo=null;dialog.close();message(hadPhoto?'Tanks angelegt. Foto und erkannte Angaben sind lokal gespeichert.':'Tanks angelegt. Die eingegebenen Angaben sind lokal gespeichert.');
  }catch(error){if(photo)await deletePhotos([photo.id]).catch(()=>{});$('#container-list-status').textContent='Nicht übernommen: '+error.message;}
  finally{busy=false;saving=false;controls();}
 };
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 dialog.addEventListener('close',()=>{job++;if(worker)worker.terminate().catch(()=>{});worker=null;busy=false;if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;file=null;rows=[];rawText='';$('#container-list-keep').checked=false;$('#container-list-text').value='';$('#container-list-photo').removeAttribute('src');});
 // Saving is a short atomic step; closing during OCR is safe and cancels that job.
 dialog.addEventListener('close',()=>{crop.clear();cropControls();});
 return {openFile:nextFile=>{open();selectPhoto(nextFile);}};
}
export function setupContainerSourceViewer({getState,message,onTankSelected}){
 let url=null;const dialog=$('#container-source-dialog');
 const overview=$('#container-library-dialog');
 $('#view-container-lists').onclick=()=>{
  const state=getState();
  $('#container-library-entries').innerHTML=state.sources.length?state.sources.slice().reverse().map((source,i)=>`<section class="saved-list"><h3>Behälterliste vom ${esc(new Date(source.createdAt).toLocaleDateString('de-DE'))}</h3><p class="hint">${source.photoId?'Mit Originalfoto':'Von Hand eingegeben'} · ${source.rows.length} übernommene Tanks</p><button class="secondary compact" data-view-container-source="${esc(source.id)}">${source.photoId?'Liste und Originalfoto ansehen':'Gespeicherte Liste ansehen'}</button><ul>${source.rows.map(row=>{const tank=state.tanks.find(t=>t.id===row.tankId);return `<li>${tank?`<button class="secondary compact" data-library-tank="${esc(tank.id)}">Tank ${esc(tank.number)} öffnen</button>`:`<span>Tank ${esc(row.reviewed.number)} · inzwischen gelöscht</span>`} <span translate="no">${esc(row.reviewed.name)}</span> · ${esc(row.reviewed.capacityOriginalInput)} L</li>`;}).join('')}</ul></section>`).join(''):'<p>Noch keine Behälterliste übernommen.</p><p>Wähle „Behälterliste übernehmen“, fotografiere die Liste und prüfe die erkannten Zeilen. Nach „Tank anlegen“ findest du die Liste hier und die Tanks unter „Deine Tanks“.</p>';
  overview.showModal();
 };
 $('#container-library-close').onclick=()=>overview.close();
 $('#container-library-entries').onclick=e=>{const button=e.target.closest('[data-library-tank]');if(button){overview.close();onTankSelected(button.dataset.libraryTank);}};
 document.addEventListener('click',async e=>{const button=e.target.closest('[data-view-container-source]');if(!button)return;
  const source=getState().sources.find(s=>s.id===button.dataset.viewContainerSource);if(!source)return;
  dialog.querySelector('h2').textContent=source.photoId?'Original der Behälterliste':'Manuell eingegebene Behälterliste';
  dialog.querySelector('summary').textContent=source.photoId?'Unverändertes OCR-Ergebnis':'Bei der Anlage gespeicherte Angaben';
  $('#container-source-reviewed').innerHTML=`<h3>Geprüfte Angaben bei der Übernahme</h3><div class="table-scroll"><table><thead><tr>${fields.map(([,label])=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${source.rows.map(row=>`<tr>${fields.map(([key])=>`<td translate="no">${esc(row.reviewed[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#container-source-text').textContent=source.photoId?getState().photos.find(p=>p.id===source.photoId)?.ocrText??'':source.rows.map(r=>[r.reviewed.listRow,r.reviewed.number,r.reviewed.name,r.reviewed.capacityOriginalInput+' L',r.reviewed.location].join(' · ')).join('\n');
  $('#container-source-image').hidden=true;dialog.showModal();
  if(source.photoId)try{const blob=await getPhoto(source.photoId);if(!blob)throw Error('Originalfoto fehlt im lokalen Fotospeicher.');if(!dialog.open)return;url=URL.createObjectURL(blob);$('#container-source-image').src=url;$('#container-source-image').hidden=false;}catch(error){message(error.message,true);}
 });
 $('#container-source-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(url)URL.revokeObjectURL(url);url=null;$('#container-source-image').removeAttribute('src');});
}
