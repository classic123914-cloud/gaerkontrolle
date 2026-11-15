// SPDX-License-Identifier: GPL-3.0-only
import {wineReadings} from './fermentations.js';
import {currentVolume,currentMemo} from './domain.js';
export function fermentationSummary(state,wine){
 const rows=wineReadings(state,wine.id),primary=rows.filter(m=>['Mostgewicht','Dichte','Lichtbrechung'].includes(m.parameter)).at(-1);
 const temperature=rows.filter(m=>m.parameter==='Temperatur'||m.temperatureC!==null&&Number.isFinite(m.temperatureC)).at(-1);
 return {last:rows.at(-1),primary,temperature:temperature?{...temperature,value:temperature.parameter==='Temperatur'?temperature.value:temperature.temperatureC}:null,volume:currentVolume(state,wine.tankId),variety:wine.variety??(wine.id==='f-'+wine.tankId?currentMemo(state,wine.tankId)?.variety:'')??''};
}
