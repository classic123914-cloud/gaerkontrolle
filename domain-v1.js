// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {predictNaturalAlcohol,correctedAlcohol,MODEL_VERSION} from './calculations.js';
export const UNITS = ['°Oe','d20/20','g/mL','kg/m³','°Brix','KMW','°C','g/L','% vol'];
export const CORRECTION_UNITS = ['g/L Alkohol','Prozentpunkte vol'];
export const newState = () => ({schemaVersion:1,tanks:[],measurements:[],corrections:[],calculations:[],sources:[]});
export function numberInput(input) {
  if (typeof input !== 'string' || !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(input.trim())) throw Error('Bitte eine gültige Zahl eingeben.');
  const value = Number(input.trim().replace(',','.'));
  if (!Number.isFinite(value)) throw Error('Zahl liegt außerhalb des gültigen Bereichs.');
  return value;
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
function ensure(ok,message) { if (!ok) throw Error(message); }
export function validateState(s) {
  ensure(s && s.schemaVersion === 1,'Unbekannte Sicherungsversion.');
  for (const key of ['tanks','measurements','corrections','calculations','sources']) ensure(Array.isArray(s[key]),'Unvollständige Sicherung: ' + key);
  ensure(s.tanks.length <= 10000 && s.measurements.length <= 100000,'Sicherung enthält zu viele Datensätze.');
  const ids = new Set();
  for (const item of [...s.tanks,...s.measurements,...s.corrections,...s.calculations]) {
    ensure(item && typeof item.id === 'string' && item.id.length > 0 && item.id.length < 100 && !ids.has(item.id),'Ungültige oder doppelte Kennung.'); ids.add(item.id);
  }
  const tanks = new Set(s.tanks.map(t=>t.id));
  ensure(new Set(s.tanks.map(t=>String(t.name).trim().toLocaleLowerCase('de-DE'))).size===s.tanks.length,'Tanknummer / Bezeichnung ist bereits vorhanden.');
  for (const t of s.tanks) {
    ensure(typeof t.name === 'string' && t.name.trim().length > 0 && t.name.length <= 100,'Ungültiger Tankname.');
    ensure(typeof t.note === 'string' && t.note.length <= 2000,'Ungültige Tanknotiz.');
    ensure(t.capacityL === null || (Number.isFinite(t.capacityL) && t.capacityL > 0),'Ungültiges Tankvolumen.');
  }
  for (const m of s.measurements) {
    ensure(tanks.has(m.tankId),'Messwert ohne zugehörigen Tank.');
    ensure(validDate(m.date),'Ungültiges Messdatum.');
    ensure(UNITS.includes(m.unit) && Number.isFinite(m.value),'Ungültiger Messwert oder unbekannte Einheit.');
    ensure(typeof m.originalInput === 'string' && numberInput(m.originalInput) === m.value,'Originaleingabe und Messwert stimmen nicht überein.');
    ensure(m.origin === 'manual','Unbekannte Messwertquelle.');
    ensure(typeof m.parameter==='string' && ['Mostgewicht','Dichte','Temperatur','Gesamtsäure','Alkohol (Analyse)'].includes(m.parameter),'Ungültige Messgröße.');
    const compatible={Mostgewicht:['°Oe','°Brix','KMW'],Dichte:['d20/20','g/mL','kg/m³'],Temperatur:['°C'],Gesamtsäure:['g/L'],'Alkohol (Analyse)':['% vol','g/L']};
    ensure(compatible[m.parameter].includes(m.unit),'Messgröße und Einheit passen nicht zusammen.');
    ensure(typeof m.time==='string' && (m.time===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time)),'Ungültige Messzeit.');
    ensure(typeof m.method==='string' && m.method.length<=200,'Ungültige Messmethode.');
    ensure(m.temperatureC===null||Number.isFinite(m.temperatureC),'Ungültige Temperatur.');
    ensure(typeof m.createdAt==='string'&&!Number.isNaN(Date.parse(m.createdAt)),'Ungültiger Erfassungszeitpunkt.');
    ensure(typeof m.temperatureOriginalInput==='string' && (m.temperatureC===null?m.temperatureOriginalInput.trim()==='':numberInput(m.temperatureOriginalInput)===m.temperatureC),'Ungültige Originaltemperatur.');
  }
  for (const c of s.corrections) {
    ensure(tanks.has(c.tankId) && CORRECTION_UNITS.includes(c.unit) && Number.isFinite(c.value),'Ungültige persönliche Korrektur.');
    ensure(typeof c.originalInput === 'string' && numberInput(c.originalInput) === c.value,'Ungültiger Originalwert der Korrektur.');
  }
  ensure(new Set(s.corrections.map(c=>c.tankId)).size === s.corrections.length,'Mehrere Korrekturen für einen Tank.');
  for (const c of s.calculations) {
    ensure(tanks.has(c.tankId)&&c.modelVersion===MODEL_VERSION&&typeof c.createdAt==='string'&&!Number.isNaN(Date.parse(c.createdAt)),'Ungültige Prognose.');
    ensure(numberInput(c.inputs.oe.originalInput)===c.inputs.oe.value && numberInput(c.inputs.initialAcid.originalInput)===c.inputs.initialAcid.value,'Ungültige Prognose-Ausgangswerte.');
    ensure(c.inputs.oe.unit==='°Oe' && c.inputs.initialAcid.unit==='g/L','Ungültige Ausgangseinheiten.');
    const result=predictNaturalAlcohol({oe:c.inputs.oe.value,initialAcid:c.inputs.initialAcid.value,fermentation:c.inputs.fermentation});
    if(c.correction!==null) ensure(CORRECTION_UNITS.includes(c.correction?.unit)&&numberInput(c.correction.originalInput)===c.correction.value,'Ungültiger Korrekturstand.');
    const corrected=correctedAlcohol(result.alcoholGL,c.correction);
    ensure(Math.abs(c.base?.alcoholGL-result.alcoholGL)<1e-9&&Math.abs(c.base?.alcoholVol-result.alcoholVol)<1e-9&&Math.abs(c.corrected?.alcoholGL-corrected.alcoholGL)<1e-9&&Math.abs(c.corrected?.alcoholVol-corrected.alcoholVol)<1e-9,'Prognose stimmt nicht mit dem hinterlegten Modell überein.');
  }
  ensure(s.sources.length === 0,'Dokumentimporte sind in dieser Version noch nicht verfügbar.');
  return s;
}
export function deleteTank(state,id) {
  return {...state,tanks:state.tanks.filter(t=>t.id!==id),measurements:state.measurements.filter(m=>m.tankId!==id),corrections:state.corrections.filter(c=>c.tankId!==id),calculations:state.calculations.filter(c=>c.tankId!==id)};
}
export function series(state,tankId,unit) {
  return state.measurements.filter(m=>m.tankId===tankId && m.unit===unit).sort((a,b)=>a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}
