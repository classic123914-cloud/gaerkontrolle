// SPDX-License-Identifier: GPL-3.0-only
import {numberInput} from './domain-v1.js';
import {checkReading} from './measurement-entry.js';
const small={null:0,eins:1,ein:1,eine:1,einen:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10,elf:11,zwölf:12,dreizehn:13,vierzehn:14,fünfzehn:15,sechzehn:16,siebzehn:17,achtzehn:18,neunzehn:19,zwanzig:20,dreißig:30,vierzig:40,fünfzig:50,sechzig:60,siebzig:70,achtzig:80,neunzig:90};
function wordNumber(word){
 if(Object.hasOwn(small,word))return small[word];
 const compound=word.match(/^(.+)und(.+)$/);if(compound&&small[compound[1]]>0&&small[compound[1]]<10&&small[compound[2]]>=20)return small[compound[1]]+small[compound[2]];
 for(const [name,factor] of [['tausend',1000],['hundert',100]])if(word.includes(name)){const parts=word.split(name);if(parts.length!==2)return null;const left=parts[0]?wordNumber(parts[0]):1,right=parts[1]?wordNumber(parts[1]):0;if(left!==null&&right!==null)return left*factor+right;}
 return null;
}
export function parseSpokenReading(input){
 if(typeof input!=='string'||input.length>1000)throw Error('Bitte eine einzelne Messung eingeben.');
 let text=input.normalize('NFC').toLocaleLowerCase('de-DE').replace(/\b[\p{L}]+\b/gu,word=>{const n=wordNumber(word);return n===null?word:String(n);});
 text=text.replace(/\bminus\s+/g,'-').replace(/(\d+)\s+komma\s+((?:\d+\s*)+)/g,(_,whole,fraction)=>whole+','+fraction.replace(/\s/g,''));
 const tanks=[...text.matchAll(/\b(?:tank|behälter)\s*(?:nummer\s*)?([\p{L}]*[\s-]*\d+[\p{L}\d./_-]*)/gu)];
 if(tanks.length!==1)throw Error('Genau eine Tanknummer nennen, z. B. „Tank 12“.');
 const units='(?:°?\\s*(?:oechsle|öchsle|oe)|°?\\s*brix|(?:g|gramm)\\s*(?:/|pro)\\s*(?:ml|milliliter|cm³|cm3))';
 const values=[...text.matchAll(new RegExp('([+-]?\\d+(?:[.,]\\d+)?)\\s*('+units+')(?=$|[\\s,;.!])','gu'))];
 if(values.length!==1)throw Error('Genau einen Messwert mit Einheit nennen, z. B. „82 Oechsle“.');
 const temperatures=[...text.matchAll(/([+-]?\d+(?:[.,]\d+)?)\s*(?:grad(?:\s*celsius)?|°\s*c)(?=$|[\s,;.!])/gu)];
 if(temperatures.length>1)throw Error('Nur eine Temperatur pro Messung nennen.');
 const unit=/brix/.test(values[0][2])?'°Brix':/^g/.test(values[0][2])?'g/mL':'°Oe';
 const originalInput=values[0][1],temperatureOriginalInput=temperatures[0]?.[1]??'';
 checkReading({unit,value:numberInput(originalInput),temperatureC:temperatureOriginalInput?numberInput(temperatureOriginalInput):null});
 return {number:tanks[0][1].trim().replace(/\s+/g,' ').toUpperCase(),unit,originalInput,temperatureOriginalInput};
}
