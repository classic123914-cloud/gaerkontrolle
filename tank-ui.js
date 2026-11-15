// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {deletePhotos} from './photo-store.js';
import {numberInput,currentVolume,volumeHistory,currentMemo,memoHistory} from './domain.js';
const $=s=>document.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(v);
export function localToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function tankSectionsHTML(state,tank,draft){
 const amount=currentVolume(state,tank.id),memo=currentMemo(state,tank.id);
 const history=volumeHistory(state,tank.id).reverse();
 const memoFields=[['wineNumber','Weinnummer'],['variety','Rebsorte'],['vintage','Jahrgang'],['site','Lage'],['qualityLevel','Qualitätsstufe']];
 return `<section class="card"><div class="detail-top"><div><p class="eyebrow">TANKNUMMER</p><h2><span translate="no">${esc(tank.number||'Noch zuzuordnen')}</span></h2><p><strong>Bezeichnung:</strong> <span translate="no">${esc(tank.name)}</span></p>${tank.listRow?`<p class="hint">Lfd. Nr. der Liste: ${esc(tank.listRow)}</p>`:''}${tank.location?`<p><strong>Aufstellungsort:</strong> <span translate="no">${esc(tank.location)}</span></p>`:''}${tank.listSourceId?`<button class="secondary compact" data-view-container-source="${esc(tank.listSourceId)}">Behälterlisten-Eintrag ansehen</button>`:''}</div><div class="actions"><button id="edit-tank" class="secondary compact">Stammdaten bearbeiten</button><button id="delete-tank" class="secondary compact danger">Tank löschen</button></div></div>${tank.needsNumberReview?'<p class="warning">Bisherige gemeinsame Angabe als Bezeichnung erhalten. Bitte die Tanknummer separat ergänzen und die Bezeichnung prüfen.</p>':''}<dl class="tank-facts"><div><dt>Tankvolumen</dt><dd>${tank.capacityL===null?'Nicht erfasst':fmt(tank.capacityL)+' L'}</dd></div><div><dt>Menge im Tank</dt><dd>${amount?fmt(amount.value)+' L':'Nicht erfasst'}</dd>${amount?`<small>Stand ${esc(amount.date.split('-').reverse().join('.'))} ${esc(amount.time)}</small>`:''}</div></dl></section>
 <section class="card"><p class="eyebrow">MENGE IM TANK</p><h2>Mengenwert erfassen</h2><p class="hint">Jeder Stand bleibt als datierter Wert erhalten. Das Tankvolumen wird dadurch nicht verändert.</p><form id="volume-form"><div class="form-grid"><label>Datum<input type="date" name="date" required value="${localToday()}"></label><label>Uhrzeit (optional)<input type="time" name="time"></label><label>Menge in Litern<input name="value" inputmode="decimal" required placeholder="z. B. 1800"></label></div><button>Mengenwert speichern</button></form><details class="history"><summary>Mengenverlauf (${history.length})</summary>${history.length?`<div class="table-scroll"><table><thead><tr><th>Datum / Zeit</th><th>Originalwert</th><th>Tankvolumen bei Erfassung</th></tr></thead><tbody>${history.map(r=>`<tr><td>${esc(r.date)} ${esc(r.time)}</td><td>${esc(r.originalInput)} L</td><td>${r.capacitySnapshotL===null?'—':fmt(r.capacitySnapshotL)+' L'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">Noch keine Mengenwerte erfasst.</p>'}</details></section>
 <section class="card" id="memo-section"><p class="eyebrow">MERKZETTEL ZUM INHALT</p><h2>Welcher Wein liegt hier?</h2><p class="hint">Kennzeichnung des Inhalts, getrennt von Tanknummer und Bezeichnung des Behälters. Eine Änderung wird als neuer Stand gespeichert.</p><div class="actions"><button type="button" class="secondary" id="memo-camera"><span class="scan-action-icon" aria-hidden="true"></span>Merkzettel fotografieren</button><button type="button" class="secondary" id="memo-current-view" ${memo?'':'disabled'}>Gespeicherten Merkzettel anzeigen</button></div><div class="drop-zone" data-drop-target="memo">Merkzettelfoto hier hineinziehen. Gespeicherten Merkzettel aus der Tankliste hierher ziehen, um ihn anzuzeigen.</div><form id="memo-form"><div class="form-grid"><label>Gültig ab<input type="date" name="date" value="${localToday()}" required></label>${memoFields.map(([key,label])=>`<label>${label}<input name="${key}" maxlength="200" value="${esc(memo?.[key]??'')}" ${key==='vintage'?'placeholder="z. B. 26 oder 2026"':''}></label>`).join('')}<label class="wide">Kurzbezeichnung / ergänzende Angaben<textarea name="description" rows="2" maxlength="2000">${esc(draft?.text?.slice(0,2000)??memo?.description??'')}</textarea></label></div>${memo?.origin==='legacy-note'?'<p class="hint">Die frühere Notiz wurde unverändert übernommen. Eine fachliche Zuordnung zu den einzelnen Feldern ist noch offen.</p>':''}<p class="hint" id="memo-photo-status">${draft?.photo?'Neues Foto zur Zuordnung: '+esc(draft.photo.name)+' · noch nicht als Merkzettel gespeichert':memo?.photoId?'Gespeichertes Originalfoto ist diesem Stand zugeordnet.':'Kein Foto zugeordnet.'}</p><button type="button" id="memo-remove-photo" class="secondary compact">Nächsten Stand ohne Foto erfassen</button><label><input type="checkbox" name="keepPhoto" ${!draft?.photo&&memo?.photoId?'checked':''}> Originalfoto behalten (optional)</label><button class="secondary">Merkzettel speichern</button></form><details class="history"><summary>Merkzettel-Verlauf (${memoHistory(state,tank.id).length})</summary><ul>${memoHistory(state,tank.id).reverse().map(m=>`<li draggable="true" data-drag-memo="${esc(m.id)}"><button type="button" class="secondary compact" data-show-memo="${esc(m.id)}">Anzeigen</button> ${m.dateUnknown?'Datum unbekannt (Altbestand)':esc(m.date)}: <span translate="no">${esc([m.wineNumber,m.variety,m.vintage,m.site,m.qualityLevel,m.description].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul></details></section>`;
}
export function attachTankSections(tank,{getState,commit,render,message,run,getDraft,clearDraft,onScanMemo,onShowMemo,onRemoveDraft}){
 $('#volume-form').onsubmit=e=>{e.preventDefault();run(()=>{
  const f=new FormData(e.target),state=getState();
  const value={id:crypto.randomUUID(),tankId:tank.id,date:f.get('date'),time:f.get('time'),value:numberInput(f.get('value')),originalInput:f.get('value'),unit:'L',capacitySnapshotL:tank.capacityL,createdAt:new Date().toISOString()};
  commit({...state,volumeReadings:[...state.volumeReadings,value]});render();message('Mengenwert gespeichert. Frühere Stände bleiben im Verlauf erhalten.');
 });};
 $('#memo-form').onsubmit=e=>{e.preventDefault();run(()=>{
  const f=new FormData(e.target),state=getState();
  const draft=getDraft(tank.id),previous=currentMemo(state,tank.id);
  const keepPhoto=f.get('keepPhoto')==='on';
  const photoId=draft?.removePhoto||!keepPhoto?null:draft?.photo?.id??previous?.photoId??null;
  const memo={id:crypto.randomUUID(),tankId:tank.id,date:f.get('date'),time:'',createdAt:new Date().toISOString(),origin:'manual',photoId};
  for(const key of ['wineNumber','variety','vintage','site','qualityLevel','description'])memo[key]=f.get(key);
  if(!photoId&&!['wineNumber','variety','vintage','site','qualityLevel','description'].some(key=>memo[key].trim()))throw Error('Bitte ein Foto oder mindestens eine Angabe zum Inhalt erfassen.');
  const photos=draft?.photo&&photoId===draft.photo.id?[...state.photos,draft.photo]:state.photos;
  commit({...state,memos:[...state.memos,memo],photos});if(draft?.photo&&photoId!==draft.photo.id)deletePhotos([draft.photo.id]).catch(error=>message(error.message,true));clearDraft(tank.id);render();message(photoId?'Merkzettel als neuer Stand mit Originalfoto gespeichert.':'Merkzettel als neuer Stand gespeichert.');
 });};
 $('#memo-camera').onclick=()=>onScanMemo(tank.id);
 $('#memo-remove-photo').onclick=()=>onRemoveDraft(tank.id);
 $('#memo-current-view').onclick=()=>{const memo=currentMemo(getState(),tank.id);if(memo)onShowMemo(memo.id);};
}
export function openTankDialog(tank,{getState,commit,onSaved}){
 const f=$('#tank-form');f.reset();
 f.elements.id.value=tank?.id??'';f.elements.number.value=tank?.number??'';f.elements.name.value=tank?.name??'';f.elements.capacity.value=tank?.capacityL??'';f.elements.initialDate.value=localToday();f.elements.listRow.value=tank?.listRow??'';f.elements.location.value=tank?.location??'';
 $('#initial-volume-fields').hidden=Boolean(tank);$('#tank-error').textContent='';$('#tank-form-title').textContent=tank?'Tankstammdaten':'Neuen Tank anlegen';$('#tank-submit').textContent=tank?'Änderungen speichern':'Tank anlegen';
 f.onsubmit=e=>{e.preventDefault();try{
  const f=new FormData(e.target),state=getState();const id=tank?.id??crypto.randomUUID();
  const nextTank={...tank,id,number:f.get('number').trim(),name:f.get('name').trim(),capacityL:numberInput(f.get('capacity')),listRow:f.get('listRow').trim(),location:f.get('location').trim(),needsNumberReview:false,updatedAt:new Date().toISOString()};
  const next={...state,tanks:tank?state.tanks.map(t=>t.id===id?nextTank:t):[...state.tanks,nextTank]};
  if(!tank&&f.get('initialVolume').trim())next.volumeReadings=[...state.volumeReadings,{id:crypto.randomUUID(),tankId:id,date:f.get('initialDate'),time:'',createdAt:new Date().toISOString(),value:numberInput(f.get('initialVolume')),originalInput:f.get('initialVolume'),unit:'L',capacitySnapshotL:nextTank.capacityL}];
  commit(next);$('#tank-dialog').close();onSaved(id,Boolean(tank));
 }catch(error){$('#tank-error').textContent=error.message;}};
 $('#tank-dialog').showModal();f.elements.number.focus();
}
