// SPDX-License-Identifier: GPL-3.0-only
export const VIEWS=['tanks','entry','data','curves','settings'];
export function tankPage(tanks,query='',page=0,size=20){
 const key=query.normalize('NFC').trim().toLocaleLowerCase();
 const filtered=tanks.filter(t=>[t.number,t.name].some(v=>String(v).normalize('NFC').toLocaleLowerCase().includes(key)));
 const pages=Math.max(1,Math.ceil(filtered.length/size)),index=Math.min(Math.max(0,page),pages-1);
 return {rows:filtered.slice(index*size,(index+1)*size),index,pages,total:filtered.length};
}
export function showWorkspace(view){
 const active=VIEWS.includes(view)?view:'tanks';
 document.body.dataset.view=active;
 for(const panel of document.querySelectorAll('[data-views]'))panel.hidden=!panel.dataset.views.split(' ').includes(active);
 for(const button of document.querySelectorAll('[data-view-button]')){
  if(button.dataset.viewButton===(active==='data'?'entry':active))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
 return active;
}
