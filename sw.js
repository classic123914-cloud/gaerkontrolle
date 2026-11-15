// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Vinora contributors
const CACHE='keller-shell-v64';
const FILES=["./handy-einrichten.html","./dictation-round.js","./dictation-round-ui.js","./update-check.js","./measurement-entry.js","./measurement-edit-ui.js","./overview.js","./speech-reading.js","./speech-reading-ui.js","./","./index.html","./references/tabellen.png","./references/weinrecht.png","./about.html","./LICENSE.txt","./styles.css","./app.js","./reading-photo.js","./pdf-reading.js","./vendor/pdf/pdf.js","./vendor/pdf/pdf.worker.js","./fermentations.js","./fermentation-chart.js","./cockpit-ui.js","./csv-import.js","./workspace.js","./initial-reading.js","./domain.js","./domain-v2.js","./units.js","./domain-v3.js","./domain-v4.js","./domain-v5.js","./measurement-tracks.js","./measurement-tracks-ui.js","./track-chart.js","./container-list.js","./container-list-ui.js","./refractive-table.js","./refraction.js","./refraction-ui.js","./preferences-ui.js","./cellar-helper.js","./i18n.js","./translations.js","./translations-extra.js","./about-language.js","./help/refraktometer-d.png","./help/refraktometer-saft.png","./domain-v1.js","./tank-ui.js","./photo-store.js","./drag-drop.js","./scanner.js","./ocr-languages.js","./table-ocr.js","./image-crop.js","./scan-domain.js","./calculations.js","./storage.js","./manifest.webmanifest","./icon.svg","./scan-icon.svg","./icon-192.png","./icon-512.png","./vendor/ocr/core/tesseract-core-lstm.wasm","./vendor/ocr/core/tesseract-core-lstm.wasm.js","./vendor/ocr/core/tesseract-core-simd-lstm.wasm","./vendor/ocr/core/tesseract-core-simd-lstm.wasm.js","./vendor/ocr/core/tesseract-core-simd.wasm","./vendor/ocr/core/tesseract-core-simd.wasm.js","./vendor/ocr/core/tesseract-core.wasm","./vendor/ocr/core/tesseract-core.wasm.js","./vendor/ocr/lang/eng.traineddata.gz","./vendor/ocr/lang/deu.traineddata.gz","./vendor/ocr/lang/fra.traineddata.gz","./vendor/ocr/lang/spa.traineddata.gz","./vendor/ocr/lang/por.traineddata.gz","./vendor/ocr/lang/ell.traineddata.gz","./vendor/ocr/tesseract.min.js","./vendor/ocr/worker.min.js"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('keller-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin) return;
  const request=event.request;
  if(new URL(request.url).pathname.endsWith('/app-version.json')){event.respondWith(fetch(request,{cache:'no-store'}));return;}
  event.respondWith(fetch(request,{cache:'no-store'}).then(async response=>{
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==='navigate'){const shell=await caches.match(new URL('./index.html',self.location.origin).href);if(shell)return shell;}
    return Response.error();
  }));
});
