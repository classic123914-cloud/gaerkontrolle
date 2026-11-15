// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
export const TANK_MIME='application/x-kellerbuch-tank';
export const MEMO_MIME='application/x-kellerbuch-memo';
export function setupDragDrop({getState,onTank,onMemo,onFile,message}){
 document.addEventListener('dragstart',event=>{
  const source=event.target.closest('[data-drag-tank],[data-drag-memo]');if(!source||!event.dataTransfer)return;
  if(source.dataset.dragTank)event.dataTransfer.setData(TANK_MIME,source.dataset.dragTank);
  if(source.dataset.dragMemo)event.dataTransfer.setData(MEMO_MIME,source.dataset.dragMemo);
  event.dataTransfer.effectAllowed='copy';
 });
 document.addEventListener('dragover',event=>{
  const target=event.target.closest('[data-drop-target]');if(target){event.preventDefault();target.classList.add('drag-over');if(event.dataTransfer)event.dataTransfer.dropEffect='copy';}
  else if(event.dataTransfer?.types.includes('Files'))event.preventDefault();
 });
 document.addEventListener('dragleave',event=>event.target.closest('[data-drop-target]')?.classList.remove('drag-over'));
 document.addEventListener('drop',event=>{
  const target=event.target.closest('[data-drop-target]');
  if(!target){if(event.dataTransfer?.files.length){event.preventDefault();message('Foto bitte in einen der gekennzeichneten Fotoeingänge ziehen.',true);}return;}
  event.preventDefault();target.classList.remove('drag-over');
  const files=Array.from(event.dataTransfer?.files??[]);
  if(files.length){if(files.length!==1){message('Bitte jeweils genau ein Foto hineinziehen.',true);return;}onFile(target.dataset.dropTarget,files[0]);return;}
  const tankId=event.dataTransfer?.getData(TANK_MIME),memoId=event.dataTransfer?.getData(MEMO_MIME);
  if(tankId&&getState().tanks.some(t=>t.id===tankId))onTank(tankId);
  else if(memoId&&getState().memos.some(m=>m.id===memoId))onMemo(memoId);
 });
}
