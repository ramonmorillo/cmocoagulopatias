export type Dimension='demographic'|'clinical'|'pharmacotherapeutic'|'social';
export type Pathology='ha'|'hb'|'vw';
export type Option={value:string;label:string;points:number};
export type Variable={id:string;number:number;name:string;description:string;dimension:Dimension;options:Option[];appliesTo?:Pathology[];interview?:boolean;optional?:boolean;multi?:boolean};
const yn=(points:number):Option[]=>[{value:'no',label:'No',points:0},{value:'yes',label:'Sí',points}];
export const DIMENSIONS:Record<Dimension,string>={demographic:'Demográfica',clinical:'Clínica',pharmacotherapeutic:'Farmacoterapéutica',social:'Sociosanitaria'};
export const PATHOLOGIES:Record<Pathology,string>={ha:'Hemofilia A',hb:'Hemofilia B',vw:'Enfermedad de von Willebrand'};
export const PRIORITY_CUTS={priority3Max:19,priority2Max:27} as const;
export const MODEL:Variable[]=[
 {id:'age',number:1,name:'Edad',description:'Modelo exclusivo para población adulta (≥18 años).',dimension:'demographic',options:[{value:'18-50',label:'18–50 años',points:1},{value:'over50',label:'Mayor de 50 años',points:2}]},
 {id:'obesity',number:2,name:'Peso / obesidad',description:'IMC ≥30 kg/m².',dimension:'demographic',options:yn(1),interview:true},
 {id:'inhibitors',number:3,name:'Inhibidores FVIII/FIX',description:'Presencia de inhibidores frente a FVIII o FIX.',dimension:'clinical',options:yn(3),appliesTo:['ha','hb']},
 {id:'pain',number:4,name:'Dolor',description:'Intensidad y relación con sangrado o daño articular.',dimension:'clinical',options:[{value:'none',label:'Sin dolor relevante',points:0},{value:'mild',label:'Dolor leve/moderado',points:1},{value:'chronic',label:'Persistente por daño articular crónico',points:2},{value:'acute',label:'Agudo por hemartrosis/hematoma con hemorragia activa',points:3}]},
 {id:'joint_health',number:5,name:'Estado / salud articular',description:'Artropatía, contracturas, deformidades, discapacidad o prótesis relacionadas.',dimension:'clinical',options:yn(3)},
 {id:'bleed_severity',number:6,name:'Gravedad según tipo de hemorragia',description:'Puntuación original: el manejo ambulatorio/domiciliario puntúa 3.',dimension:'clinical',options:[{value:'none',label:'Sin criterio',points:0},{value:'hospital',label:'Requiere ingreso hospitalario',points:2},{value:'outpatient',label:'Manejo ambulatorio o domiciliario',points:3}]},
 {id:'hemophilia_severity',number:7,name:'Gravedad de hemofilia',description:'Según actividad FVIII:C o FIX:C.',dimension:'clinical',appliesTo:['ha','hb'],options:[{value:'mild',label:'Leve: >5% y <40%',points:0},{value:'moderate',label:'Moderada: 1–5%',points:1},{value:'severe',label:'Grave: <1%',points:3}]},
 {id:'vw_severity',number:8,name:'Gravedad de enfermedad de von Willebrand',description:'Clasificación por tipo.',dimension:'clinical',appliesTo:['vw'],options:[{value:'type1',label:'Tipo 1',points:0},{value:'type2',label:'Tipo 2',points:1},{value:'type3',label:'Tipo 3',points:3}]},
 {id:'bleeds',number:9,name:'Número de hemorragias',description:'Más de 2 espontáneas/año que requirieron tratamiento.',dimension:'clinical',options:yn(4)},
 {id:'comorbidities_joint',number:10,name:'Comorbilidades y patología articular degenerativa',description:'Seleccione de forma independiente todas las situaciones documentadas.',dimension:'clinical',multi:true,options:[{value:'comorbidities',label:'Comorbilidades relevantes',points:1},{value:'degenerative_joint',label:'Patología articular degenerativa',points:2}]},
 {id:'psychological',number:11,name:'Problemas psicológicos',description:'Ansiedad, depresión u otros problemas de salud mental.',dimension:'clinical',options:yn(3),interview:true},
 {id:'route',number:12,name:'Vía de administración',description:'Vía del tratamiento actual.',dimension:'pharmacotherapeutic',options:[{value:'other',label:'Otras / no aplicable',points:0},{value:'both',label:'Subcutánea + intravenosa',points:1},{value:'iv',label:'Intravenosa',points:2}]},
 {id:'regimen_changes',number:13,name:'Cambios desde última dispensación',description:'Cambios en dosis, pauta o dosis adicionales.',dimension:'pharmacotherapeutic',options:[{value:'none',label:'Sin cambios',points:0},{value:'dose',label:'Cambio de dosis o pauta',points:2},{value:'extra',label:'Dosis adicionales/modificación puntual',points:3}]},
 {id:'home_delivery',number:14,name:'Dispensación domiciliaria',description:'Entrega en domicilio u oficina de farmacia sin visita presencial.',dimension:'pharmacotherapeutic',options:yn(1)},
 {id:'prophylaxis',number:15,name:'Régimen profiláctico',description:'Profilaxis primaria, secundaria o terciaria.',dimension:'pharmacotherapeutic',options:yn(3)},
 {id:'nonadherence',number:16,name:'Falta de adherencia',description:'Adherencia o persistencia subóptima según dispensaciones/HCE.',dimension:'pharmacotherapeutic',options:yn(4),interview:true},
 {id:'socioeconomic',number:17,name:'Entorno familiar / situación socioeconómica',description:'Condiciones desfavorables, aislamiento, dependencia o ausencia de apoyo.',dimension:'social',options:yn(3),interview:true},
 {id:'lifestyle',number:18,name:'Estilo de vida',description:'Puede registrar simultáneamente actividad física intensa y riesgo cardiovascular.',dimension:'social',multi:true,interview:true,options:[{value:'intense',label:'Actividad física intensa',points:1},{value:'cv_risk',label:'Uno o más factores de riesgo cardiovascular',points:2}]},
 {id:'access',number:19,name:'Dificultades de acceso hospitalario',description:'Viajes, dependencia, recursos, comorbilidades u organización.',dimension:'social',options:yn(2)},
 {id:'knowledge',number:20,name:'Conocimiento limitado de la enfermedad',description:'Puede afectar al autocuidado o las decisiones.',dimension:'social',options:yn(3),interview:true},
 {id:'transition',number:21,name:'Transición pediátrico-adulto',description:'Paciente en transición al ámbito adulto.',dimension:'social',options:yn(4)},
 {id:'quality_life',number:22,name:'Calidad de vida (variable adicional)',description:'Baja calidad de vida según SF-36, EQ-5D, Haemo-QoL-A u otro cuestionario validado. No formó parte del pretest de los puntos de corte.',dimension:'social',options:yn(1),optional:true}
];
export const applicableVariables=(pathology?:Pathology)=>MODEL.filter(v=>!v.appliesTo||(pathology&&v.appliesTo.includes(pathology)));
