import {describe, expect, it} from 'vitest';
import {createEmptyEvaluation, type Evaluation} from './evaluation';
import {determineFinalPriority, calculateScore} from './scoring';
import {MODEL, applicableVariables} from '../data/stratificationModel';
import {evaluate, buildReport, buildReportInput, exportableEvaluation, sanitizeEvaluation, effectiveProfessional, interventionStatus} from './assessment';
import {reportToText, reportToHtml, validateReport, exportEnvelope, parseEnvelope} from '../cmo-ds/cmo-report.js';
import {reportToPdf} from '../cmo-ds/cmo-pdf.js';

const base = (over: Partial<Evaluation> = {}): Evaluation => {
  const e = createEmptyEvaluation();
  e.general.pathology = 'ha'; e.general.date = '2026-01-15';
  return {...e, ...over};
};
const answerAll = (e: Evaluation, advanced = 'no') => {
  e.answers.advanced_therapy = advanced;
  for (const v of applicableVariables(e.general.pathology)) if (!v.optional) e.answers[v.id] = v.multi ? [] : v.options[0].value;
  return e;
};

describe('protección del modelo clínico', () => {
  it('el adaptador devuelve el mismo resultado que el motor', () => {
    const e = answerAll(base()); e.answers.pain = 'acute'; e.answers.bleeds = 'yes';
    const ev = evaluate(e), direct = determineFinalPriority(e.answers, 'ha', {enabled: false, priority: 2, reason: ''});
    expect(ev.result.score).toBe(direct.score); expect(ev.result.final).toBe(direct.final);
  });
});

describe('estado provisional', () => {
  it('sin responder: provisional, no puntúa y la cota supera al total', () => {
    const e = base(); e.answers.age = '18-50';
    const ev = evaluate(e);
    expect(ev.provisional).toBe(true); expect(ev.result.score).toBe(1);
    expect(ev.pending.length).toBeGreaterThan(10);
    expect(ev.upper!.score).toBeGreaterThan(ev.result.score);
    expect(ev.pending.some((v) => v.optional)).toBe(false);
  });
  it('todas respondidas y regla respondida: definitivo', () => {
    const ev = evaluate(answerAll(base()));
    expect(ev.provisional).toBe(false); expect(ev.upper).toBeNull();
  });
  it('la regla de terapia avanzada sin responder mantiene provisional y lo advierte', () => {
    const e = answerAll(base()); delete e.answers.advanced_therapy;
    const ev = evaluate(e);
    expect(ev.provisional).toBe(true);
    expect(buildReport(e).warnings.join(' ')).toMatch(/terapia génica\/avanzada/);
  });
  it('terapia avanzada = sí fuerza Prioridad 1 y consta como regla', () => {
    const r = buildReport(answerAll(base(), 'yes'));
    expect(r.stratification.finalLevel).toBe('Prioridad 1'); expect(r.stratification.rules.length).toBe(1);
  });
});

describe('elevación por criterio profesional', () => {
  it('exige motivo de ≥ 12 caracteres; el resultado por puntuación se conserva', () => {
    const e = answerAll(base()); // P3
    e.professional = {enabled: true, priority: 1, reason: 'corto'};
    expect(effectiveProfessional(e).enabled).toBe(false);
    let ev = evaluate(e);
    expect(ev.result.final).toBe(3); expect(ev.overrideError).toMatch(/12/);
    e.professional.reason = 'Riesgo de abandono según valoración presencial.';
    ev = evaluate(e);
    expect(ev.result.final).toBe(1); expect(ev.result.byScore).toBe(3); expect(ev.overrideApplied).toBe(true);
    const r = buildReport(e);
    expect(r.stratification.calculatedLevel).toBe('Prioridad 3'); expect(r.stratification.finalLevel).toBe('Prioridad 1');
    expect(r.stratification.override.justification).toContain('abandono');
  });
});

describe('informe único', () => {
  it('valida, es coherente en texto/HTML/PDF y escapa HTML', () => {
    const e = answerAll(base()); e.general.hospital = '<img src=x onerror=alert(1)>'; e.customInterventions = ['<b>Propia</b>'];
    e.statuses = {'custom-0': 'done'};
    const r = buildReport(e);
    expect(validateReport(r)).toEqual([]);
    expect(r.interventions.done.length).toBe(1);
    expect(reportToHtml(r)).not.toMatch(/<img|<b>/);
    expect(reportToText(r)).toContain('Prioridad 3');
    expect(reportToPdf(r).length).toBeGreaterThan(500);
  });
  it('estado por defecto de una actuación: planificada; separa realizadas, planificadas y recomendadas', () => {
    const e = answerAll(base()); e.selectedInterventions = ['p3-S-0', 'p3-S-1']; e.statuses = {'p3-S-1': 'done'};
    expect(interventionStatus(e, 'p3-S-0')).toBe('planned');
    const r = buildReport(e);
    expect(r.interventions.planned.length).toBe(1); expect(r.interventions.done.length).toBe(1);
    expect(r.interventions.recommended.length).toBeGreaterThan(0);
  });
  it('definitivo no tiene pendientes y provisional las lista', () => {
    expect(buildReport(answerAll(base())).stratification.pending).toEqual([]);
    expect(buildReport(base()).status).toBe('provisional');
  });
});

describe('exportación e importación', () => {
  it('no exporta la HCE ni las evidencias de las sugerencias', () => {
    const e = answerAll(base()); e.hce = 'TEXTO-HCE-SECRETO'; e.suggestions = [{variableId: 'pain', value: 'acute', evidence: 'EVIDENCIA-SECRETA', confidence: 'explicit'}];
    const env = exportEnvelope({app: {id: 'cmo-coagulopatias', name: 'x', version: '1'}, exportedAt: '2026-01-01T00:00:00Z', report: buildReport(e, {includeFreeText: false}), data: exportableEvaluation(e), dataSchema: 'cmo-coagulopatias-evaluation/2'});
    const json = JSON.stringify(env);
    expect(json).not.toMatch(/SECRETO/);
    expect(parseEnvelope(json, {appId: 'cmo-coagulopatias'}).ok).toBe(true);
    expect(parseEnvelope(json, {appId: 'otra'}).ok).toBe(false);
  });
  it('ida y vuelta conserva respuestas, estados y elevación', () => {
    const e = answerAll(base()); e.statuses = {'custom-0': 'done'}; e.customInterventions = ['Propia'];
    e.professional = {enabled: true, priority: 2, reason: 'Motivo suficientemente largo.'};
    const back = sanitizeEvaluation(JSON.parse(JSON.stringify(exportableEvaluation(e))))!;
    expect(back.answers).toEqual(e.answers); expect(back.statuses).toEqual(e.statuses); expect(back.professional.priority).toBe(2);
    expect(calculateScore(back.answers, 'ha')).toBe(calculateScore(e.answers, 'ha'));
  });
  it('importación hostil: tipos incorrectos, ids ajenos, __proto__ y DNI se rechazan o se limpian', () => {
    expect(sanitizeEvaluation(null)).toBeNull();
    expect(sanitizeEvaluation({schemaVersion: 2, general: {}, answers: {inventada: 'yes'}, sources: {}, motivation: {}, opportunity: {}, selectedInterventions: [], suggestions: [], professional: {}})).toBeNull();
    const e = exportableEvaluation(answerAll(base())) as unknown as Record<string, any>;
    e.general.hospital = {x: 1}; e.general.patientId = '12345678Z'; e.selectedInterventions = ['no-existe', 'p3-S-0'];
    e.customInterventions = [1, '<x>ok']; e.statuses = {a: 'hackeado', b: 'done'}; e.hce = 'x'; e.suggestions = [{}];
    const clean = sanitizeEvaluation(JSON.parse(JSON.stringify(e)))!;
    expect(clean.general.hospital).toBe(''); expect(clean.general.patientId).toBe('');
    expect(clean.selectedInterventions).toEqual(['p3-S-0']); expect(clean.customInterventions).toEqual(['<x>ok']);
    expect(clean.statuses).toEqual({b: 'done'}); expect(clean.hce).toBe(''); expect(clean.suggestions).toEqual([]);
    const proto = JSON.parse('{"schemaVersion":2,"general":{},"answers":{"__proto__":"yes"},"sources":{},"motivation":{},"opportunity":{},"selectedInterventions":[],"suggestions":[],"professional":{}}');
    expect(sanitizeEvaluation(proto)).toBeNull();
    expect(({} as any).polluted).toBeUndefined();
  });
  it('esquema anterior (v1) sigue migrando', () => {
    const v1 = {...exportableEvaluation(answerAll(base())), schemaVersion: 1};
    expect(sanitizeEvaluation(JSON.parse(JSON.stringify(v1)))).not.toBeNull();
  });
});

describe('modelo', () => {
  it('mantiene todas sus variables', () => { expect(MODEL.length).toBe(22); });
});
