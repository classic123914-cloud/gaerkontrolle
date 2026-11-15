// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
export const MODEL_VERSION='schandelmaier-2026-11-01-v1';
export const ETHANOL_GL_PER_VOL_PERCENT=7.8924; // OIV: pure ethanol at 20 °C = 789.24 g/L
export const WATER_DENSITY_20_KGM3=998.203; // OIV-MA-BS-01, true density in vacuo
function finite(value) { if (!Number.isFinite(value)) throw Error('Bitte endliche Zahlen eingeben.'); }
export function convertMustWeightDensity(value,from,to,temperature=20) {
  finite(value);
  if (temperature!==20) throw Error('Nur Werte mit Bezugstemperatur 20 °C; keine Temperaturkorrektur.');
  const units=['°Oe','d20/20','g/mL','kg/m³'];
  if (!units.includes(from)||!units.includes(to)) throw Error('Diese Einheitenumrechnung wird nicht unterstützt.');
  const relative=from==='°Oe'?1+value/1000:from==='d20/20'?value:value*(from==='g/mL'?1000:1)/WATER_DENSITY_20_KGM3;
  if (relative<1 || relative>1.2) throw Error('Umrechnung nur für unvergorenen Most von 0 bis 200 °Oe (d20/20 1 bis 1,2).');
  return to==='°Oe'?(relative-1)*1000:to==='d20/20'?relative:relative*WATER_DENSITY_20_KGM3/(to==='g/mL'?1000:1);
}
export function alcoholToVol(value) { finite(value); return value/ETHANOL_GL_PER_VOL_PERCENT; }
export function predictNaturalAlcohol({oe,initialAcid,fermentation='must'}) {
  finite(oe); finite(initialAcid);
  if (oe<0||oe>200||initialAcid<0||initialAcid>50) throw Error('Eingabe außerhalb des technischen Bereichs (0–200 °Oe, 0–50 g/L Säure).');
  if (!['must','mash'].includes(fermentation)) throw Error('Unbekannte Gärungsart.');
  const effectiveOe=oe-(fermentation==='mash'?4:0);
  const alcoholGL=(2.63*effectiveOe-24)*0.475+(8-initialAcid)/2;
  if (alcoholGL<0) throw Error('Formel ergibt einen negativen Alkoholwert; keine sinnvolle Prognose für diese Eingaben.');
  return {alcoholGL,alcoholVol:alcoholToVol(alcoholGL),effectiveOe,modelVersion:MODEL_VERSION};
}
export function correctedAlcohol(alcoholGL,correction) {
  finite(alcoholGL);
  if (!correction) return {alcoholGL,alcoholVol:alcoholToVol(alcoholGL)};
  finite(correction.value);
  if (!['g/L Alkohol','Prozentpunkte vol'].includes(correction.unit)) throw Error('Unbekannte Korrektureinheit.');
  const result=alcoholGL+correction.value*(correction.unit==='Prozentpunkte vol'?ETHANOL_GL_PER_VOL_PERCENT:1);
  if (result<0) throw Error('Korrektur ergibt einen negativen Alkoholwert.');
  return {alcoholGL:result,alcoholVol:alcoholToVol(result)};
}
export function applyPersonalCorrection(base,correction) {
  if (!Number.isFinite(base?.value) || !Number.isFinite(correction?.value)) throw Error('Ungültige Korrekturwerte.');
  const sameUnit = (base.unit === '% vol' && correction.unit === 'Prozentpunkte vol') || (base.unit === 'g/L Alkohol' && correction.unit === 'g/L Alkohol');
  if (!sameUnit) throw Error('Einheitenumrechnung der Alkoholkorrektur ist bis zur fachlichen Freigabe gesperrt.');
  return {value:base.value+correction.value,unit:base.unit};
}
