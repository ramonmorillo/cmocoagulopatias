// Adaptador de CMO Coagulopatías al informe único y al flujo común del núcleo CMO (src/cmo-ds/).
// No contiene reglas clínicas: el único motor es determineFinalPriority()/calculateScore() de scoring.ts (sin cambios).
// Aquí solo se calcula información de flujo: variables pendientes, cota superior, modificación profesional
// con justificación reforzada, estado de las actuaciones, informe y saneamiento de importaciones.
import {applicableVariables, DIMENSIONS, MODEL, PATHOLOGIES, type Dimension, type Pathology} from '../data/stratificationModel';
import {INTERVENTIONS, PERIODICITY, recommendedInterventions, type Category} from '../data/interventions';
import {calculateDimensionScores, determineFinalPriority, pointsFor, type Answers, type Priority} from './scoring';
import {createEmptyEvaluation, isValidEvaluation, migrateEvaluation, SCHEMA_VERSION, type Evaluation} from './evaluation';
import {createReport} from '../cmo-ds/cmo-report.js';

export const APP_ID = 'cmo-coagulopatias';
export const TOOL_NAME = 'CMO Coagulopatías Congénitas';
export const DATA_SCHEMA = 'cmo-coagulopatias-evaluation/2';
export const MODEL_NAME = 'SEFH, Adaptación del Modelo de Atención Farmacéutica CMO al paciente con coagulopatías congénitas';
export const MIN_JUSTIFICATION = 12;
export type InterventionStatus = 'planned' | 'done' | 'not_applicable';
const STATUSES: InterventionStatus[] = ['planned', 'done', 'not_applicable'];
const str = (v: unknown, max: number) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

/** Modificación profesional efectiva: solo cuenta con justificación de al menos MIN_JUSTIFICATION caracteres. */
export function effectiveProfessional(e: Pick<Evaluation, 'professional'>) {
  const p = e.professional;
  const reason = p.reason.trim();
  return {enabled: p.enabled && reason.length >= MIN_JUSTIFICATION, priority: p.priority, reason};
}

/** Variables aplicables sin respuesta. La variable adicional «calidad de vida» es opcional y no cuenta como pendiente. */
export function pendingVariables(e: Evaluation) {
  return applicableVariables(e.general.pathology).filter((v) => !v.optional && e.answers[v.id] === undefined);
}

const maxAnswer = (id: string): string | string[] | undefined => {
  const v = MODEL.find((x) => x.id === id);
  if (!v) return undefined;
  if (v.multi) return v.options.filter((o) => o.points > 0).map((o) => o.value);
  return v.options.reduce((b, o) => (o.points > b.points ? o : b), v.options[0]).value;
};

export function evaluate(e: Evaluation) {
  const pending = pendingVariables(e);
  const advancedPending = e.answers.advanced_therapy === undefined;
  const pathologyMissing = !e.general.pathology;
  const provisional = pending.length > 0 || advancedPending || pathologyMissing;
  const eff = effectiveProfessional(e);
  const result = determineFinalPriority(e.answers, e.general.pathology, eff);
  const dims = calculateDimensionScores(e.answers, e.general.pathology);
  // Cota superior: el MISMO cálculo si todas las pendientes tomaran su respuesta de mayor puntuación (sin la regla de terapia avanzada).
  const maxAnswers: Answers = {...e.answers};
  for (const v of pending) maxAnswers[v.id] = maxAnswer(v.id);
  const upper = provisional ? determineFinalPriority(maxAnswers, e.general.pathology) : null;
  const overrideRequested = e.professional.enabled;
  const overrideError = overrideRequested && eff.reason.length < MIN_JUSTIFICATION ? `La elevación requiere un motivo de al menos ${MIN_JUSTIFICATION} caracteres.` : '';
  const overrideApplied = eff.enabled && result.final === eff.priority && result.final < result.byScore;
  return {pending, advancedPending, pathologyMissing, provisional, result, dims, upper, overrideError, overrideApplied, eff};
}

export const interventionStatus = (e: Evaluation, id: string): InterventionStatus => {
  const s = e.statuses?.[id];
  return s && STATUSES.includes(s) ? s : 'planned';
};

export function buildReportInput(e: Evaluation, {version = '', includeFreeText = true}: {version?: string; includeFreeText?: boolean} = {}) {
  const ev = evaluate(e);
  const r = ev.result;
  const final = r.final as Priority;
  const label = (p: number) => `Prioridad ${p}`;
  const selected = e.selectedInterventions.map((id) => INTERVENTIONS.find((i) => i.id === id)).filter((i): i is NonNullable<typeof i> => !!i);
  const items = [
    ...selected.map((i) => ({id: i.id, group: i.category as string, label: i.text})),
    ...e.customInterventions.filter((t) => t.trim()).map((t, n) => ({id: `custom-${n}`, group: 'Intervención personalizada', label: t.trim()}))
  ];
  const by = (s: InterventionStatus) => items.filter((i) => interventionStatus(e, i.id) === s).map(({group, label: l}) => ({group, label: l}));
  const selectedIds = new Set(e.selectedInterventions);
  const recommended = recommendedInterventions(final).filter((i) => !selectedIds.has(i.id)).map((i) => ({group: i.category as string, label: i.text}));
  const warnings: string[] = [];
  if (ev.provisional) {
    const parts = [];
    if (ev.pending.length) parts.push(`${ev.pending.length} variable(s) sin responder`);
    if (ev.advancedPending) parts.push('regla de terapia génica/avanzada sin responder');
    if (ev.pathologyMissing) parts.push('patología sin seleccionar');
    warnings.push(`Resultado provisional: ${parts.join(', ')}. Una variable sin responder no se ha considerado «No»: no puntúa.`);
    if (ev.upper) warnings.push(`Si las pendientes resultaran con la puntuación máxima, el total podría alcanzar ${ev.upper.score} puntos (Prioridad ${ev.upper.byScore} por puntuación); cota superior orientativa.`);
    if (ev.advancedPending) warnings.push('Si el paciente recibe terapia génica/avanzada, la prioridad final sería 1 por regla obligatoria.');
  }
  if (ev.overrideError) warnings.push(`Elevación no aplicada: ${ev.overrideError}`);
  if (e.answers.quality_life === 'yes') warnings.push('El punto de calidad de vida es una variable adicional que no formó parte del pretest de los puntos de corte.');
  const dimLabel = (d: Dimension) => DIMENSIONS[d];
  const factors = applicableVariables(e.general.pathology).filter((v) => pointsFor(v.id, e.answers[v.id]) > 0).map((v) => {
    const a = e.answers[v.id];
    const values = Array.isArray(a) ? a : [a];
    return {dimension: dimLabel(v.dimension), label: `${v.number}. ${v.name}`, detail: `${values.map((x) => v.options.find((o) => o.value === x)?.label ?? x).join(' + ')} · ${e.sources[v.id] ?? 'Manual'}`, points: pointsFor(v.id, a)};
  });
  const motivation: Record<string, string> = {pharmacotherapeutic: 'Objetivos farmacoterapéuticos', clinical: 'Objetivos clínicos', quality: 'Objetivos de calidad de vida', habits: 'Objetivos sobre hábitos', skills: 'Competencias / habilidades', barriers: 'Barreras', facilitators: 'Facilitadores', plan: 'Plan acordado', stage: 'Estadio de cambio'};
  const opportunity: Record<string, string> = {modality: 'Modalidad', channel: 'Canal', tools: 'Herramientas de seguimiento', preferences: 'Preferencias', digitalBarriers: 'Barreras digitales', telemonitoring: 'Telemonitorización'};
  const context = [
    {label: 'Patología', value: e.general.pathology ? PATHOLOGIES[e.general.pathology] : ''},
    ...Object.entries(opportunity).map(([k, l]) => ({label: `Oportunidad · ${l}`, value: str(e.opportunity[k], 300)}))
  ];
  const goals = includeFreeText ? Object.entries(motivation).filter(([k]) => e.motivation[k]?.trim()).map(([k, l]) => ({label: l, status: '', detail: str(e.motivation[k], 600)})) : [];
  return {
    title: 'Estratificación CMO — Coagulopatías congénitas',
    tool: {name: TOOL_NAME, version},
    model: {name: MODEL_NAME, source: 'Modelo de Atención Farmacéutica CMO (Capacidad–Motivación–Oportunidad), SEFH.'},
    evaluationDate: isoDate(e.general.date), status: ev.provisional ? 'provisional' : 'final',
    hospital: e.general.hospital, pharmacist: e.general.pharmacist, patientId: e.general.patientId,
    context: includeFreeText ? context : context.filter((c) => !c.label.startsWith('Oportunidad')),
    stratification: {
      score: r.score, maxScore: null,
      subtotals: (Object.keys(DIMENSIONS) as Dimension[]).map((d) => ({label: dimLabel(d), points: ev.dims[d], max: null})),
      calculatedLevel: label(r.byScore), finalLevel: label(final), levelCode: final,
      rules: e.answers.advanced_therapy === 'yes' ? ['Terapia génica/terapia avanzada: Prioridad 1 obligatoria.'] : [],
      override: ev.overrideApplied ? {level: label(e.professional.priority), motive: 'Elevación por criterio profesional', justification: ev.eff.reason} : null,
      pending: [...ev.pending.map((v) => `${v.number}. ${v.name}`), ...(ev.advancedPending ? ['Terapia génica/avanzada'] : [])]
    },
    factors,
    needs: {confirmed: [], potential: []},
    interventions: {done: by('done'), planned: by('planned'), recommended, notApplicableCount: by('not_applicable').length},
    plan: {periodicity: PERIODICITY[final], nextReview: isoDate(e.nextDate), notes: includeFreeText ? str(e.observations, 2000) : '', goals},
    warnings
  };
}

export const buildReport = (e: Evaluation, opts?: {version?: string; includeFreeText?: boolean}) => createReport(buildReportInput(e, opts));

/** Datos exportables: nunca el texto de la HCE ni las evidencias textuales de las sugerencias. */
export function exportableEvaluation(e: Evaluation): Evaluation {
  return {...e, hce: '', suggestions: [], report: ''};
}

const dict = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Saneamiento de una evaluación importada: migra el esquema anterior, valida respuestas contra el modelo y acota los textos.
 * Descarta la HCE y las sugerencias (no se importan textos sin revisar). Devuelve null si no es válida.
 */
export function sanitizeEvaluation(raw: unknown): Evaluation | null {
  const migrated = migrateEvaluation(raw);
  if (!isValidEvaluation(migrated)) return null;
  const e = migrated as Evaluation;
  const base = createEmptyEvaluation();
  const g = dict(e.general);
  const pathology = typeof g.pathology === 'string' && g.pathology in PATHOLOGIES ? (g.pathology as Pathology) : undefined;
  const answers: Answers = {};
  for (const [id, v] of Object.entries(e.answers)) if (Object.hasOwn(e.answers, id)) answers[id] = v;
  const sources: Evaluation['sources'] = {};
  const allowedSources = ['Entrevista al paciente', 'Manual', 'Sugerencia HCE confirmada'];
  for (const [id, s] of Object.entries(dict(e.sources))) if (id in answers && typeof s === 'string' && allowedSources.includes(s)) sources[id] = s as Evaluation['sources'][string];
  const strMap = (src: unknown, keys: string[], max: number) => Object.fromEntries(keys.map((k) => [k, str(dict(src)[k], max)]));
  const p = dict(e.professional);
  const priority = p.priority === 1 ? 1 : 2;
  const catalog = new Set(INTERVENTIONS.map((i) => i.id));
  const statuses: Record<string, InterventionStatus> = {};
  for (const [id, s] of Object.entries(dict(e.statuses))) if (typeof s === 'string' && STATUSES.includes(s as InterventionStatus)) statuses[id.slice(0, 60)] = s as InterventionStatus;
  return {
    ...base, schemaVersion: SCHEMA_VERSION,
    general: {hospital: str(g.hospital, 200), pharmacist: str(g.pharmacist, 200), patientId: /\b\d{8}[A-Za-z]\b/.test(String(g.patientId ?? '')) ? '' : str(g.patientId, 60), date: isoDate(g.date), ...(pathology ? {pathology} : {})},
    answers, sources, suggestions: [], hce: '',
    professional: {enabled: p.enabled === true, priority, reason: str(p.reason, 2000)},
    selectedInterventions: e.selectedInterventions.filter((id) => typeof id === 'string' && catalog.has(id)),
    customInterventions: (Array.isArray(e.customInterventions) ? e.customInterventions : []).filter((t) => typeof t === 'string').map((t) => str(t, 600)).filter(Boolean).slice(0, 50),
    statuses, nextDate: isoDate(e.nextDate),
    motivation: strMap(e.motivation, Object.keys(base.motivation), 600), opportunity: strMap(e.opportunity, Object.keys(base.opportunity), 600),
    observations: str(e.observations, 2000), report: ''
  };
}

export type { Category };
