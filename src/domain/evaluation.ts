import {Answers,Source} from './scoring'; import {MODEL,Pathology} from '../data/stratificationModel';
export const SCHEMA_VERSION=2;
export type Evaluation={schemaVersion:number;general:{hospital:string;pharmacist:string;patientId:string;date:string;pathology?:Pathology};hce:string;answers:Answers;sources:Record<string,Source>;suggestions:unknown[];professional:{enabled:boolean;priority:1|2;reason:string};selectedInterventions:string[];customInterventions:string[];nextDate:string;motivation:Record<string,string>;opportunity:Record<string,string>;observations:string;report:string};
const today=()=>new Date().toISOString().slice(0,10);
export function createEmptyEvaluation():Evaluation{return{schemaVersion:SCHEMA_VERSION,general:{hospital:'',pharmacist:'',patientId:'',date:today()},hce:'',answers:{},sources:{},suggestions:[],professional:{enabled:false,priority:2,reason:''},selectedInterventions:[],customInterventions:[],nextDate:'',motivation:{pharmacotherapeutic:'',clinical:'',quality:'',habits:'',skills:'',barriers:'',facilitators:'',plan:'',stage:''},opportunity:{modality:'',channel:'',tools:'',preferences:'',digitalBarriers:'',telemonitoring:''},observations:'',report:''}}
export function resetEvaluation(){return createEmptyEvaluation()}
/** Normaliza el esquema anterior antes de validarlo, sin mutar el objeto importado. */
export function migrateEvaluation(x:unknown):unknown{
 if(!x||typeof x!=='object')return x;
 const e=structuredClone(x) as Partial<Evaluation>;
 if(e.schemaVersion!==1)return e;
 const answers={...(e.answers??{})};
 const combined:string[]=[];
 if(answers.comorbidities==='yes')combined.push('comorbidities');
 if(answers.degenerative_joint==='yes')combined.push('degenerative_joint');
 delete answers.comorbidities;delete answers.degenerative_joint;
 if(combined.length)answers.comorbidities_joint=combined;
 const sources={...(e.sources??{})};
 if(combined.length)sources.comorbidities_joint=sources.comorbidities??sources.degenerative_joint??'Manual';
 delete sources.comorbidities;delete sources.degenerative_joint;
 return{...e,schemaVersion:SCHEMA_VERSION,answers,sources};
}
export function isValidEvaluation(x:unknown):x is Evaluation{
 if(!x||typeof x!=='object')return false;const e=x as Partial<Evaluation>;
 if(e.schemaVersion!==SCHEMA_VERSION||!e.general||!e.answers||typeof e.answers!=='object'||!e.sources||typeof e.sources!=='object'||!e.motivation||!e.opportunity||!Array.isArray(e.selectedInterventions)||!Array.isArray(e.suggestions)||!e.professional)return false;
 return Object.entries(e.answers).every(([id,value])=>{if(id==='advanced_therapy')return value==='yes'||value==='no';const variable=MODEL.find(v=>v.id===id);if(!variable)return false;const values=Array.isArray(value)?value:[value];return (variable.multi||!Array.isArray(value))&&values.every(v=>typeof v==='string'&&variable.options.some(o=>o.value===v));});
}
