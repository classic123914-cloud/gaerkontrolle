// SPDX-License-Identifier: GPL-3.0-only
import {splitTracks,techniqueLabel,latestSugar} from './measurement-tracks.js';
import {unitLabel,isOechsle,formatUnitValue} from './units.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors={density:'#2466a3',refractometer:'#a75d08',other:'#286747',unknown:'#737373'};
const fmt=(v,d=2)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(v);
export function trackChartHTML(state,measurements,parameter,unit,selected='all'){
 const rows=measurements.filter(m=>m.parameter===parameter&&m.unit===unit),tracks=splitTracks(rows).filter(t=>selected==='all'||t.key===selected);
 const data=tracks.flatMap(t=>t.measurements).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
 if(!data.length)return '<p class="hint">Für diese Messgröße, Einheit und Spur liegen noch keine Werte vor.</p>';
 const stamp=m=>Date.parse(m.date+'T'+(m.time?(m.time.length===5?m.time+':00':m.time):'00:00:00')+'Z'),start=Math.min(...data.map(stamp)),end=Math.max(...data.map(stamp));
 let min=Math.min(...data.map(m=>m.value)),max=Math.max(...data.map(m=>m.value));const pad=max===min?Math.max(unit==='nD'?.00001:['g/mL','d20/20'].includes(unit)?.001:1,Math.abs(min)*.001):(max-min)*.15;min-=pad;max+=pad;
 const point=m=>({x:start===end?325:64+(stamp(m)-start)/(end-start)*546,y:155-(m.value-min)/(max-min)*130});
 const legend=tracks.map(t=>`<span class="track-${t.key}">${esc(t.label)} (${t.measurements.length})</span>`).join(' · ');
 return `<p class="track-legend">${legend}</p><svg viewBox="0 0 660 210" role="img" aria-label="${esc(parameter)} in ${esc(unitLabel(unit))}, getrennt nach Messverfahren">${[0,1,2].map(i=>`<line class="grid" x1="64" x2="610" y1="${25+i*65}" y2="${25+i*65}"/><text x="4" y="${29+i*65}">${fmt(max-i*(max-min)/2,isOechsle(unit)?0:unit==='nD'?5:['g/mL','d20/20'].includes(unit)?4:2)}</text>`).join('')}${tracks.map(t=>{const sorted=[...t.measurements].sort((a,b)=>stamp(a)-stamp(b));return `<polyline fill="none" stroke="${colors[t.key]}" stroke-width="2.5" ${t.key==='refractometer'?'stroke-dasharray="6 4"':''} points="${sorted.map(m=>{const p=point(m);return `${p.x},${p.y}`;}).join(' ')}"/>${sorted.map(m=>{const p=point(m),s=parameter==='Restzucker · Analyse'?{originalInput:m.originalInput,method:m.method}:latestSugar(state,m.id),title=`${m.date} ${m.time} · ${techniqueLabel(m)} · ${formatUnitValue(m.value,unit,m.originalInput)} ${unitLabel(unit)} · Restzucker Analyse: ${s?s.originalInput+' g/L ('+s.method+')':'nicht erfasst'} · Restzucker berechnet: nicht verfügbar`;return `${t.key==='refractometer'?`<path class="track-ref-marker" d="M ${p.x} ${p.y-8} l 8 8 -8 8 -8 -8 Z" fill="none" stroke="${colors[t.key]}" stroke-width="2"><title>${esc(title)}</title></path>`:`<circle class="track-${t.key}-marker" cx="${p.x}" cy="${p.y}" r="4" fill="${colors[t.key]}"><title>${esc(title)}</title></circle>`}`;}).join('')}`;}).join('')}<text x="64" y="190">${esc(data[0].date)}</text><text x="610" y="190" text-anchor="end">${esc(data.at(-1).date)}</text><text x="610" y="15" text-anchor="end">${esc(unitLabel(unit))}</text></svg><p class="hint">${data.length} Originalwerte. Linien verbinden nur Werte derselben Messspur und Einheit. Durchgezogen: Dichte · gestrichelt: Refraktometer. Keine Restzuckerberechnung aus Gärwerten.</p>`;
}
export function sugarChartHTML(state,tankId){
 const seen=new Set(),rows=[];
 for(const m of state.measurements.filter(m=>m.tankId===tankId)){
  const a=latestSugar(state,m.id);if(!a||seen.has(a.id))continue;seen.add(a.id);rows.push({...m,id:'sugar-'+a.id,parameter:'Restzucker · Analyse',unit:'g/L',value:a.value,originalInput:a.originalInput,technique:'other',method:a.method});
 }
 if(!rows.length)return '<p class="hint">Noch keine Restzuckeranalyse zugeordnet. Pro Messung über „Analyse eintragen“ ergänzen. Berechnete Restzuckerwerte sind noch nicht verfügbar.</p>';
 return trackChartHTML({...state,sugarAnalyses:[]},rows,'Restzucker · Analyse','g/L','other').replace('Keine Restzuckerberechnung aus Gärwerten.','Analysewerte sind dem Probenzeitpunkt zugeordnet; Analysedatum und Quelle stehen in der Tabelle. Berechnete Werte sind noch nicht verfügbar.');
}
