// SPDX-License-Identifier: GPL-3.0-only
export const OCR_LANGUAGES=Object.freeze({de:{code:'deu',name:'Deutsch'},en:{code:'eng',name:'English'},fr:{code:'fra',name:'Français'},es:{code:'spa',name:'Español'},pt:{code:'por',name:'Português'},el:{code:'ell',name:'Ελληνικά'}});
export const ocrLanguage=language=>Object.hasOwn(OCR_LANGUAGES,language)?language:'de';
export const ocrModel=language=>OCR_LANGUAGES[ocrLanguage(language)].code;
export const ocrLanguageOptions=language=>Object.entries(OCR_LANGUAGES).map(([value,{name}])=>`<option value="${value}" ${value===ocrLanguage(language)?'selected':''}>${name}</option>`).join('');
