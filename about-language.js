import {applyLanguage} from './i18n.js';
let language='de';try{language=JSON.parse(localStorage.getItem('kellerwirtschaft.v1'))?.preferences?.language??'de';}catch{}
applyLanguage(language);
