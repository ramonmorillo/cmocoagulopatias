import {applicableVariables,Pathology} from '../data/stratificationModel';

export type Suggestion={
  variableId:string;
  value:string;
  evidence:string;
  confidence:'explicit'|'review';
};

type Candidate=Omit<Suggestion,'evidence'> & {pattern:RegExp;negative?:RegExp};

const negationPrefix='(?:no(?:\\s+\\w+){0,4}|sin|nunca(?:\\s+ha)?|se\\s+descarta|no\\s+candidat[oa])';
const isNegated=(sentence:string,concept:RegExp)=>new RegExp(`${negationPrefix}[^.;,]{0,45}(?:${concept.source})`,'i').test(sentence);
const sentences=(text:string)=>text.replace(/\r/g,' ').split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);

function firstSentence(parts:string[],pattern:RegExp){return parts.find(s=>pattern.test(s));}
function add(out:Suggestion[],applicable:Set<string>,s:Suggestion){
  const isMulti=s.variableId==='lifestyle';
  if(applicable.has(s.variableId)&&!out.some(x=>x.variableId===s.variableId&&(!isMulti||x.value===s.value)))out.push(s);
}

/** Extracts only findings supported by text. It never treats missing information as “no”. */
export function analyzeClinicalText(text:string,pathology?:Pathology):Suggestion[]{
  if(!text.trim())return[];
  const parts=sentences(text),out:Suggestion[]=[];
  const applicable=new Set(applicableVariables(pathology).map(v=>v.id));
  const suggest=(variableId:string,value:string,evidence:string,confidence:Suggestion['confidence']='explicit')=>add(out,applicable,{variableId,value,evidence,confidence});

  const age=firstSentence(parts,/\b(?:paciente\s+de\s+)?(\d{1,3})\s*a[nñ]os\b/i)?.match(/\b(?:paciente\s+de\s+)?(\d{1,3})\s*a[nñ]os\b/i);
  if(age){const years=Number(age[1]);if(years<=120)suggest('age',years<18?'minor':years<=50?'18-50':'over50',age[0]);}
  const bmi=firstSentence(parts,/\bIMC\s*(?:de|:|=)?\s*\d{2}(?:[.,]\d+)?/i)?.match(/\bIMC\s*(?:de|:|=)?\s*(\d{2}(?:[.,]\d+)?)/i);
  if(bmi)suggest('obesity',Number(bmi[1].replace(',','.'))>=30?'yes':'no',bmi[0]);

  const concepts:{id:string;concept:RegExp;positive:string;negative?:string}[]=[
    {id:'inhibitors',concept:/inhibidor(?:es)?(?:\s+frente\s+(?:al\s+)?(?:factor\s+)?(?:VIII|IX|FVIII|FIX))?/i,positive:'yes',negative:'no'},
    {id:'psychological',concept:/ansiedad|depresi[oó]n|problemas?\s+(?:psicol[oó]gicos?|de\s+salud\s+mental)/i,positive:'yes',negative:'no'},
  ];
  for(const c of concepts){const evidence=firstSentence(parts,c.concept);if(evidence)suggest(c.id,isNegated(evidence,c.concept)&&c.negative?c.negative:c.positive,evidence);}

  const advanced=/terapia\s+(?:g[eé]nica|avanzada)|terapias\s+avanzadas|etranacogene\s+dezaparvovec|valoctocogene\s+roxaparvovec/i;
  const advancedEvidence=firstSentence(parts,advanced);
  if(advancedEvidence)suggest('advanced_therapy',isNegated(advancedEvidence,advanced)?'no':'yes',advancedEvidence);

  const candidates:Candidate[]=[
    {variableId:'pain',value:'acute',pattern:/dolor\s+agudo[^.]{0,45}(?:hemartrosis|hematoma)|(?:hemartrosis|hematoma)[^.]{0,45}dolor\s+agudo/i,confidence:'explicit'},
    {variableId:'pain',value:'chronic',pattern:/dolor[^.]{0,50}(?:persistente|cr[oó]nico)|(?:persistente|cr[oó]nico)[^.]{0,50}dolor/i,confidence:'explicit'},
    {variableId:'pain',value:'mild',pattern:/dolor[^.]{0,25}(?:leve|moderad[oa])/i,confidence:'explicit'},
    {variableId:'joint_health',value:'yes',pattern:/artropat[ií]a|contractura|pr[oó]tesis[^.]{0,35}(?:articular|rodilla|cadera)|deformidad|discapacidad\s+articular/i,confidence:'explicit'},
    {variableId:'degenerative_joint',value:'yes',pattern:/artrosis|osteoartritis|patolog[ií]a\s+articular\s+degenerativa/i,confidence:'explicit'},
    {variableId:'bleed_severity',value:'hospital',pattern:/(?:requiere|required[oa]|precisa)[^.]{0,25}ingreso\s+hospitalario|hospitalizad[oa]\s+por\s+(?:hemorragia|sangrado)/i,confidence:'explicit'},
    {variableId:'bleed_severity',value:'outpatient',pattern:/(?:hemorragia|sangrado|hemartrosis)[^.]{0,80}(?:manejo|tratamiento)\s+(?:ambulatorio|en\s+(?:el\s+)?domicilio)|(?:manejo|tratamiento)\s+(?:ambulatorio|en\s+(?:el\s+)?domicilio)[^.]{0,80}(?:hemorragia|sangrado|hemartrosis)/i,confidence:'explicit'},
    {variableId:'bleeds',value:'yes',pattern:/\b(?:3|[4-9]|\d{2,})\s+(?:hemartrosis|hemorragias|sangrados)[^.]{0,60}(?:espont[aá]ne[oa]s?|(?:[uú]ltimo|pasado)\s+a[nñ]o|anuales)/i,confidence:'explicit'},
    {variableId:'comorbidities',value:'yes',pattern:/\b(?:VIH|VHC|c[aá]ncer|ictus|diabetes|osteoporosis|insuficiencia\s+renal|hipertensi[oó]n\s+arterial)\b/i,confidence:'explicit'},
    {variableId:'route',value:'both',pattern:/subcut[aá]nea[^.]{0,60}intravenos[oa]|intravenos[oa][^.]{0,60}subcut[aá]nea/i,confidence:'explicit'},
    {variableId:'route',value:'iv',pattern:/\b(?:v[ií]a\s+)?intravenos[oa]\b|\bv[ií]a\s+IV\b/i,confidence:'explicit'},
    {variableId:'route',value:'other',pattern:/\b(?:v[ií]a\s+)?(?:oral|intramuscular)\b/i,confidence:'explicit'},
    {variableId:'regimen_changes',value:'dose',pattern:/(?:ajuste|cambio|modificaci[oó]n)\s+(?:de\s+)?(?:dosis|pauta)/i,confidence:'explicit'},
    {variableId:'regimen_changes',value:'extra',pattern:/dosis\s+adicional(?:es)?|modificaci[oó]n\s+puntual/i,confidence:'explicit'},
    {variableId:'home_delivery',value:'yes',pattern:/dispensaci[oó]n\s+domiciliaria|(?:entrega|medicaci[oó]n)[^.]{0,35}(?:en|a)\s+(?:el\s+)?domicilio/i,confidence:'explicit'},
    {variableId:'prophylaxis',value:'yes',pattern:/\b(?:tratamiento\s+)?profil[aá]ctico|\bprofilaxis\b/i,confidence:'explicit'},
    {variableId:'nonadherence',value:'yes',pattern:/no\s+adherente|falta\s+de\s+adherencia|adherencia\s+sub[oó]ptima|administraciones?\s+omitidas?|dosis\s+omitidas?/i,confidence:'explicit'},
    {variableId:'socioeconomic',value:'yes',pattern:/sin\s+apoyo\s+familiar|aislamiento\s+social|situaci[oó]n\s+(?:econ[oó]mica|socioecon[oó]mica)\s+(?:desfavorable|precaria)/i,confidence:'explicit'},
    {variableId:'lifestyle',value:'intense',pattern:/actividad\s+f[ií]sica\s+intensa|deporte\s+(?:intenso|de\s+contacto)/i,confidence:'explicit'},
    {variableId:'lifestyle',value:'cv_risk',pattern:/tabaquismo\s+activo|fumador|hipertensi[oó]n\s+arterial|dislipemia/i,confidence:'explicit'},
    {variableId:'access',value:'yes',pattern:/dificultad(?:es)?\s+(?:para\s+)?(?:acudir|desplazarse|acceso)|vive\s+a\s+\d+\s*km\s+del\s+hospital/i,confidence:'explicit'},
    {variableId:'knowledge',value:'yes',pattern:/conocimientos?\s+(?:limitados?|insuficientes?)|desconoce\s+(?:el\s+)?manejo/i,confidence:'explicit'},
    {variableId:'transition',value:'yes',pattern:/transici[oó]n\s+(?:pedi[aá]tric[oa][^.]{0,20}(?:a|al)\s+)?adult/i,confidence:'explicit'},
    {variableId:'quality_life',value:'yes',pattern:/(?:baja|mala|deterioro\s+de\s+la)\s+calidad\s+de\s+vida|(?:SF-36|EQ-5D|Haemo-QoL-A)[^.]{0,35}(?:baj[oa]|deterior)/i,confidence:'explicit'},
  ];
  for(const c of candidates){const evidence=firstSentence(parts,c.pattern);if(evidence&&!isNegated(evidence,c.pattern))suggest(c.variableId,c.value,evidence,c.confidence);}
  if(!out.some(s=>s.variableId==='nonadherence')){const adherence=firstSentence(parts,/adherencia\s+(?:aproximada\s+)?(?:del?\s+)?\d{1,3}\s*%/i);if(adherence)suggest('nonadherence','yes',adherence,'review');}

  if(pathology==='ha'||pathology==='hb'){
    const severity=firstSentence(parts,/hemofilia\s+[AB]?\s*(?:leve|moderada|grave)|(?:FVIII|FIX|factor\s+(?:VIII|IX))[^.]{0,20}\b\d+(?:[.,]\d+)?\s*%/i);
    if(severity){const level=severity.match(/\b(leve|moderada|grave)\b/i)?.[1].toLowerCase();const amount=severity.match(/\b(\d+(?:[.,]\d+)?)\s*%/)?.[1];const value=level==='grave'?'severe':level==='moderada'?'moderate':level==='leve'?'mild':amount?(Number(amount.replace(',','.'))<1?'severe':Number(amount.replace(',','.'))<=5?'moderate':'mild'):undefined;if(value)suggest('hemophilia_severity',value,severity);}
  }
  if(pathology==='vw'){
    const severity=firstSentence(parts,/(?:enfermedad\s+de\s+von\s+Willebrand|EVW)[^.]{0,30}tipo\s*[123]/i);
    const type=severity?.match(/tipo\s*([123])/i)?.[1];if(severity&&type)suggest('vw_severity',`type${type}`,severity);
  }
  return out;
}
