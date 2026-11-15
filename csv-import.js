import {checkReading} from './measurement-entry.js';
// SPDX-License-Identifier: GPL-3.0-only
import {numberInput,validDate} from './domain-v1.js';
import {wineKey} from './fermentations.js';
export function csvRows(text){
 const rows=[];let fields=[],field='',quoted=false;
 for(let i=0,s=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');i<=s.length;i++){
  const c=s[i]??'\n';if(c==='"'){if(quoted&&s[i+1]==='"'){field+='"';i++;}else if(quoted||!field)quoted=!quoted;else throw Error('Unerwartetes CSV-Anführungszeichen.');}
  else if(c===';'&&!quoted){fields.push(field);field='';}else if(c==='\n'&&!quoted){fields.push(field);if(fields.some(v=>v.trim()))rows.push(fields);fields=[];field='';}else field+=c;
 }if(quoted)throw Error('CSV-Anführungszeichen nicht geschlossen.');return rows;
}
export function parseDMA(text){
 const rows=csvRows(text),header=rows.shift()?.map(x=>x.trim());
 if(!header)throw Error('CSV ist leer.');
 const modern=header[0]==='MessNr'&&header[4]==='Proben-ID'&&header[6]==='Wert'&&header[14]==='Temperatur';
 const simple=header[0]==='MessNr'&&header[4]==='Wert'&&header[8]==='Proben-ID';
 if(!modern&&!simple)throw Error('Unbekanntes CSV-Format. Unterstützt werden DMA-Exporte mit MessNr, Datum, Uhrzeit, Wert, Einheit, Temperatur und Proben-ID.');
 return rows.map((rawFields,index)=>{
  const r={row:index+2,rawFields};try{
   const f=rawFields.map(x=>x.trim()),parts=f[1]?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
   r.date=parts?`${parts[3]}-${parts[2]}-${parts[1]}`:f[1];r.time=f[2];r.sample=f[modern?4:8];r.method=f[3]??'';
   r.originalInput=rawFields[modern?6:4];r.unit=f[modern?7:5];r.temperatureOriginalInput=rawFields[modern?14:6];r.status=f[modern?16:9]??'';
   if(!r.sample||r.sample.length>100||!validDate(r.date)||!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(r.time))throw Error('Datum, Uhrzeit oder Wein-ID ungültig.');
   r.parameter=['°Oe','°Brix'].includes(r.unit)?'Mostgewicht':['g/cm³','g/cm3','g/mL','kg/m³','d20/20'].includes(r.unit)?'Dichte':null;
   if(!r.parameter)throw Error('Einheit nicht unterstützt: '+r.unit);
   if(r.unit==='g/cm³'||r.unit==='g/cm3')r.unit='g/mL';
   if(f[modern?15:7]!=='°C')throw Error('Temperatureinheit muss °C sein.');
   r.value=numberInput(r.originalInput);r.temperatureC=numberInput(r.temperatureOriginalInput);
  }catch(e){r.error=e.message;}return r;
 });
}
const stamp=r=>r.date+'T'+(r.time?(r.time.length===5?r.time+':00':r.time):'unknown');
export const recordSignature=(id,r)=>JSON.stringify([id,stamp(r),r.parameter,r.unit,r.value,r.temperatureC]);
export function importPreview(state,records,mapping={}){
 const seen=new Set(state.measurements.map(m=>recordSignature(m.fermentationId,m))),at=new Map();
 for(const m of state.measurements){const key=JSON.stringify([m.fermentationId,stamp(m),m.parameter]);at.set(key,true);}
 const present=new Set(),unknown=new Set();
 const rows=records.map(r=>{
  if(r.error)return {...r,kind:'invalid'};
  try{checkReading(r,{imported:true});}catch(error){return {...r,kind:'invalid',error:error.message};}
  const b=state.fermentations.find(b=>b.id===mapping[r.sample]||(!mapping[r.sample]&&[b.number,...(b.aliases??[])].some(v=>v&&wineKey(v)===wineKey(r.sample))));
  if(!b){unknown.add(r.sample);return {...r,kind:'unknown'};}
  present.add(b.id);const signature=recordSignature(b.id,r),key=JSON.stringify([b.id,stamp(r),r.parameter]);
  const kind=seen.has(signature)?'duplicate':r.status?'flagged':at.has(key)?'conflict':'new';seen.add(signature);at.set(key,true);
  return {...r,fermentationId:b.id,tankId:b.tankId,kind};
 });
 return {rows,unknown:[...unknown],missing:state.fermentations.filter(b=>!b.completed&&!present.has(b.id))};
}
export function applyCSV(state,source,records,mapping,selected,{makeId=()=>crypto.randomUUID(),createdAt=new Date().toISOString()}={}){
 const preview=importPreview(state,records,mapping),chosen=preview.rows.filter(r=>selected.includes(r.row));
 if(chosen.some(r=>!['new','conflict','flagged'].includes(r.kind)))throw Error('Auswahl enthält ungültige, doppelte oder nicht zugeordnete Messungen.');
 const importId=makeId(),measurements=chosen.map(r=>({id:makeId(),tankId:r.tankId,fermentationId:r.fermentationId,date:r.date,time:r.time,parameter:r.parameter,unit:r.unit,value:r.value,originalInput:r.originalInput,temperatureC:r.temperatureC,temperatureOriginalInput:r.temperatureOriginalInput,method:r.method,technique:'density',wineType:'unknown',origin:'csv',sourceId:null,createdAt,importId,csvRow:r.row}));
 // A report may also record a file containing only duplicates/invalid rows.
 const report={...source,id:importId,createdAt,selectedRows:chosen.map(r=>r.row),decisions:preview.rows.map(r=>({row:r.row,kind:r.kind,fermentationId:r.fermentationId??null})),missing:preview.missing.map(b=>b.id)};
 return {...state,measurements:[...state.measurements,...measurements],csvImports:[...state.csvImports,report]};
}
export function validateCSVImports(state){
 const imports=state.csvImports??[],ids=new Set(),parsed=new Map();
 for(const s of imports){
  if(!s||typeof s.id!=='string'||ids.has(s.id)||typeof s.name!=='string'||typeof s.originalText!=='string'||s.originalText.length>4000000||typeof s.bytesBase64!=='string'||s.bytesBase64.length>6000000||!['utf-8','windows-1252'].includes(s.encoding)||!Array.isArray(s.selectedRows)||!Array.isArray(s.decisions)||!Array.isArray(s.missing)||!Number.isFinite(Date.parse(s.createdAt)))throw Error('Ungültiger CSV-Importbericht.');
  ids.add(s.id);const text=new TextDecoder(s.encoding).decode(Uint8Array.from(atob(s.bytesBase64),c=>c.charCodeAt(0)));if(text!==s.originalText)throw Error('CSV-Originalbytes und Text stimmen nicht überein.');parsed.set(s.id,new Map(parseDMA(text).map(r=>[r.row,r])));
 }
 for(const m of state.measurements.filter(m=>m.origin==='csv')){
  const s=imports.find(s=>s.id===m.importId),r=s&&parsed.get(s.id)?.get(m.csvRow);
  if(!r||r.error||!s.selectedRows.includes(m.csvRow)||r.originalInput!==m.originalInput||r.value!==m.value||r.date!==m.date||r.time!==m.time||r.unit!==m.unit||r.parameter!==m.parameter||r.temperatureOriginalInput!==m.temperatureOriginalInput||r.temperatureC!==m.temperatureC)throw Error('CSV-Messung stimmt nicht mit dem gespeicherten Original überein.');
 }
}
