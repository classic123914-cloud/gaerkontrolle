// SPDX-License-Identifier: GPL-3.0-only
import {readingCandidates} from './reading-photo.js';
import {ocrModel} from './ocr-languages.js';
import {html as esc} from './fermentation-chart.js';
// Keep each occurrence and its context: a report can contain several wines/dates.
export function pdfCandidates(text){
 return text.split(/\r?\n/).flatMap((line,index)=>readingCandidates(line).map(c=>({...c,line:index+1,context:line.trim().slice(0,400)})));
}
export function pdfLines(items){
 const lines=[];let y=null;
 for(const item of items){if(typeof item.str!=='string')continue;const next=item.transform?.[5];if(y!==null&&Math.abs(next-y)>3)lines.push('\n');lines.push(item.str,' ');y=next;if(item.hasEOL){lines.push('\n');y=null;}}
 return lines.join('').replace(/[ \t]+\n/g,'\n').slice(0,100000);
}
export function setupPDFReading({getState,getWineId,message}){
 const dialog=document.createElement('dialog');dialog.id='pdf-reading-dialog';dialog.className='wide-dialog';
 dialog.innerHTML=`<h2>PDF-Messbericht einlesen</h2><p>Eine Seite auswählen, Messwert und zugehörigen Wein prüfen. Jeder Wert wird einzeln in die Werterfassung übernommen. Die PDF wird nicht gespeichert oder hochgeladen.</p><input id="pdf-file" type="file" accept="application/pdf,.pdf"><p id="pdf-status" role="status"></p><label>Seite<select id="pdf-page" disabled></select></label><canvas id="pdf-preview" hidden aria-label="Originalseite des Messberichts"></canvas><button id="pdf-ocr" class="secondary" disabled>Gescannte Seite erkennen</button><label>Gelesenen Text prüfen / korrigieren<textarea id="pdf-text" rows="6" maxlength="100000"></textarea></label><button id="pdf-refresh" class="secondary" disabled>Werte aus Text suchen</button><label>Messwert ausdrücklich auswählen<select id="pdf-value"><option value="">Bitte auswählen</option></select></label><label>Messverfahren<select id="pdf-technique"><option value="">Bitte auswählen</option><option value="density">Dichtemessung</option><option value="refractometer">Refraktometer</option><option value="other">Anderes Verfahren</option></select></label><p class="hint">Nur der ausgewählte Wert wird übertragen. Datum, Uhrzeit, Temperatur und Oechsle-Skala anschließend im Messformular prüfen. Diagrammbeschriftungen und berechnete Werte können ebenfalls im PDF stehen; diese nicht als Originalmessung übernehmen.</p><div class="actions"><button id="pdf-close" class="secondary">Abbrechen</button><button id="pdf-accept" disabled>Geprüften Wert übernehmen</button></div>`;
 document.body.append(dialog);const $=s=>dialog.querySelector(s);
 let doc=null,task=null,worker=null,renderTask=null,job=0,busy=false,wineId=null,name='',candidates=[];
 const status=t=>$('#pdf-status').textContent=t;
 function controls(){ $('#pdf-accept').disabled=busy||!doc||$('#pdf-value').value===''||!$('#pdf-technique').value;$('#pdf-page').disabled=busy||!doc;$('#pdf-file').disabled=busy;$('#pdf-ocr').disabled=busy||!doc;$('#pdf-refresh').disabled=busy||!doc; }
 function suggestions(){candidates=pdfCandidates($('#pdf-text').value);$('#pdf-value').innerHTML='<option value="">Bitte auswählen</option>'+candidates.map((c,i)=>`<option value="${i}">${esc(c.originalInput)} ${esc(c.unit)} · ${esc(c.context)}</option>`).join('');controls();}
 async function page(){const token=++job;busy=true;controls();$('#pdf-text').value='';suggestions();
  try{const p=await doc.getPage(Number($('#pdf-page').value));if(token!==job)return;const base=p.getViewport({scale:1}),viewport=p.getViewport({scale:Math.min(2,1800/Math.max(base.width,base.height))}),canvas=$('#pdf-preview');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.hidden=false;
   renderTask=p.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;if(token!==job)return;
   const text=await p.getTextContent();if(token!==job)return;$('#pdf-text').value=pdfLines(text.items);suggestions();status(candidates.length?`${candidates.length} Vorschläge auf dieser Seite. Mit der Originalseite vergleichen.`:'Keine eindeutigen Werte mit Einheit gefunden. Bei einer gescannten Seite „Gescannte Seite erkennen“ wählen oder Text korrigieren.');p.cleanup();
  }catch(error){if(token===job)status('Seite nicht lesbar: '+error.message);}finally{if(token===job){busy=false;controls();}}
 }
 $('#pdf-file').onchange=async()=>{const file=$('#pdf-file').files[0];$('#pdf-file').value='';if(!file)return;const token=++job;busy=true;candidates=[];$('#pdf-text').value='';$('#pdf-value').innerHTML='<option value="">Bitte auswählen</option>';$('#pdf-preview').hidden=true;controls();status('PDF wird lokal geöffnet …');
  try{if(file.size>20*1024*1024)throw Error('Bitte eine PDF bis 20 MB auswählen.');await doc?.destroy();doc=null;const pdf=await import('./vendor/pdf/pdf.js');pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf/pdf.worker.js',import.meta.url).href;
   task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,disableFontFace:true,disableWorkerRendering:true});const loaded=await task.promise;if(token!==job){await loaded.destroy();return;}doc=loaded;if(doc.numPages>100)throw Error('Höchstens 100 Seiten. Bitte einen kürzeren Bericht auswählen.');name=file.name;$('#pdf-page').innerHTML=Array.from({length:doc.numPages},(_,i)=>`<option value="${i+1}">Seite ${i+1} / ${doc.numPages}</option>`).join('');await page();
  }catch(error){if(token===job){await doc?.destroy();doc=null;status('PDF nicht geöffnet: '+error.message);busy=false;controls();}}
 };
 $('#pdf-page').onchange=page;$('#pdf-refresh').onclick=suggestions;$('#pdf-value').onchange=controls;$('#pdf-technique').onchange=controls;
 $('#pdf-ocr').onclick=async()=>{const token=++job;busy=true;controls();status('Seite wird lokal erkannt …');let localWorker;
  try{if(!window.Tesseract)throw Error('OCR nicht verfügbar.');localWorker=await window.Tesseract.createWorker(ocrModel(getState().preferences.language),1,{workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,corePath:new URL('./vendor/ocr/core/',import.meta.url).href,langPath:new URL('./vendor/ocr/lang',import.meta.url).href,workerBlobURL:false,cacheMethod:'none'});worker=localWorker;if(token!==job)return;const {data}=await localWorker.recognize($('#pdf-preview'));if(token!==job)return;$('#pdf-text').value=data.text.slice(0,100000);suggestions();status(`${candidates.length} Vorschläge. Erkennung anhand der Originalseite prüfen.`);
  }catch(error){if(token===job)status('Erkennung nicht möglich: '+error.message);}finally{await localWorker?.terminate().catch(()=>{});if(worker===localWorker)worker=null;if(token===job){busy=false;controls();}}
 };
 $('#pdf-close').onclick=()=>dialog.close();
 $('#pdf-accept').onclick=()=>{try{const c=candidates[Number($('#pdf-value').value)],form=document.querySelector('#measurement-form');if($('#pdf-value').value===''||!c||!form||wineId!==getWineId())throw Error('Messwert und Wein erneut prüfen.');if(!$('#pdf-technique').value)throw Error('Messverfahren auswählen.');
  form.elements.parameter.value=c.unit==='°C'?'Temperatur':c.unit==='g/mL'?'Dichte':c.unit==='nD'?'Lichtbrechung':'Mostgewicht';form.elements.parameter.onchange();form.elements.value.value=c.originalInput;if(c.unit!=='°Oe')form.elements.unit.value=c.unit;form.elements.technique.value=$('#pdf-technique').value;form.elements.method.value=('PDF: '+name+' · Seite '+$('#pdf-page').value).slice(0,200);form.dispatchEvent(new Event('input'));dialog.close();message('PDF-Wert ins Formular übernommen. Datum, Einheit und Verfahren prüfen, dann „Wert speichern“.');
 }catch(error){status(error.message);}};
 dialog.onclose=()=>{job++;renderTask?.cancel();worker?.terminate().catch(()=>{});task?.destroy().catch(()=>{});doc=null;task=null;worker=null;busy=false;name='';candidates=[];$('#pdf-text').value='';$('#pdf-preview').width=0;$('#pdf-preview').height=0;$('#pdf-preview').hidden=true;$('#pdf-value').innerHTML='<option value="">Bitte auswählen</option>';$('#pdf-page').innerHTML='';controls();};
 return {attach(){const button=document.querySelector('#pdf-reading');if(button)button.onclick=()=>{wineId=getWineId();if(!wineId)return;$('#pdf-technique').value='';status('PDF auswählen (höchstens 20 MB / 100 Seiten).');controls();dialog.showModal();};}};
}
