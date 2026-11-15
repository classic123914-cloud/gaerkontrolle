import {setupDictationRound} from './dictation-round-ui.js';
import {setupSpeechReading} from './speech-reading-ui.js';
import {setupMeasurementEditor} from './measurement-edit-ui.js';
import {localStamp,makeReading,measurementsCSV} from './measurement-entry.js';
import {setupPDFReading} from './pdf-reading.js';
import {setupReadingPhoto} from './reading-photo.js';
import {withFermentations,wineReadings} from './fermentations.js';
import {setupCockpit} from './cockpit-ui.js';
import {fermentationChart} from './fermentation-chart.js';
import {showWorkspace,tankPage} from './workspace.js';
import {initialForecast,appendInitialReading,appendSugarInitialReading,sugarInitialReadings} from './initial-reading.js';
import {setupLanguages,applyLanguage} from './i18n.js';
import {TECHNIQUES,WINE_TYPES,deleteMeasurement} from './measurement-tracks.js';
import {sugarFields,withSugarFields,sugarCells,methodCell,setupMeasurementDialogs} from './measurement-tracks-ui.js';
import {trackChartHTML,sugarChartHTML} from './track-chart.js';
import {setupContainerList,setupContainerSourceViewer} from './container-list-ui.js';
import {OE_DE,OE_JUICE,MUST_UNITS,unitLabel,densityEntryUnits,resolveMostWeight,isOechsle,formatUnitValue} from './units.js';
import {refractionSectionHTML,attachRefractionSection} from './refraction-ui.js';
import {renderPreferences,alcoholText,alcoholResultHTML} from './preferences-ui.js';
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {preparePhoto,getPhoto,deletePhotos,exportPhotoAttachments,restorePhotoAttachments} from './photo-store.js';
import {setupDragDrop} from './drag-drop.js';
import {tankSectionsHTML,attachTankSections,openTankDialog} from './tank-ui.js';
import {setupScanner} from './scanner.js';
import {newState,numberInput,deleteTank,series,currentVolume,currentMemo,CORRECTION_UNITS} from './domain.js';
import {load,save,parseBackupEnvelope,exportBackup,STORAGE_KEY} from './storage.js';
import {predictNaturalAlcohol,correctedAlcohol,convertMustWeightDensity} from './calculations.js';
const $=s=>document.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=2)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(v);
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const uid=()=>crypto.randomUUID();
const memoDrafts=new Map();
let readingPhoto=null,pdfReading=null;
let cockpit=null,selectedWine=null,individual=false,returnView='tanks';
let activeView='tanks',tankSearch='',tankPageIndex=0;
const viewTitles={tanks:'Gärungen',entry:'Messdaten',data:'Messdaten',curves:'Gärkurven',settings:'Grundeinstellungen'};
function workspace(){showWorkspace(activeView);$('#workspace-title').textContent=viewTitles[activeView];$('#workspace-context').hidden=['tanks','settings'].includes(activeView)||!state.tanks.length;
 const multi=activeView!=='settings'&&!individual;$('#cockpit-root').hidden=!multi;
 document.body.classList.toggle('cockpit-mode',multi);document.querySelector('.layout').hidden=multi;document.querySelector('.tank-toolbar').hidden=activeView!=='settings';
 $('#workspace-title').hidden=multi;
 if(multi&&cockpit)cockpit.setView(activeView);
 $('#workspace-back').hidden=!individual;$('#detail-links').hidden=!individual||activeView==='tanks';$('#workspace-context').hidden=multi||activeView==='settings';
 if(individual&&activeView==='curves')$('#wine-dual-chart').innerHTML=fermentationChart(wineReadings(state,selectedWine));
} 
let state=newState(),selected=null,blocked=false,lastRaw=null;
try {lastRaw=localStorage.getItem(STORAGE_KEY);state=withFermentations(load());} catch {blocked=true;$('#fatal').hidden=false;$('#fatal').textContent='Lokale Daten konnten nicht gelesen werden. Sie werden nicht überschrieben. Über „Sicherung exportieren“ die unveränderten Daten retten oder eine gültige Sicherung importieren.';}
selected=state.tanks[0]?.id;selectedWine=state.fermentations?.find(b=>b.tankId===selected)?.id;
function message(text,error=false){$('#message').textContent=text;$('#message').className=error?'error':'';}
function commit(next,{recovery=false}={}) {
  const batch=state.fermentations?.find(b=>b.id===selectedWine);
  if(batch){next={...next,measurements:next.measurements.map(m=>!state.measurements.some(old=>old.id===m.id)&&!m.fermentationId?{...m,fermentationId:batch.id}:m),calculations:next.calculations.map(c=>!state.calculations.some(old=>old.id===c.id)&&!c.fermentationId?{...c,fermentationId:batch.id}:c)};}
  next=withFermentations(next);
  if(blocked&&!recovery) throw Error('Speicherung gesperrt. Bitte zuerst die lokalen Daten sichern und eine gültige Sicherung importieren.');
  if(localStorage.getItem(STORAGE_KEY)!==lastRaw) throw Error('Die Daten wurden in einem anderen Fenster geändert. Bitte diese Seite neu laden.');
  try {save(next);} catch(error) {throw Error('Nicht gespeichert: '+error.message);}
  const removedPhotos=state.photos.filter(p=>!next.photos.some(n=>n.id===p.id)).map(p=>p.id);
  state=next;
  for(const [tankId,draft] of memoDrafts)if(!state.tanks.some(t=>t.id===tankId)){if(draft.photo)deletePhotos([draft.photo.id]).catch(()=>{});memoDrafts.delete(tankId);}
  if(removedPhotos.length)deletePhotos(removedPhotos).catch(error=>message(error.message,true));
  lastRaw=localStorage.getItem(STORAGE_KEY);blocked=false;$('#fatal').hidden=true;
}
function run(action){try{action();}catch(error){message(error.message,true);}}
function confirmAction(title,text){return new Promise(resolve=>{
  const dialog=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-text').textContent=text;
  let answer=false;$('#confirm-yes').onclick=()=>{answer=true;dialog.close();};$('#confirm-no').onclick=()=>dialog.close();
  dialog.onclose=()=>resolve(answer);dialog.showModal();$('#confirm-no').focus();
});}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:name.endsWith('.csv')?'text/csv;charset=utf-8':'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function render(){
  applyLanguage(state.preferences.language??'de');
  renderPreferences(state,{onSave:savePreferences,onError:text=>message(text,true),blocked});
  $('#tank-count').textContent=state.tanks.length;
  $('#add-tank').disabled=blocked;
  renderTankList();
  $('#workspace-tank').innerHTML=state.fermentations.map(b=>`<option value="${esc(b.id)}" ${b.id===selectedWine?'selected':''}>${esc(b.number||'Weinnummer offen')} · ${esc(b.name)}</option>`).join('');
  if(!state.fermentations?.some(b=>b.id===selectedWine))selectedWine=state.fermentations?.find(b=>b.tankId===selected)?.id;
  const wine=state.fermentations?.find(b=>b.id===selectedWine);if(wine)selected=wine.tankId;
  const tank=state.tanks.find(t=>t.id===selected);
  if(!tank){$('#detail').innerHTML='<section class="card empty"><div class="symbol">⌑</div><p class="eyebrow">BEREIT FÜR DEN ERSTEN TANK</p><h2>Lege deinen ersten Tank an.</h2><p>Lege einen Tank an und erfasse die erste Messung. Ausgangswerte kannst du später ergänzen.</p><button id="empty-add">＋ Tank anlegen</button></section>';$('#empty-add').onclick=()=>openTank();workspace();return;}
  const correction=state.corrections.find(c=>c.tankId===tank.id);
  const forecasts=state.calculations.filter(c=>c.fermentationId===selectedWine).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const latest=forecasts[0];
  $('#detail').innerHTML=`${tankSectionsHTML(state,tank,memoDrafts.get(tank.id))}
  <section class="card" data-views="entry data"><p class="eyebrow">GÄRKONTROLLE</p><h2>Neue Messung</h2><button type="button" class="secondary" data-dictation-round>Messrunde diktieren</button><button type="button" class="secondary" id="reading-photo"><span class="scan-action-icon" aria-hidden="true"></span>Messgerät fotografieren</button><button type="button" class="secondary" id="pdf-reading">PDF einlesen</button><p id="reading-photo-draft" class="hint"></p><p class="hint">${sugarInitialReadings(wineReadings(state,selectedWine))?'Restzucker: Ausgangswerte vorhanden. Das Berechnungsmodell ist weiterhin gesperrt.':'Restzucker: Mostgewicht nach Anreicherung und Gesamtsäure zum selben Messzeitpunkt fehlen.'}</p><form id="measurement-form"><div class="form-grid"><label class="wide">Was wird erfasst?<select name="purpose"><option value="reading">Laufende Messung</option><option value="initial">Ausgangswerte vor Gärbeginn</option><option value="sugar-initial">Restzucker: Ausgangswerte nach Anreicherung</option></select></label><label>Datum<input type="date" name="date" value="${today()}" required></label><label>Uhrzeit<input name="time" type="time" value="${localStamp().time}"></label><label>Messgröße<select name="parameter"><option>Mostgewicht</option><option>Dichte</option><option>Temperatur</option><option>Gesamtsäure</option><option>Alkohol (Analyse)</option><option>Lichtbrechung</option></select></label><label><span id="reading-value-label">Originalwert</span><input name="value" required inputmode="decimal" placeholder="z. B. 76"></label><label id="initial-acid-field" hidden><span id="initial-acid-label">Anfangsgesamtsäure g/L</span><input name="initialAcid" inputmode="decimal" placeholder="z. B. 8,5" disabled></label><label id="initial-fermentation-field" hidden>Gärungsart<select name="initialFermentation" disabled><option value="must">Mostgärung</option><option value="mash">Maischegärung (empirisch −4 °Oe)</option></select></label><label>Einheit · aus deinen Vorgaben<select name="unit"></select></label><label>Temperatur °C (optional)<input name="temperature" inputmode="decimal" placeholder="z. B. 20"></label><label>Messverfahren<select name="technique" required><option value="">Bitte auswählen</option>${Object.entries(TECHNIQUES).filter(([k])=>k!=='unknown').map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><details class="reading-extra wide"><summary>Weitere Angaben und Laborwerte (optional)</summary><div class="form-grid"><label>Weinart<select name="wineType">${Object.entries(WINE_TYPES).map(([k,v])=>`<option value="${k}" ${k==='unknown'?'selected':''}>${v}</option>`).join('')}</select></label><label class="wide">Gerät / Messdetails (optional)<input name="method" maxlength="200" placeholder="z. B. Spindel oder DMA 35"></label>${sugarFields('reading')}</div></details></div><div class="form-end"><span class="hint">Originaleingabe und Einheit bleiben erhalten.</span><button id="reading-save">Wert speichern</button></div><div id="initial-preview" aria-live="polite" hidden></div></form></section>
  <section class="card" data-views="curves"><div id="wine-dual-chart" class="chart-wrap"></div><details><summary>Einzelne Messspur und Restzuckeranalysen</summary><div class="section-title"><h2>Gärverlauf</h2><span>${state.measurements.filter(m=>m.tankId===tank.id).length} Messwerte</span></div><div class="row-controls"><label>Diagramm: Messgröße<select id="chart-parameter"><option>Mostgewicht</option><option>Lichtbrechung</option><option>Dichte</option><option>Temperatur</option><option>Gesamtsäure</option><option>Alkohol (Analyse)</option></select></label><label>Einheit<select id="chart-unit"></select></label></div><label>Messspur<select id="chart-technique"><option value="all">Alle getrennten Spuren</option>${Object.entries(TECHNIQUES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><div id="chart" class="chart-wrap"></div><h3>Restzucker · Analyse und Berechnung getrennt</h3><div id="sugar-chart" class="chart-wrap"></div></details></section><section class="card" data-views="entry data"><h2>Messdaten</h2><p class="hint">Originalwerte des ausgewählten Tanks, nach Datum geordnet.</p><div id="measurements" class="table-scroll"></div></section>
  ${refractionSectionHTML(state,tank)}
  <section class="card" data-views="entry data"><p class="eyebrow">SCHANDELMAIER · TABELLENANSATZ</p><h2>Natürliche Alkoholprognose</h2><p class="hint">Prognose aus den Ausgangswerten, keine Messung des aktuellen Alkohols. Aktuelle Säuremessungen ersetzen die Anfangsgesamtsäure nicht.</p><details class="history"><summary>Ausgangswerte nachtragen oder Prognose neu berechnen</summary><form id="forecast-form"><div class="form-grid"><label>Ausgangsmostgewicht vor Anreicherung<input name="oe" inputmode="decimal" required value="${esc(latest?sourceMost(latest).originalInput:'')}"></label><label>Einheit des Ausgangsmostgewichts<select name="mostUnit">${[OE_DE,OE_JUICE,'°Brix','°Oe'].map(u=>`<option value="${esc(u)}" ${u===(latest?sourceMost(latest).unit:state.preferences.mustUnit)?'selected':''}>${esc(unitLabel(u))}</option>`).join('')}</select></label><label>Anfangsgesamtsäure g/L<input name="acid" inputmode="decimal" required value="${esc(latest?.inputs.initialAcid.originalInput??'')}"></label><label>Gärungsart<select name="fermentation"><option value="must">Mostgärung</option><option value="mash" ${latest?.inputs.fermentation==='mash'?'selected':''}>Maischegärung (empirisch −4 °Oe)</option></select></label></div><p class="hint formula-hint">(2,63 × °Oe − 24) × 0,475 + (8 − Anfangsgesamtsäure) / 2 = g/L Alkohol.<br>Maische: vereinfachter historischer Ansatz.</p><button>Prognose berechnen & speichern</button></form></details><div id="forecast-result">${latest?resultHTML(latest):'<p class="hint history">Noch keine Prognose gespeichert.</p>'}</div><details class="history"><summary>Persönliche Korrektur</summary><p class="hint">Separat gespeichert. Wird bei der nächsten Prognose angewendet; frühere Prognosen behalten ihren damaligen Korrekturstand.</p><form id="correction-form"><div class="form-grid"><label>Korrektur (auch negativ)<input name="value" inputmode="decimal" required value="${esc(correction?.originalInput??'0')}"></label><label class="wide">Einheit<select name="unit">${CORRECTION_UNITS.map(u=>`<option ${u===(correction?.unit??(state.preferences.alcoholDisplay==='% vol'?'Prozentpunkte vol':'g/L Alkohol'))?'selected':''}>${u}</option>`).join('')}</select></label></div><button class="secondary">Korrektur speichern</button></form></details><details class="history"><summary>Prognosehistorie (${forecasts.length})</summary><ul>${forecasts.map(c=>`<li>${esc(new Date(c.createdAt).toLocaleString('de-DE'))}: ${esc(alcoholText(c.base,state.preferences.alcoholDisplay))} → mit Korrektur ${esc(alcoholText(c.corrected,state.preferences.alcoholDisplay))}<small>${esc(formatUnitValue(sourceMost(c).value,sourceMost(c).unit,sourceMost(c).originalInput))} ${esc(unitLabel(sourceMost(c).unit))} · Anfangssäure ${esc(c.inputs.initialAcid.originalInput)} g/L · ${c.inputs.fermentation==='must'?'Most':'Maische'} · Korrektur ${c.correction?esc(c.correction.originalInput)+' '+esc(c.correction.unit):'keine'}</small></li>`).join('')}</ul></details></section>`;
  $('#edit-tank').onclick=()=>openTank(tank);
  $('#delete-tank').onclick=async()=>{if(await confirmAction('Tank vollständig löschen?',`„${tank.number||'Nummer offen'} · ${tank.name}“ samt Mengenverlauf, Merkzetteln, Messwerten, Korrekturen und Prognosen wird gelöscht. Vorher bei Bedarf eine Sicherung exportieren.`))run(()=>{commit(deleteTank(state,tank.id));selected=state.tanks[0]?.id;render();message('Tank gelöscht.');});};
  attachTankSections(tank,{getState:()=>state,commit,render,message,run,getDraft:id=>memoDrafts.get(id),clearDraft:id=>memoDrafts.delete(id),onScanMemo:id=>scanner.openMemo(id),onShowMemo:showMemo,onRemoveDraft:id=>{const draft=memoDrafts.get(id);if(draft?.photo)deletePhotos([draft.photo.id]).catch(error=>message(error.message,true));memoDrafts.set(id,{removePhoto:true,text:$('#memo-form').elements.description.value});$('#memo-photo-status').textContent='Nächster Stand wird ohne Foto gespeichert. Frühere Stände behalten ihr Foto.';}});
  attachRefractionSection(tank,{getState:()=>state,commit,render,message,run});
  const mf=$('#measurement-form');
  const compatible={Lichtbrechung:['nD','°Brix'],Mostgewicht:MUST_UNITS,Dichte:['d20/20','g/mL','kg/m³'],Temperatur:['°C'],Gesamtsäure:['g/L'],'Alkohol (Analyse)':['% vol','g/L']};
  function units(select,parameter,desired){const available=parameter==='Dichte'?densityEntryUnits(state.preferences.densityUnit):compatible[parameter];if(parameter==='Dichte'&&select.id==='chart-unit')for(const m of state.measurements.filter(m=>m.tankId===tank.id&&m.parameter==='Dichte'))if(!available.includes(m.unit))available.push(m.unit);select.innerHTML=available.map(u=>`<option value="${esc(u)}">${esc(unitLabel(u))}</option>`).join('');const preferred=desired??(parameter==='Mostgewicht'?state.preferences.mustUnit:parameter==='Lichtbrechung'?state.preferences.refractionUnit:parameter==='Dichte'?state.preferences.densityUnit:parameter==='Alkohol (Analyse)'&&state.preferences.alcoholDisplay==='g/L'?'g/L':compatible[parameter][0]);if(compatible[parameter].includes(preferred))select.value=preferred;}
  units(mf.elements.unit,mf.elements.parameter.value);mf.elements.technique.value='density';
  function refreshReading(){
    const sugar=mf.elements.purpose.value==='sugar-initial',initial=mf.elements.purpose.value==='initial',paired=initial||sugar;
    $('#initial-acid-field').hidden=!paired;
    $('#initial-acid-label').textContent=sugar?'Gesamtsäure zum selben Messzeitpunkt g/L':'Anfangsgesamtsäure g/L';
    mf.elements.time.required=sugar;$('#initial-fermentation-field').hidden=!initial;
    mf.elements.initialAcid.disabled=!paired;mf.elements.initialAcid.required=paired;mf.elements.initialFermentation.disabled=!initial;
    $('#reading-value-label').textContent=sugar?'Mostgewicht nach Anreicherung':initial?'Ausgangsmostgewicht vor Anreicherung':'Originalwert';
    $('#reading-save').textContent=sugar?'Restzucker-Ausgangswerte speichern':initial?'Ausgangswerte & Prognose speichern':'Wert speichern';
    const whole=isOechsle(mf.elements.unit.value);
    mf.elements.value.inputMode=whole?'numeric':'decimal';mf.elements.value.placeholder=whole?'z. B. 76':'z. B. 20,5';
    mf.elements.value.setCustomValidity(whole&&mf.elements.value.value.trim()&&!Number.isInteger(Number(mf.elements.value.value.replace(',','.')))?'°Oe bitte als ganze Zahl eingeben.':'');
    const out=$('#initial-preview');out.hidden=!paired;if(sugar){out.innerHTML='<p class="hint">Mostgewicht nach einer gegebenenfalls erfolgten Anreicherung und Gesamtsäure gemeinsam erfassen. Datum und Uhrzeit gelten für beide Werte. Es wird keine natürliche Alkoholprognose erstellt.</p>';return;}if(!initial)return;
    out.innerHTML='<p class="hint">Mostgewicht und Anfangsgesamtsäure vor Gärbeginn und vor einer Anreicherung eingeben. Die Alkoholprognose erscheint hier automatisch. Gespeichert wird erst mit der Taste oben.</p>';
    if(!mf.elements.value.validity.valid){out.textContent=mf.elements.value.validationMessage;return;}
    if(!mf.elements.value.value.trim()||!mf.elements.initialAcid.value.trim())return;
    try{const c=initialForecast({originalInput:mf.elements.value.value,unit:mf.elements.unit.value,acid:mf.elements.initialAcid.value,fermentation:mf.elements.initialFermentation.value,oeScale:state.preferences.oeScale,correction:state.corrections.find(c=>c.tankId===tank.id)});
      out.innerHTML='<div class="result"><p class="hint">Natürliche Alkoholprognose · Vorschau, noch nicht gespeichert</p>'+alcoholResultHTML(c.corrected,state.preferences.alcoholDisplay)+'<p class="hint">Aus den Anfangswerten, kein aktueller Alkoholgehalt.'+(c.derivedMostWeight.status==='working-rule'?' Deutsche +2-Arbeitsregel, keine validierte Gerätekennlinie.':'')+'</p></div>';
    }catch(error){out.textContent=error.message;}
  }
  mf.elements.parameter.onchange=()=>{units(mf.elements.unit,mf.elements.parameter.value);const p=mf.elements.parameter.value;if(p!=='Mostgewicht')mf.elements.purpose.value='reading';mf.elements.technique.value=p==='Dichte'?'density':p==='Lichtbrechung'?'refractometer':['Temperatur','Gesamtsäure','Alkohol (Analyse)'].includes(p)?'other':'';refreshReading();};
  mf.elements.purpose.onchange=()=>{if(['initial','sugar-initial'].includes(mf.elements.purpose.value)){mf.elements.parameter.value='Mostgewicht';units(mf.elements.unit,'Mostgewicht');}refreshReading();};
  mf.addEventListener('input',refreshReading);mf.addEventListener('change',refreshReading);refreshReading();
  mf.onsubmit=e=>{e.preventDefault();run(()=>{const f=new FormData(mf);const originalInput=f.get('value');const m=makeReading({id:uid(),tankId:tank.id,fermentationId:selectedWine,date:f.get('date'),time:f.get('time'),parameter:f.get('parameter'),technique:f.get('technique'),wineType:f.get('wineType'),originalInput,unit:f.get('unit'),temperatureOriginalInput:f.get('temperature'),method:f.get('method')});const initial=f.get('purpose')==='initial',sugar=f.get('purpose')==='sugar-initial';const updated=sugar?appendSugarInitialReading(state,m,{acid:f.get('initialAcid'),acidId:uid()}):initial?appendInitialReading(state,m,{acid:f.get('initialAcid'),fermentation:f.get('initialFermentation'),acidId:uid(),forecastId:uid()}):{...state,measurements:[...state.measurements,m]};const next=withSugarFields(updated,m.id,f,'reading');commit(readingPhoto.stage(next,m.id));readingPhoto.saved();render();message(sugar?'Restzucker-Ausgangswerte zum gemeinsamen Messzeitpunkt gespeichert.':initial?'Ausgangsmostgewicht, Anfangsgesamtsäure und Alkoholprognose gespeichert.':'Messung gespeichert.');});};
  function updateChart(){const p=$('#chart-parameter').value;const u=$('#chart-unit').value;drawChart(tank.id,p,u);}
  function chartUnits(){const parameter=$('#chart-parameter').value;const preferred=parameter==='Mostgewicht'?state.preferences.mustUnit:parameter==='Lichtbrechung'?state.preferences.refractionUnit:parameter==='Dichte'?state.preferences.densityUnit:compatible[parameter][0];const rows=state.measurements.filter(m=>m.tankId===tank.id&&m.parameter===parameter);units($('#chart-unit'),parameter,rows.some(m=>m.unit===preferred)?preferred:rows.at(-1)?.unit??preferred);}
  chartUnits();
  $('#chart-parameter').onchange=()=>{chartUnits();updateChart();};$('#chart-unit').onchange=updateChart;$('#chart-technique').onchange=updateChart;updateChart();$('#sugar-chart').innerHTML=sugarChartHTML({...state,measurements:wineReadings(state,selectedWine)},tank.id);
  renderTable(tank.id);
  $('#correction-form').onsubmit=e=>{e.preventDefault();run(()=>{const f=new FormData(e.target);const c={id:correction?.id??uid(),tankId:tank.id,originalInput:f.get('value'),value:numberInput(f.get('value')),unit:f.get('unit'),updatedAt:new Date().toISOString()};commit({...state,corrections:[...state.corrections.filter(c=>c.tankId!==tank.id),c]});message('Korrektur gespeichert. Für ein aktualisiertes Ergebnis die Prognose erneut berechnen.');});};
  $('#forecast-form').onsubmit=e=>{e.preventDefault();run(()=>{
    const f=new FormData(e.target),mostWeight={value:numberInput(f.get('oe')),originalInput:f.get('oe'),unit:f.get('mostUnit')};
    const resolved=resolveMostWeight(mostWeight,state.preferences.oeScale);
    const inputs={mostWeight,oeScale:resolved.scale,initialAcid:{value:numberInput(f.get('acid')),originalInput:f.get('acid'),unit:'g/L'},fermentation:f.get('fermentation')};
    const base=predictNaturalAlcohol({oe:resolved.value,initialAcid:inputs.initialAcid.value,fermentation:inputs.fermentation});
    const current=state.corrections.find(c=>c.tankId===tank.id)??null;
    const c={id:uid(),tankId:tank.id,createdAt:new Date().toISOString(),modelVersion:base.modelVersion,inputs,derivedMostWeight:resolved,base,correction:current?structuredClone(current):null,corrected:correctedAlcohol(base.alcoholGL,current)};
    commit({...state,calculations:[...state.calculations,c]});render();message('Prognose mit Originalwert, Skala und Korrekturstand gespeichert.');
  });};
  for(const panel of $('#detail').children)if(!panel.dataset.views)panel.dataset.views=panel.querySelector('#refraction-sample-form')?'entry':'tanks';
  readingPhoto?.attach();pdfReading?.attach();
  workspace();
}
function renderTankList(){
  const page=tankPage(state.tanks,tankSearch,tankPageIndex);tankPageIndex=page.index;
  $('#tank-list').innerHTML=page.rows.length?page.rows.map(t=>`<div class="tank-entry"><button draggable="true" data-drag-tank="${esc(t.id)}" class="tank-item ${t.id===selected?'active':''}" data-tank="${esc(t.id)}" aria-pressed="${t.id===selected}"><strong>${esc(t.number||'Nummer offen')}</strong><span>${esc(t.name)}</span><small>${t.capacityL===null?'Tankvolumen offen':fmt(t.capacityL)+' L Tankvolumen'} · ${currentVolume(state,t.id)?fmt(currentVolume(state,t.id).value)+' L im Tank':'Menge offen'}</small></button>${currentMemo(state,t.id)?`<button class="memo-chip secondary compact" draggable="true" data-drag-memo="${esc(currentMemo(state,t.id).id)}" data-show-memo="${esc(currentMemo(state,t.id).id)}">Merkzettel anzeigen / ziehen</button>`:''}</div>`).join(''):'<p class="hint">Keine Tanks gefunden.</p>';
  $('#tank-page-status').textContent=`${page.total} Tanks · ${page.index+1} / ${page.pages}`;$('#tank-prev').disabled=page.index===0;$('#tank-next').disabled=page.index===page.pages-1;
}
function sourceMost(c){return c.inputs.mostWeight??c.inputs.oe;}
function resultHTML(c){const source=sourceMost(c),converted=c.derivedMostWeight?.conversionVersion;return `<div class="result"><div class="values"><div><span class="hint">Tabellenprognose</span><br>${alcoholResultHTML(c.base,state.preferences.alcoholDisplay)}</div><div><span class="hint">Mit persönlicher Korrektur</span><br>${alcoholResultHTML(c.corrected,state.preferences.alcoholDisplay)}</div></div><p>Stand ${esc(new Date(c.createdAt).toLocaleString('de-DE'))} · Ausgang: ${esc(formatUnitValue(source.value,source.unit,source.originalInput))} ${esc(unitLabel(source.unit))}${converted?' → '+fmt(c.derivedMostWeight.value,0)+' °Oe (Anzeige gerundet)':''}.${c.derivedMostWeight?.status==='working-rule'?' Deutsche +2-Arbeitsregel nach Vorgabe, keine validierte Gerätekennlinie.':''} Korrektur: ${c.correction?esc(c.correction.originalInput)+' '+esc(c.correction.unit):'keine'}. Intern ungerundet; g/L-Anzeige auf ganze Gramm.</p></div>`;}
function savePreferences(preferences){
  const form=$('#measurement-form');const draft=form?.elements.value.value.trim()?Object.fromEntries(new FormData(form)):null;
  const forecast=$('#forecast-form');const forecastDraft=forecast?.elements.oe.value.trim()?Object.fromEntries(new FormData(forecast)):null;
  commit({...state,preferences});render();
  if(draft){const target=$('#measurement-form');for(const [key,value] of Object.entries(draft))if(key!=='unit'&&target.elements[key])target.elements[key].value=value;target.elements.parameter.onchange();target.elements.unit.value=draft.unit;target.elements.technique.value=draft.technique;target.dispatchEvent(new Event('input'));}
  if(forecastDraft){const target=$('#forecast-form');for(const [key,value] of Object.entries(forecastDraft))if(target.elements[key])target.elements[key].value=value;}
  message('Deine Einheiten sind gespeichert. Bereits erfasste Werte und begonnene Eingaben behalten ihre ursprüngliche Einheit.');
}
function renderTable(tankId){
  const rows=state.measurements.filter(m=>m.fermentationId===selectedWine).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.createdAt.localeCompare(b.createdAt));
  $('#measurements').innerHTML=rows.length?`<table><caption class="hint">Chronologische Originalmessungen · Einheiten werden nicht vermischt.</caption><thead><tr><th>Datum / Zeit</th><th>Messgröße</th><th>Originalwert</th><th>Temperatur / Messverfahren</th><th>Restzucker · Analyse</th><th>Restzucker · berechnet</th><th>Aktion</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${esc(m.date.split('-').reverse().join('.'))}<small>${esc(m.time||'Zeit nicht erfasst')}</small></td><td>${esc(m.parameter)}${m.measurementRole==='sugar-initial'?'<small>Restzucker: Ausgangswerte nach Anreicherung</small>':''}${m.measurementRole==='initial'?'<small>Ausgangswert vor Gärbeginn</small>':''}${m.sampleGroupId?'<small>Probe '+esc(m.sampleGroupId.slice(0,8))+' · '+esc(({unknown:'Zustand unbekannt',unfermented:'unvergoren',fermenting:'in Gärung',finished:'vergoren'})[m.sampleStage])+'</small>':''}</td><td><strong>${esc(formatUnitValue(m.value,m.unit,m.originalInput))}</strong>${m.photoId?`<button type="button" class="secondary compact" data-reading-photo="${esc(m.photoId)}">Gerätefoto</button>`:''}${isOechsle(m.unit)&&!Number.isInteger(m.value)?`<small>Originaleingabe: ${esc(m.originalInput)}</small>`:''} ${esc(unitLabel(m.unit))}</td><td>${m.temperatureC===null?'—':fmt(m.temperatureC)+' °C'}<small>${methodCell(m)}</small></td>${sugarCells(state,m)}<td>${state.measurements.some(n=>n.supersedesId===m.id)?'<span class="hint">Durch Korrektur ersetzt</span>':`${!m.sampleGroupId&&!['initial','sugar-initial'].includes(m.measurementRole)?`<button class="secondary compact" data-edit-measurement="${esc(m.id)}">Korrigieren</button>`:''}${m.supersedesId?'<small>Korrektur · Original bleibt erhalten</small>':''}<button class="secondary compact danger" data-delete-measurement="${esc(m.id)}" aria-label="Messung vom ${esc(m.date)} löschen">Löschen</button>`}</td></tr>`).join('')}</tbody></table>`:'<p class="hint">Noch keine Messungen. Erfasse den ersten Wert oben.</p>';
}
function drawChart(tankId,parameter,unit){$('#chart').innerHTML=trackChartHTML(state,wineReadings(state,selectedWine),parameter,unit,$('#chart-technique').value);}
function openTank(tank){if(blocked){message('Erfassung bis zur Datenwiederherstellung gesperrt.',true);return;}openTankDialog(tank,{getState:()=>state,commit,onSaved:(id,editing)=>{selected=id;selectedWine=state.fermentations.find(b=>b.tankId===id)?.id;render();message(editing?'Tankstammdaten übernommen.':'Tank angelegt. Du kannst jetzt Mengen und Messwerte erfassen.');}});}
$('#add-tank').onclick=()=>openTank();$('#close-tank').onclick=()=>$('#tank-dialog').close();
const scanner=setupScanner({getState:()=>state,getSelectedTankId:()=>selected,message,onMemoPhoto:async({file,text,rawText,tankId})=>{
  if(!state.tanks.some(t=>t.id===tankId))throw Error('Der zugehörige Tank ist nicht mehr vorhanden.');
  const photo=await preparePhoto(file,rawText),old=memoDrafts.get(tankId);
  if(old?.photo)await deletePhotos([old.photo.id]);
  memoDrafts.set(tankId,{photo,text});selected=tankId;render();message('Foto und erkannten Text prüfen, Angaben zum Inhalt ergänzen und „Merkzettel speichern“ wählen.');
},onTankSelected:id=>{selected=id;selectedWine=state.fermentations.find(b=>b.tankId===id)?.id;render();message('Tanknummer bestätigt. Jetzt den Wert erfassen.');},onNewNumber:number=>{openTank();$('#tank-form').elements.number.value=number;}});
$('#workspace-tank').onchange=e=>{selectedWine=e.target.value;render();};
$('#tank-search').oninput=e=>{tankSearch=e.target.value;tankPageIndex=0;renderTankList();};
$('#tank-prev').onclick=()=>{tankPageIndex--;renderTankList();};$('#tank-next').onclick=()=>{tankPageIndex++;renderTankList();};
document.querySelector('.workspace-nav').onclick=e=>{const b=e.target.closest('[data-view-button]');if(!b)return;activeView=b.dataset.viewButton;individual=false;workspace();window.scrollTo({top:0,behavior:'instant'});};
$('#tank-list').onclick=e=>{const button=e.target.closest('[data-tank]');if(button){returnView=activeView;selected=button.dataset.tank;selectedWine=state.fermentations.find(b=>b.tankId===selected)?.id;individual=true;activeView='tanks';render();}};
$('#detail').onclick=async e=>{const button=e.target.closest('[data-delete-measurement]');if(button&&await confirmAction('Messung löschen?','Die ausgewählte Messung wird gelöscht. Beim Löschen einer Korrektur wird die vorherige Fassung wieder aktuell.'))run(()=>{commit(deleteMeasurement(state,button.dataset.deleteMeasurement));render();message('Messung gelöscht.');});};
$('#export').onclick=async()=>{try{if(blocked)download(lastRaw??'',`vinora-rohdaten-rettung-${today()}.json`);else{const attachments=await exportPhotoAttachments(state.photos);download(exportBackup(state,attachments),`vinora-${today()}.json`);}message(blocked?'Unveränderte Rohdaten zur Rettung exportiert.':'Vollständige Sicherung einschließlich aller Merkzettelfotos exportiert.');}catch(error){message(error.message,true);}};
$('#import-trigger').onclick=()=>$('#import').click();
$('#import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>100*1024*1024)throw Error('Sicherung ist größer als 100 MB.');const envelope=parseBackupEnvelope(await file.text()),incoming=envelope.data;if(await confirmAction('Sicherung wiederherstellen?',`${incoming.tanks.length} Tanks, ${incoming.measurements.length} Messwerte, ${incoming.volumeReadings.length} Mengenwerte, ${incoming.memos.length} Merkzettel und ${incoming.photos.length} Fotos. Dies ersetzt alle lokal gespeicherten Daten in Vinora. Vorher bei Bedarf die vorhandenen Daten exportieren.`)){await restorePhotoAttachments(envelope.attachments,incoming.photos);commit(incoming,{recovery:true});for(const draft of memoDrafts.values())if(draft.photo&&!state.photos.some(p=>p.id===draft.photo.id))deletePhotos([draft.photo.id]).catch(()=>{});memoDrafts.clear();selected=state.tanks[0]?.id;render();message('Datensicherung vollständig einschließlich der Originalfotos wiederhergestellt.');}}catch(error){message('Import abgebrochen: '+error.message,true);}};
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){message('Die Daten wurden in einem anderen Fenster geändert. Bitte neu laden, bevor du weiterarbeitest.',true);}});
function connection(){$('#connection').textContent=navigator.onLine?'Lokal auf diesem Gerät':'Offline · Daten lokal';}window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('#offline-status').textContent='Für Offline-Nutzung bereit · Im Browser installierbar';}).catch(()=>{$('#offline-status').textContent='Offline-Cache nicht verfügbar. Bitte über localhost oder HTTPS öffnen.';});}else{$('#offline-status').textContent='Browser unterstützt keinen Offline-Cache.';}
setupDictationRound({getState:()=>state,commit,onFinish:render});
setupMeasurementEditor({getState:()=>state,commit,render,message});
setupSpeechReading({getState:()=>state,message,onOpen:(id,view)=>{if(!individual)returnView=activeView;selectedWine=id;individual=true;activeView=view;render();window.scrollTo({top:0});}});
document.addEventListener('click',event=>{if(!event.target.closest('[data-export-measurements]'))return;try{download(measurementsCSV(state),'gaerkontrolle-messwerte-'+today()+'.csv');message('Messwerte als CSV exportiert. Für eine vollständige Sicherung JSON verwenden.');}catch(error){message(error.message,true);}});
pdfReading=setupPDFReading({getState:()=>state,getWineId:()=>selectedWine,message});
readingPhoto=setupReadingPhoto({getState:()=>state,getWineId:()=>selectedWine,message});
cockpit=setupCockpit({getState:()=>state,commit,message,onAddTank:()=>openTank(),onOpen:(id,view)=>{returnView=activeView;selectedWine=id;individual=true;activeView=view;render();window.scrollTo({top:0});},onTankDetails:()=>{returnView=activeView;individual=true;activeView='tanks';render();}});
$('#detail-links').onclick=e=>{const b=e.target.closest('[data-detail-view]');if(b){activeView=b.dataset.detailView;workspace();window.scrollTo({top:0});}};
$('#workspace-back').onclick=()=>{individual=false;activeView=returnView;workspace();window.scrollTo({top:0});};
render();


let memoPhotoURL=null;
async function showMemo(id){
 const memo=state.memos.find(m=>m.id===id);if(!memo)return;const tank=state.tanks.find(t=>t.id===memo.tankId);
 $('#memo-view-title').textContent='Merkzettel · Tank '+(tank?.number||'Nummer offen');
 $('#memo-view-content').textContent=[tank?.name,memo.dateUnknown?'Altbestand · Datum unbekannt':memo.date,memo.wineNumber,memo.variety,memo.vintage,memo.site,memo.qualityLevel,memo.description].filter(Boolean).join('\n');
 const image=$('#memo-view-photo');image.hidden=true;
 $('#memo-view-dialog').showModal();
 if(memo.photoId)try{const blob=await getPhoto(memo.photoId);if(!blob)throw Error('Originalfoto fehlt im lokalen Fotospeicher.');if(!$('#memo-view-dialog').open)return;memoPhotoURL=URL.createObjectURL(blob);image.src=memoPhotoURL;image.hidden=false;}catch(error){$('#memo-view-content').textContent+='\n'+error.message;}
}
$('#memo-view-close').onclick=()=>$('#memo-view-dialog').close();
$('#memo-view-dialog').addEventListener('close',()=>{if(memoPhotoURL)URL.revokeObjectURL(memoPhotoURL);memoPhotoURL=null;$('#memo-view-photo').removeAttribute('src');});
document.addEventListener('click',e=>{const button=e.target.closest('[data-show-memo]');if(button)showMemo(button.dataset.showMemo);});
const containerList=setupContainerList({getState:()=>state,message,onImport:next=>{const firstNew=next.tanks.find(t=>!state.tanks.some(old=>old.id===t.id));commit(next);if(firstNew)selected=firstNew.id;render();}});
setupLanguages({language:state.preferences.language,onChange:language=>commit({...state,preferences:{...state.preferences,language}}),onError:text=>message(text,true)});
setupMeasurementDialogs({getState:()=>state,commit,render,message});
setupContainerSourceViewer({getState:()=>state,message,onTankSelected:id=>{selected=id;selectedWine=state.fermentations.find(b=>b.tankId===id)?.id;render();message('Tank geöffnet. Jetzt Mengen oder Messwerte erfassen.');}});
setupDragDrop({getState:()=>state,message,onTank:id=>{selected=id;selectedWine=state.fermentations.find(b=>b.tankId===id)?.id;render();message('Tank ausgewählt. Jetzt den Wert erfassen.');},onMemo:showMemo,onFile:(target,file)=>target==='container-list'?containerList.openFile(file):scanner.openFile(target,file)});
