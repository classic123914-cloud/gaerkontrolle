// SPDX-License-Identifier: GPL-3.0-only
// Three-way record merge. Divergent edits never silently overwrite each other.
export const SYNC_COLLECTIONS=['tanks','measurements','corrections','calculations','sources','volumeReadings','memos','photos','sugarAnalyses','sugarCalculations','fermentations','csvImports'];
const canonical=v=>v===undefined?'undefined':JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
const same=(a,b)=>canonical(a)===canonical(b);
function choose(base,local,remote,path,conflicts){
 if(same(local,remote))return local;
 if(same(local,base))return remote;
 if(same(remote,base))return local;
 conflicts.push({path,base:structuredClone(base),local:structuredClone(local),remote:structuredClone(remote)});return local;
}
export function mergeSyncStates(base,local,remote){
 if(!base||!local||!remote||base.schemaVersion!==local.schemaVersion||local.schemaVersion!==remote.schemaVersion)throw Error('Sicherungsversionen stimmen nicht überein.');
 const result=structuredClone(local),conflicts=[];
 for(const name of SYNC_COLLECTIONS){
  if(![base[name],local[name],remote[name]].some(Array.isArray))continue;
  const maps=[base,local,remote].map(s=>new Map((s[name]??[]).map(item=>[item.id,item]))),ids=new Set(maps.flatMap(m=>[...m.keys()]));result[name]=[];
  for(const id of ids){const item=choose(maps[0].get(id),maps[1].get(id),maps[2].get(id),`${name}/${id}`,conflicts);if(item!==undefined)result[name].push(structuredClone(item));}
 }
 result.preferences={};for(const key of new Set([base,local,remote].flatMap(s=>Object.keys(s.preferences??{})))){
  const value=choose(base.preferences?.[key],local.preferences?.[key],remote.preferences?.[key],`preferences/${key}`,conflicts);if(value!==undefined)result.preferences[key]=structuredClone(value);
 }
 return {state:result,conflicts};
}
export function applySyncResolution(merge,resolutions){
 const state=structuredClone(merge.state);
 for(const conflict of merge.conflicts){const pick=resolutions[conflict.path];if(!['local','remote'].includes(pick))throw Error('Alle Synchronisationskonflikte müssen geprüft werden.');const [collection,id]=conflict.path.split('/'),value=conflict[pick];
  if(collection==='preferences'){if(value===undefined)delete state.preferences[id];else state.preferences[id]=structuredClone(value);}
  else{state[collection]=state[collection].filter(item=>item.id!==id);if(value!==undefined)state[collection].push(structuredClone(value));}
 }return state;
}
