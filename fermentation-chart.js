// SPDX-License-Identifier: GPL-3.0-only
import {unitLabel,isOechsle,formatUnitValue} from './units.js';
export const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const readingTime=m=>Date.parse(m.date+'T'+(m.time?(m.time.length===5?m.time+':00':m.time):'00:00:00')+'Z');
export function chartRange(rows){const times=rows.map(readingTime).filter(Number.isFinite);if(!times.length)return null;const day=86400000,start=Math.floor(Math.min(...times)/day)*day;return {start,end:Math.max(start+21*day,Math.ceil(Math.max(...times)/day)*day)};}
const nf=(v,d=1)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(v);
export function fermentationChart(rows,{unit,large=false}={}){
 const candidates=rows.filter(m=>['Mostgewicht','Dichte','Lichtbrechung'].includes(m.parameter));
 unit=unit??candidates.find(m=>m.parameter==='Mostgewicht')?.unit??candidates[0]?.unit;
 const primary=candidates.filter(m=>m.unit===unit),temps=rows.flatMap(m=>m.temperatureC!==null&&Number.isFinite(m.temperatureC)?[{...m,value:m.temperatureC}]:m.parameter==='Temperatur'?[m]:[]);
 const range=chartRange([...primary,...temps]);if(!range)return '<p class="hint">Noch keine Messungen.</p>';
 const v=primary.map(m=>m.value),oe=isOechsle(unit),low=oe?Math.min(-10,Math.floor(Math.min(...v)/10)*10):Math.floor(Math.min(...v,1)*100)/100,high=oe?Math.max(100,Math.ceil(Math.max(...v)/10)*10):Math.max(low+.01,Math.ceil(Math.max(...v,1.1)*100)/100);
 const tmin=Math.min(8,...temps.map(m=>Math.floor(m.value/4)*4)),tmax=Math.max(32,...temps.map(m=>Math.ceil(m.value/4)*4));
 const x=m=>50+(readingTime(m)-range.start)/(range.end-range.start)*300,y=(v,lo,hi)=>155-(v-lo)/(hi-lo)*125;
 const points=(rs,lo,hi)=>[...rs].sort((a,b)=>readingTime(a)-readingTime(b)).map(m=>`${x(m)},${y(m.value,lo,hi)}`).join(' ');
 const methodNames={density:'Dichtemessung',refractometer:'Refraktometer (Lichtbrechung)',other:'Anderes Verfahren',unknown:'Messverfahren nicht zugeordnet'};
 const methods=[...new Set(primary.map(m=>m.technique??'unknown'))];
 const quantity=primary[0]?.parameter??'Messwert',shortUnit=oe?'°Oe':unit??'';
 let svg=`<svg viewBox="0 0 410 225" role="img" aria-label="${html(quantity)} in ${html(shortUnit)} links, Temperatur in °C rechts; Datum auf der waagerechten Achse"><text class="axis-left" x="50" y="15">${html(quantity)} (${html(shortUnit)})</text><text class="axis-right" x="350" y="15" text-anchor="end">Temperatur (°C)</text>`;
 for(let i=0;i<4;i++){const yy=30+i*125/3;svg+=`<line x1="50" x2="350" y1="${yy}" y2="${yy}" stroke="#d4d8de"/><text class="axis-left" x="43" y="${yy+4}" text-anchor="end">${nf(high-i*(high-low)/3,oe?0:unit==='nD'?5:3)}</text><text class="axis-right" x="358" y="${yy+4}">${nf(tmax-i*(tmax-tmin)/3,0)}</text>`;}
 svg+='<line class="axis-left-line" x1="50" x2="50" y1="30" y2="155"/><line class="axis-right-line" x1="350" x2="350" y1="30" y2="155"/>';
 for(const method of ['density','refractometer','other','unknown']){
  const rs=primary.filter(m=>(m.technique??'unknown')===method);if(!rs.length)continue;
  svg+=`<polyline points="${points(rs,low,high)}" fill="none" stroke="#185990" stroke-width="2" ${method==='refractometer'?'stroke-dasharray="5 3"':method==='density'?'':'stroke-dasharray="1 3"'}/>`;
  svg+=rs.map(m=>`<circle cx="${x(m)}" cy="${y(m.value,low,high)}" r="3" fill="#185990"><title>${html(m.date+' '+(m.time||'')+' · '+formatUnitValue(m.value,m.unit,m.originalInput)+' '+unitLabel(m.unit)+' · '+methodNames[m.technique??'unknown'])}</title></circle>`).join('');
 }
 svg+=`<polyline points="${points(temps,tmin,tmax)}" fill="none" stroke="#a42d32" stroke-width="2"/>`+temps.map(m=>`<rect x="${x(m)-2}" y="${y(m.value,tmin,tmax)-2}" width="4" height="4" fill="#a42d32"><title>${html(m.date+' '+(m.time||'')+' · '+nf(m.value)+' °C')}</title></rect>`).join('');
 const date=t=>new Date(t).toISOString().slice(5,10).split('-').reverse().join('.');
 const startYear=new Date(range.start).getUTCFullYear(),endYear=new Date(range.end).getUTCFullYear();
 for(let i=0;i<=3;i++){const xx=50+i*100,t=range.start+(range.end-range.start)*i/3;svg+=`<line x1="${xx}" x2="${xx}" y1="155" y2="160" stroke="#59636d"/><text x="${xx}" y="178" text-anchor="${i===0?'start':i===3?'end':'middle'}">${date(t)}</text>`;}
 svg+=`<text x="200" y="203" text-anchor="middle">Datum (Tag.Monat) · ${startYear===endYear?startYear:startYear+'–'+endYear}</text></svg>`;

 return `<p class="chart-method">${html(quantity)} · ${methods.map(m=>html(methodNames[m])).join(' / ')}</p>`+svg+`<p class="chart-method">${methods.map(m=>(m==='density'?'━':m==='refractometer'?'┄':'···')+' '+html(methodNames[m])).join(' · ')}</p>`+`<p class="chart-key"><span>● ${html(unitLabel(unit))}</span> · <span>▪ Temperatur rechts</span>${new Set(candidates.map(m=>m.unit)).size>1?' · weitere Originaleinheiten in Detailansicht':''}</p>`;
}
