// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
export const OE_DE='°Oe DE';
export const OE_JUICE='°Oe Saft';
export const MUST_UNITS=[OE_DE,OE_JUICE,'°Brix','°Oe','KMW'];
export const PREFERRED_MUST_UNITS=[OE_DE,OE_JUICE,'°Brix'];
export const DENSITY_UNITS=['d20/20','g/mL','kg/m³'];
// Keep a previously chosen laboratory unit available without offering it to new users.
export const densityEntryUnits=current=>current==='kg/m³'?['g/mL','d20/20','kg/m³']:['g/mL','d20/20'];
export const JUICE_CONVERSION_VERSION='metas-brix-oe-20c-v1';
export const DE_CONVERSION_VERSION='user-de-plus-2-working-rule-v1';
export const UNIT_LABELS={
 [OE_DE]:'°Oe · Traubenmost-Skala (Deutsch)',
 [OE_JUICE]:'°Oe · Saftskala',
 '°Oe':'°Oe · bisherige Angabe / Skala offen',
 nD:'nD · Brechungsindex', '°Brix':'°Brix',KMW:'KMW',
 'd20/20':'d20/20 · Dichteverhältnis (Labor)',
 'g/mL':'g/mL', 'kg/m³':'kg/m³',
};
export const unitLabel=unit=>UNIT_LABELS[unit]??unit;
export const defaultPreferences=()=>({language:'de',configured:false,mustUnit:OE_DE,oeScale:'de',densityUnit:'g/mL',alcoholDisplay:'both',refractionUnit:'nD'});
export function validatePreferences(p){
 if(p?.language!==undefined&&!['de','en','fr','es','pt','el'].includes(p.language))throw Error('Ungültige Sprache.');
 if(!p||typeof p.configured!=='boolean'||!PREFERRED_MUST_UNITS.includes(p.mustUnit)||!['de','juice'].includes(p.oeScale)||!DENSITY_UNITS.includes(p.densityUnit)||!['both','% vol','g/L'].includes(p.alcoholDisplay))throw Error('Ungültige Einheiten-Vorgaben.');
 if((p.mustUnit===OE_DE&&p.oeScale!=='de')||(p.mustUnit===OE_JUICE&&p.oeScale!=='juice'))throw Error('Mostgewichts-Einheit und Oechsle-Skala passen nicht zusammen.');
 return p;
}
function finite(value){if(!Number.isFinite(value))throw Error('Bitte eine gültige Zahl eingeben.');}
// Canton Valais / METAS: 20 °C, 0–40 °Brix; do not extrapolate.
export function brixToJuiceOe(brix,temperature=20){
 finite(brix);
 if(temperature!==20)throw Error('Brix-Umrechnung nur bei Bezugstemperatur 20 °C; keine Temperaturkorrektur.');
 if(brix<0||brix>40)throw Error('Saftskala: Umrechnung nur von 0 bis 40 °Brix.');
 return 3.86572*brix+0.0132283*brix*brix+0.0000462881*brix*brix*brix;
}
export function brixToOe(brix,scale,temperature=20){
 if(!['de','juice'].includes(scale))throw Error('Bitte die Oechsle-Skala auswählen.');
 const value=brixToJuiceOe(brix,temperature)+(scale==='de'?2:0);
 // A fixed +2 offset is the user's stated working convention, not a validated GER instrument curve.
 if(scale==='de'&&(value<30||value>140))throw Error('Die +2-Arbeitsregel wird nur im technischen Bereich 30–140 °Oe angeboten; keine allgemeine Gerätekennlinie.');
 return {value,unit:scale==='de'?OE_DE:OE_JUICE,scale,conversionVersion:scale==='de'?DE_CONVERSION_VERSION:JUICE_CONVERSION_VERSION,status:scale==='de'?'working-rule':'published-formula'};
}
export function oeToBrix(oe,scale,temperature=20){
 finite(oe);
 if(!['de','juice'].includes(scale))throw Error('Bitte die Oechsle-Skala auswählen.');
 if(scale==='de'&&(oe<30||oe>140))throw Error('Deutsche +2-Arbeitsregel nur im technischen Bereich 30–140 °Oe.');
 const target=oe-(scale==='de'?2:0),max=brixToJuiceOe(40,temperature);
 if(target<0||target>max)throw Error('Wert außerhalb der Saftformel für 0–40 °Brix.');
 let low=0,high=40;
 for(let i=0;i<60;i++){const mid=(low+high)/2;if(brixToJuiceOe(mid,temperature)<target)low=mid;else high=mid;}
 return (low+high)/2;
}
export function resolveMostWeight(input,brixScale){
 finite(input?.value);
 if(input.unit==='°Brix')return brixToOe(input.value,brixScale);
 if(!['°Oe',OE_DE,OE_JUICE].includes(input.unit))throw Error('Diese Mostgewichts-Einheit ist für die Prognose noch nicht freigegeben.');
 return {value:input.value,unit:input.unit,scale:input.unit===OE_DE?'de':input.unit===OE_JUICE?'juice':'unspecified',conversionVersion:null,status:'entered-value'};
}
export const formatAlcoholGL=value=>{finite(value);return new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(value);};

export const isOechsle=unit=>[OE_DE,OE_JUICE,'°Oe'].includes(unit);
export const formatUnitValue=(value,unit,original=String(value))=>isOechsle(unit)?new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(value):original;
