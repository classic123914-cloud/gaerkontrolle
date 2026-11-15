// SPDX-License-Identifier: GPL-3.0-only
// Keep the same preview URL fresh when a mobile browser restores an old tab.
(() => {
  // Older running preview servers can serve static files without the revision API.
  async function currentRevision(){
    if(initialRevision){
      const response=await fetch('./app-version.json',{cache:'no-store'});
      if(response.ok)return (await response.json()).revision;
    }
    const shell=await fetch('./sw.js',{cache:'no-store'});
    if(!shell.ok)throw Error('Keine Verbindung zur App.');
    const source=await shell.text();
    const paths=[...new Set(['./index.html',...Array.from(source.matchAll(/"(\.\/[^"\n]+\.(?:js|css|html))"/g),m=>m[1]).filter(p=>!p.includes('/vendor/'))])].sort();
    const files=await Promise.all(paths.map(async path=>{
      const file=await fetch(path,{cache:'no-store'});if(!file.ok)throw Error('App nicht vollständig erreichbar.');
      return path+'\n'+await file.text();
    }));
    // Compare the exact sources; no secure-context-only browser APIs are required.
    return source+'\n'+files.join('\n');
  }
  const initialRevision=document.querySelector('meta[name="app-revision"]')?.content;
  const baseline=initialRevision?Promise.resolve(initialRevision):currentRevision().catch(()=>null);
  let checking=false,dirty=false;
  document.addEventListener('input',()=>{dirty=true;});
  async function check(){
    if(checking||document.hidden)return;
    checking=true;
    try{
      const revision=await baseline;
      if(!revision||await currentRevision()===revision)return;
      if(!dirty&&!document.querySelector('dialog[open]')){location.reload();return;}
      if(document.querySelector('#app-update-notice'))return;
      const notice=document.createElement('div');notice.id='app-update-notice';notice.className='card';notice.setAttribute('role','status');
      const text=document.createElement('p');text.textContent='Eine aktualisierte App ist verfügbar. Begonnene Eingaben zuerst speichern.';
      const button=document.createElement('button');button.textContent='Aktualisierte App laden';button.onclick=()=>location.reload();
      notice.append(text,button);document.querySelector('main').prepend(notice);
    }catch{/* The locally saved app remains usable without a connection. */}
    finally{checking=false;}
  }
  window.addEventListener('pageshow',check);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',check);
})();
