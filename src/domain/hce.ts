import {MODEL} from '../data/stratificationModel';
export type Suggestion={variableId:string;value:string;evidence:string};
const rules:{id:string;value:string;pattern:RegExp}[]=[
 {id:'age',value:'minor',pattern:/\b(?:1[0-7]|[0-9])\s*años\b/i},{id:'advanced_therapy',value:'yes',pattern:/terapia\s+g[eé]nica|valoctocogene|etranacogene/i},
 {id:'inhibitors',value:'yes',pattern:/inhibidor(?:es)?\s+(?:positivo|presente|frente)/i},{id:'bleeds',value:'yes',pattern:/(?:[3-9]|\d{2,})\s+(?:hemorragias|sangrados).*año/i},
 {id:'psychological',value:'yes',pattern:/\b(ansiedad|depresi[oó]n)\b/i},{id:'nonadherence',value:'yes',pattern:/\b(no adherente|falta de adherencia|adherencia sub[oó]ptima)\b/i},
 {id:'home_delivery',value:'yes',pattern:/dispensaci[oó]n domiciliaria/i},{id:'transition',value:'yes',pattern:/transici[oó]n pedi[aá]tric[oa].*adult/i},
 {id:'route',value:'iv',pattern:/\b(intravenos[oa]|v[ií]a IV)\b/i},{id:'prophylaxis',value:'yes',pattern:/\bprofilaxis\b/i}
];
export function analyzeClinicalText(text:string):Suggestion[]{if(!text.trim())return[];return rules.flatMap(r=>{const m=text.match(r.pattern);return m&&MODEL.some(v=>v.id===r.id)?[{variableId:r.id,value:r.value,evidence:m[0]}]:[]})}
