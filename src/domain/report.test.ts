import { describe, expect, it } from 'vitest';
import { INTERVENTIONS } from '../data/interventions';
import { createEmptyEvaluation } from './evaluation';
import { buildReportData, reportDataToText } from './report';

function evaluation() {
  const value = createEmptyEvaluation();
  value.general = {
    hospital: 'Hospital Central',
    pharmacist: 'Dra. Farmacia',
    patientId: 'PAC-42',
    date: '2026-09-16',
    pathology: 'ha',
  };
  value.answers = { age: '18-50', hemophilia_severity: 'severe' };
  return value;
}

describe('informe clínico', () => {
  it('contiene hospital y farmacéutico', () => {
    const text = reportDataToText(buildReportData(evaluation()));
    expect(text).toContain('Hospital / centro: Hospital Central');
    expect(text).toContain('Farmacéutico/a: Dra. Farmacia');
  });

  it('contiene la puntuación y prioridad actuales', () => {
    const data = buildReportData(evaluation());
    expect(data.stratification.score).toBe(4);
    expect(data.stratification.finalPriority).toBe('Prioridad 3');
  });

  it('incluye solo variables aplicables a la patología', () => {
    const ids = buildReportData(evaluation()).variables.map(({ id }) => id);
    expect(ids).toContain('hemophilia_severity');
    expect(ids).not.toContain('vw_severity');
  });

  it('incluye intervenciones estándar y personalizadas seleccionadas', () => {
    const value = evaluation();
    const selected = INTERVENTIONS[0];
    value.selectedInterventions = [selected.id];
    value.customInterventions = ['Revisión individualizada'];
    const text = reportDataToText(buildReportData(value));
    expect(text).toContain(selected.text);
    expect(text).toContain('Revisión individualizada');
  });

  it('no incluye una intervención desmarcada', () => {
    const value = evaluation();
    value.selectedInterventions = [INTERVENTIONS[0].id];
    const text = reportDataToText(buildReportData(value));
    expect(text).toContain(INTERVENTIONS[0].text);
    expect(text).not.toContain(INTERVENTIONS[1].text);
  });

  it('muestra los objetivos cumplimentados', () => {
    const value = evaluation();
    value.motivation.clinical = 'Reducir episodios hemorrágicos';
    expect(reportDataToText(buildReportData(value))).toContain(
      'Objetivos clínicos: Reducir episodios hemorrágicos',
    );
  });

  it('omite bloques opcionales completamente vacíos', () => {
    const text = reportDataToText(buildReportData(evaluation()));
    expect(text).not.toContain('OBJETIVOS A ALCANZAR');
    expect(text).not.toContain('OPORTUNIDAD / MODALIDAD ASISTENCIAL');
    expect(text).not.toContain('OBSERVACIONES\n');
  });

  it('reconstruye el resultado después de un cambio de estado', () => {
    const value = evaluation();
    const before = buildReportData(value);
    value.answers.age = 'over50';
    const after = buildReportData(value);
    expect(after.stratification.score).toBe(before.stratification.score + 1);
    expect(after.variables.find(({ id }) => id === 'age')?.response).toBe('Mayor de 50 años');
  });

  it('el texto HCE deriva de los mismos datos que consume la vista', () => {
    const data = buildReportData(evaluation());
    const visualProps = { data };
    const text = reportDataToText(visualProps.data);
    expect(text).toContain(`Puntuación total: ${visualProps.data.stratification.score}`);
    expect(text).toContain(visualProps.data.variables[0].response);
  });

  it('indica que el modelo adulto no aplica a un paciente pediátrico', () => {
    const value = evaluation();
    value.answers.age = 'minor';
    const data = buildReportData(value);
    expect(data.stratification.pediatric).toBe(true);
    expect(data.stratification.finalPriority).toBe('Modelo adulto no aplicable');
    expect(reportDataToText(data)).toContain('Modelo adulto no aplicable');
  });
});
