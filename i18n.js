// SPDX-License-Identifier: GPL-3.0-only
import {LANGUAGES,translate,translationNotice} from './translations.js';
let currentLanguage='de',observer;
const flagArt={
 de:'<path fill="#171717" d="M0 0h30v10H0z"/><path fill="#d00" d="M0 10h30v10H0z"/><path fill="#ffce00" d="M0 20h30v10H0z"/>',
 en:'<path fill="#012169" d="M0 0h30v30H0z"/><path stroke="white" stroke-width="7" d="m0 0 30 30M30 0 0 30"/><path stroke="#c8102e" stroke-width="3" d="m0 0 30 30M30 0 0 30"/><path stroke="white" stroke-width="10" d="M15 0v30M0 15h30"/><path stroke="#c8102e" stroke-width="6" d="M15 0v30M0 15h30"/>',
 fr:'<path fill="#002395" d="M0 0h10v30H0z"/><path fill="white" d="M10 0h10v30H10z"/><path fill="#ed2939" d="M20 0h10v30H20z"/>',
 es:'<path fill="#aa151b" d="M0 0h30v30H0z"/><path fill="#f1bf00" d="M0 7.5h30v15H0z"/><path fill="#aa151b" d="M9 12h5v7H9z"/><path fill="#fff" d="M10 13h3v3h-3z"/>',
 pt:'<path fill="#006600" d="M0 0h12v30H0z"/><path fill="#f00" d="M12 0h18v30H12z"/><circle cx="12" cy="15" r="6" fill="#ffdf00"/><path fill="#fff" stroke="#c00" stroke-width="2" d="M9 11h6v6q-3 5-6 0z"/>',
 el:'<path fill="#0d5eaf" d="M0 0h30v30H0z"/><path stroke="white" stroke-width="3.33" d="M0 5h30M0 11.67h30M0 18.33h30M0 25h30"/><path fill="#0d5eaf" d="M0 0h17v17H0z"/><path stroke="white" stroke-width="3.33" d="M8.33 0v17M0 8.33h17"/>'
};
function flag(code){return `<svg class="language-flag" viewBox="0 0 30 30" aria-hidden="true">${flagArt[code]}</svg>`;}
function updatePicker(){
 const current=document.querySelector('#language-current');
 if(current&&current.dataset.language!==currentLanguage){current.innerHTML=flag(currentLanguage)+`<span class="language-current-name">${LANGUAGES.find(([code])=>code===currentLanguage)[1]}</span>`;current.dataset.language=currentLanguage;}
 for(const button of document.querySelectorAll('[data-language]'))if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.language===currentLanguage));
}
const originals=new WeakMap(), originalPlaceholders=new WeakMap();
const protectedContent='[translate="no"],input,textarea,script,style,pre,code,.tank-item strong,.tank-item span,.tank-facts dd,#memo-view-content,#container-source-text,#measurements td:nth-child(3)';
export function languageCode(value){return LANGUAGES.some(([code])=>code===value)?value:'de';}
export function applyLanguage(language=currentLanguage){
 currentLanguage=languageCode(language);
 if(typeof document==='undefined')return;
 observer?.disconnect();
 document.documentElement.lang=currentLanguage;
 if(document.querySelector('.brand'))document.title=translate('Gärkontrolle-App',currentLanguage);
 // Preserve implicit option values before translating their visible labels.
 for(const option of document.querySelectorAll('option:not([value])'))option.value=option.textContent;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  if(!node.parentElement||node.parentElement.closest(protectedContent))continue;
  let record=originals.get(node);
  if(!record||node.nodeValue!==record.last)record={source:node.nodeValue,last:node.nodeValue};
  const source=record.source,key=source.trim(),output=translate(key,currentLanguage);
  record.last=output===key?source:source.slice(0,source.indexOf(key))+output+source.slice(source.indexOf(key)+key.length);
  if(node.nodeValue!==record.last)node.nodeValue=record.last;
  originals.set(node,record);
 }
 for(const element of document.querySelectorAll('[placeholder],[aria-label],[title],[alt]')){
  if(element.closest('[translate="no"]'))continue;
  let records=originalPlaceholders.get(element);if(!records){records={};originalPlaceholders.set(element,records);}
  for(const attr of ['placeholder','aria-label','title','alt']){
   if(!element.hasAttribute(attr))continue;
   const value=element.getAttribute(attr);let record=records[attr];
   if(!record||record.last!==value)record={source:value,last:value};
   record.last=translate(record.source,currentLanguage);if(value!==record.last)element.setAttribute(attr,record.last);records[attr]=record;
  }
 }
 updatePicker();
 const notice=document.querySelector('#language-notice');if(notice){notice.hidden=true;notice.textContent='';}
 observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title','alt']});
}
export function setupLanguages({language,onChange,onError}){
 const picker=document.querySelector('#language-picker'),options=document.querySelector('#language-options');
 options.innerHTML=LANGUAGES.map(([code,label])=>`<button type="button" data-language="${code}" lang="${code}" aria-pressed="false">${flag(code)}<span>${label}</span><span class="language-check" aria-hidden="true">✓</span></button>`).join('');
 options.addEventListener('click',event=>{
  const button=event.target.closest('button[data-language]');if(!button)return;
  const previous=currentLanguage;
  try{onChange(button.dataset.language);applyLanguage(button.dataset.language);picker.open=false;picker.querySelector('summary').focus();}
  catch(error){applyLanguage(previous);onError(error.message);}
 });
 document.addEventListener('click',event=>{if(!picker.contains(event.target))picker.open=false;});
 picker.addEventListener('keydown',event=>{if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus();}});
 observer=new MutationObserver(()=>applyLanguage());
 applyLanguage(language);
}
