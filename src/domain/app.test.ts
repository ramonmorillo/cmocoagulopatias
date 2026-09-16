import {describe,expect,it} from 'vitest';
import {applyMandatoryRules,calculateDimensionScores,calculateScore,determineFinalPriority,determinePriorityByScore,pointsFor} from './scoring';
import {analyzeClinicalText} from './hce';
import {createEmptyEvaluation,isValidEvaluation,migrateEvaluation,resetEvaluation} from './evaluation';
import {generateReport} from './report';
import {applicableVariables,MODEL} from '../data/stratificationModel';
import {retainValidInterventions,recommendedInterventions} from '../data/interventions';

const value=(text:string,id:string)=>analyzeClinicalText(text,'ha').find(x=>x.variableId===id)?.value;

describe('reglas clínicas',()=>{
  it.each([[0,3],[1,3],[19,3],[20,2],[27,2],[28,1],[40,1]])('score %i → P%i',(score,p)=>expect(determinePriorityByScore(score)).toBe(p));
  it.each([
    [10,'no',3],[10,'yes',1],[20,'no',2],[28,'no',1],
  ] as const)('score %i y terapia avanzada %s → P%i',(score,advanced,priority)=>{
    // Isolate the special-rule contract while the cut-off itself is tested above.
    const mandatory=applyMandatoryRules({advanced_therapy:advanced});
    expect(mandatory.priority??determinePriorityByScore(score)).toBe(priority);
  });
  it('terapia avanzada confirmada obliga P1',()=>expect(determineFinalPriority({age:'18-50',advanced_therapy:'yes'},'ha').final).toBe(1));
  it('criterio profesional solo eleva P3 a P2',()=>expect(determineFinalPriority({age:'18-50'},'ha',{enabled:true,priority:2,reason:'Complejidad'}).final).toBe(2));
  it('criterio profesional no reduce P1',()=>expect(determineFinalPriority({advanced_therapy:'yes'},'ha',{enabled:true,priority:2,reason:'No reducir'}).final).toBe(1));
  it('cambiar respuesta actualiza score',()=>expect(calculateScore({age:'over50'},'ha')).toBeGreaterThan(calculateScore({age:'18-50'},'ha')));
});

describe('negación contextual de HCE',()=>{
  it.each(['No recibe terapia génica.','Sin terapia avanzada.','No está en tratamiento con terapia avanzada.','No candidato a terapia génica.','Se descarta terapia génica.','Nunca ha recibido terapia génica.'])('%s no sugiere terapia avanzada positiva',text=>expect(value(text,'advanced_therapy')).not.toBe('yes'));
  it.each(['Actualmente en tratamiento con terapia génica.','Recibe etranacogene dezaparvovec.','Tratado con valoctocogene roxaparvovec.','Inicia terapia avanzada.'])('%s sugiere terapia avanzada positiva',text=>expect(value(text,'advanced_therapy')).toBe('yes'));
  it('extrae inhibidores negados',()=>expect(value('No presenta inhibidores frente a FVIII.','inhibitors')).toBe('no'));
  it('extrae inhibidores presentes',()=>expect(value('Presenta inhibidores frente a FVIII.','inhibitors')).toBe('yes'));
  it('no convierte una negación psicológica en positivo',()=>expect(value('No presenta ansiedad ni depresión.','psychological')).toBe('no'));
  it('extrae ansiedad presente',()=>expect(value('Presenta ansiedad.','psychological')).toBe('yes'));
});

describe('extracción clínica completa',()=>{
  const clinical=`Paciente de 58 años con hemofilia A grave.
Antecedentes de artropatía hemofílica crónica en ambas rodillas y tobillo derecho, con dolor articular persistente de intensidad moderada. Presenta prótesis de rodilla izquierda secundaria a daño articular por sangrados previos.
Durante el último año ha presentado 3 hemartrosis espontáneas que han requerido tratamiento en domicilio, sin necesidad de ingreso hospitalario.
No constan inhibidores frente al factor VIII.
Tratamiento actual profiláctico con factor VIII administrado por vía intravenosa. Desde la última dispensación se realizó un ajuste de dosis por aumento de actividad física.
No recibe terapia génica ni otras terapias avanzadas.
El registro de dispensación muestra una adherencia aproximada del 85%, con varias administraciones omitidas en los últimos meses.
Antecedentes de hipertensión arterial y tabaquismo activo. IMC 31 kg/m².
Refiere ansiedad relacionada con los episodios hemorrágicos.
Vive a 90 km del hospital y presenta dificultades para acudir presencialmente a las consultas, aunque dispone de apoyo familiar adecuado.
El paciente refiere conocimientos limitados sobre el manejo de hemorragias y sobre cuándo debe contactar con el hospital.
Actualmente recibe la medicación mediante dispensación domiciliaria.
No se dispone en la historia clínica de información reciente sobre calidad de vida mediante cuestionarios validados.`;
  const suggestions=analyzeClinicalText(clinical,'ha');
  const get=(id:string)=>suggestions.find(s=>s.variableId===id)?.value;
  it.each([
    ['age','over50'],['obesity','yes'],['inhibitors','no'],['pain','chronic'],['joint_health','yes'],
    ['bleed_severity','outpatient'],['hemophilia_severity','severe'],['bleeds','yes'],
    ['psychological','yes'],['advanced_therapy','no'],['route','iv'],['regimen_changes','dose'],
    ['home_delivery','yes'],['prophylaxis','yes'],['nonadherence','yes'],['access','yes'],['knowledge','yes'],
  ])('extrae %s = %s',(id,expected)=>expect(get(id)).toBe(expected));
  it('extrae comorbilidad en la variable combinada',()=>expect(suggestions).toContainEqual(expect.objectContaining({variableId:'comorbidities_joint',value:'comorbidities'})));
  it('extrae riesgo cardiovascular como estilo de vida',()=>expect(suggestions).toContainEqual(expect.objectContaining({variableId:'lifestyle',value:'cv_risk'})));
  it('no genera terapia avanzada positiva',()=>expect(suggestions).not.toContainEqual(expect.objectContaining({variableId:'advanced_therapy',value:'yes'})));
  it('no inventa calidad de vida ante ausencia de información',()=>expect(get('quality_life')).toBeUndefined());
  it('respeta variables aplicables a patología',()=>expect(analyzeClinicalText('Hemofilia grave. EVW tipo 3.','ha').some(s=>s.variableId==='vw_severity')).toBe(false));
});

describe('seguridad del estado',()=>{
  it('reset queda totalmente limpio',()=>{const dirty=createEmptyEvaluation();dirty.hce='dato';dirty.answers.advanced_therapy='yes';dirty.sources.advanced_therapy='Manual';dirty.suggestions=[{x:1}];dirty.professional.enabled=true;expect(resetEvaluation()).toMatchObject({hce:'',answers:{},sources:{},suggestions:[],professional:{enabled:false,reason:''},report:'',selectedInterventions:[]})});
  it('informe siempre coincide con estado actual',()=>{const e=createEmptyEvaluation();e.general.pathology='ha';e.answers.age='18-50';expect(generateReport(e)).toContain('Puntuación total: 1');e.answers.age='over50';expect(generateReport(e)).toContain('Puntuación total: 2')});
  it('HCE sin información mantiene variable pendiente',()=>expect(analyzeClinicalText('Paciente estable.','ha').some(x=>x.variableId==='nonadherence')).toBe(false));
});

describe('variables condicionales',()=>{
  it('hemofilia no muestra EVW',()=>{const ids=applicableVariables('ha').map(x=>x.id);expect(ids).toContain('hemophilia_severity');expect(ids).not.toContain('vw_severity')});
  it('EVW no muestra gravedad hemofilia',()=>{const ids=applicableVariables('vw').map(x=>x.id);expect(ids).toContain('vw_severity');expect(ids).not.toContain('hemophilia_severity')});
});


describe('modelo adulto y variables agrupadas',()=>{
  it('edad conserva únicamente las dos opciones adultas y sus puntos',()=>{const age=MODEL.find(v=>v.id==='age')!;expect(age.options.map(o=>[o.value,o.points])).toEqual([['18-50',1],['over50',2]]);expect(age.options.some(o=>o.value==='minor')).toBe(false)});
  it('calidad de vida puntúa en la dimensión sociosanitaria',()=>{expect(calculateDimensionScores({quality_life:'yes'},'ha').social).toBe(1);expect(calculateDimensionScores({quality_life:'yes'},'ha').clinical).toBe(0)});
  it.each([[['comorbidities'],1],[['degenerative_joint'],2],[['comorbidities','degenerative_joint'],3]] as const)('comorbilidades/artropatía %j → %i puntos',(answer,score)=>expect(pointsFor('comorbidities_joint',[...answer])).toBe(score));
  it('terapia avanzada no añade puntos pero obliga P1',()=>{expect(calculateScore({advanced_therapy:'yes'},'ha')).toBe(0);expect(determineFinalPriority({advanced_therapy:'yes'},'ha').final).toBe(1)});
  it('sin terapia avanzada, 10 puntos mantienen P3',()=>expect(applyMandatoryRules({advanced_therapy:'no'}).priority??determinePriorityByScore(10)).toBe(3));
  it('la puntuación máxima combinada conserva los tres puntos',()=>expect(pointsFor('comorbidities_joint',['comorbidities','degenerative_joint'])).toBe(3));
});

describe('selección manual de intervenciones',()=>{
  it('calcular P3 no selecciona intervenciones',()=>{const e=createEmptyEvaluation();determineFinalPriority(e.answers,'ha');expect(e.selectedInterventions).toEqual([])});
  it('cambiar P3 a P2 no selecciona automáticamente',()=>{const e=createEmptyEvaluation();e.selectedInterventions=retainValidInterventions(e.selectedInterventions,2);expect(e.selectedInterventions).toEqual([])});
  it('un cambio de prioridad solo conserva selecciones todavía válidas',()=>{const p3=recommendedInterventions(3)[0].id;const p2=recommendedInterventions(2).find(i=>i.priority===2)!.id;expect(retainValidInterventions([p3,p2],3)).toEqual([p3])});
});

describe('compatibilidad de evaluaciones',()=>{
  it('migra comorbilidades y artropatía del esquema 1',()=>{const old={...createEmptyEvaluation(),schemaVersion:1,answers:{comorbidities:'yes',degenerative_joint:'yes'},sources:{comorbidities:'Manual',degenerative_joint:'Manual'}};const migrated=migrateEvaluation(old);expect(isValidEvaluation(migrated)).toBe(true);expect((migrated as ReturnType<typeof createEmptyEvaluation>).answers.comorbidities_joint).toEqual(['comorbidities','degenerative_joint'])});
});
