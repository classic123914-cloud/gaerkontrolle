// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
import {normalizeTankNumber} from './domain.js';
export function candidatesFromText(text){
 if(typeof text!=='string')return [];
 const candidates=[];
 for(const line of text.split(/[\r\n]+/)){
  const trimmed=line.trim();
  if(!trimmed)continue;
  const cleaned=trimmed.replace(/^(?:TANK(?:NUMMER|\s*NR\.?)?|BEH[ÄA]LTER(?:\s*NR\.?)?)\s*[:#-]?\s*/i,'').trim();
  if(cleaned.length<=60&&/[0-9]/.test(cleaned)&&/^[\p{L}\p{M}\p{N}\s./_-]+$/u.test(cleaned))candidates.push(cleaned);
 }
 return [...new Map(candidates.map(c=>[normalizeTankNumber(c),c])).values()].slice(0,20);
}
export function matchingTank(state,number){return state.tanks.find(t=>t.number&&normalizeTankNumber(t.number)===normalizeTankNumber(number))??null;}
