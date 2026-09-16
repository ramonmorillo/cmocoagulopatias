import { INTERVENTIONS, PERIODICITY, type Category } from '../data/interventions';
import {
  applicableVariables,
  DIMENSIONS,
  PATHOLOGIES,
  type Dimension,
} from '../data/stratificationModel';
import type { Evaluation } from './evaluation';
import {
  calculateDimensionScores,
  determineFinalPriority,
  pointsFor,
} from './scoring';

export type ReportField = { label: string; value: string };
export type ReportVariable = {
  id: string;
  variable: string;
  response: string;
  points: number;
  source: string;
};
export type ReportIntervention = { text: string; custom?: boolean };
export type ReportData = {
  heading: string;
  subtitle: string;
  footer: string;
  professional: ReportField[];
  stratification: {
    score: number;
    dimensions: Record<Dimension, number>;
    priorityByScore: string;
    finalPriority: string;
    specialRule?: string;
    professionalOverride?: string;
  };
  variables: ReportVariable[];
  interventions: Record<Category, ReportIntervention[]>;
  periodicity: string;
  nextEvaluation: string;
  reassessmentCriterion: string;
  objectives: ReportField[];
  opportunity: ReportField[];
  observations?: string;
};

const structuralValue = (value: string | undefined) => value?.trim() || 'No registrado';
const optionalFields = (values: Record<string, string>, labels: Record<string, string>) =>
  Object.entries(labels)
    .filter(([key]) => values[key]?.trim())
    .map(([key, label]) => ({ label, value: values[key].trim() }));

const CATEGORIES: Category[] = [
  'Seguimiento farmacoterapéutico',
  'Educación, formación y seguimiento',
  'Coordinación con el equipo asistencial',
];

/** Construye la única representación canónica usada por la vista y el texto HCE. */
export function buildReportData(evaluation: Evaluation): ReportData {
  const result = determineFinalPriority(
    evaluation.answers,
    evaluation.general.pathology,
    evaluation.professional,
  );
  const dimensions = calculateDimensionScores(
    evaluation.answers,
    evaluation.general.pathology,
  );
  const interventions: Record<Category, ReportIntervention[]> = {
    'Seguimiento farmacoterapéutico': [],
    'Educación, formación y seguimiento': [],
    'Coordinación con el equipo asistencial': [],
  };

  // Deliberadamente se parte de la selección, nunca de las recomendaciones.
  evaluation.selectedInterventions.forEach((id) => {
    const selected = INTERVENTIONS.find((item) => item.id === id);
    if (selected) interventions[selected.category].push({ text: selected.text });
  });
  evaluation.customInterventions
    .filter((text) => text.trim())
    .forEach((text) =>
      interventions['Seguimiento farmacoterapéutico'].push({
        text: text.trim(),
        custom: true,
      }),
    );

  const professionalOverride =
    evaluation.professional.enabled &&
    evaluation.professional.reason.trim() &&
    result.final === evaluation.professional.priority
      ? `Prioridad ${evaluation.professional.priority}: ${evaluation.professional.reason.trim()}`
      : undefined;
  const specialRule = evaluation.answers.advanced_therapy === 'yes'
    ? 'Tratamiento con terapia génica/terapia avanzada: Prioridad 1.'
    : undefined;

  return {
    heading: 'CMO Coagulopatías Congénitas',
    subtitle: 'Informe de estratificación y plan de atención farmacéutica',
    footer:
      'Adaptación del Modelo de Atención Farmacéutica CMO al paciente con coagulopatías congénitas',
    professional: [
      { label: 'Hospital / centro', value: structuralValue(evaluation.general.hospital) },
      { label: 'Farmacéutico/a', value: structuralValue(evaluation.general.pharmacist) },
      {
        label: 'Identificador pseudonimizado del paciente',
        value: structuralValue(evaluation.general.patientId),
      },
      { label: 'Fecha', value: structuralValue(evaluation.general.date) },
      {
        label: 'Patología',
        value: evaluation.general.pathology
          ? PATHOLOGIES[evaluation.general.pathology]
          : 'No registrada',
      },
    ],
    stratification: {
      score: result.score,
      dimensions,
      priorityByScore: `Prioridad ${result.byScore}`,
      finalPriority: `Prioridad ${result.final}`,
      specialRule,
      professionalOverride,
    },
    variables: applicableVariables(evaluation.general.pathology).map((variable) => {
      const answer = evaluation.answers[variable.id];
      const values = Array.isArray(answer) ? answer : [answer];
      return {
        id: variable.id,
        variable: `${variable.number}. ${variable.name}`,
        response:
          answer === undefined
            ? 'Pendiente'
            : values
                .map((value) => variable.options.find((option) => option.value === value)?.label ?? value)
                .join(' + ') || 'Pendiente',
        points: pointsFor(variable.id, answer),
        source: evaluation.sources[variable.id] ?? 'Pendiente',
      };
    }),
    interventions,
    periodicity: result.final ? PERIODICITY[result.final] : 'No aplicable',
    nextEvaluation: structuralValue(evaluation.nextDate),
    reassessmentCriterion:
      'Inicio o cambio de tratamiento, cambio clínico relevante, acontecimiento adverso o criterio profesional.',
    objectives: optionalFields(evaluation.motivation, {
      pharmacotherapeutic: 'Objetivos farmacoterapéuticos',
      clinical: 'Objetivos clínicos',
      quality: 'Objetivos relacionados con calidad de vida',
      habits: 'Objetivos sobre hábitos',
      skills: 'Competencias / habilidades',
      barriers: 'Barreras',
      facilitators: 'Facilitadores',
      plan: 'Plan acordado',
      stage: 'Estadio de cambio',
    }),
    opportunity: optionalFields(evaluation.opportunity, {
      modality: 'Modalidad',
      channel: 'Canal',
      tools: 'Herramientas de seguimiento',
      preferences: 'Preferencias',
      digitalBarriers: 'Barreras digitales',
      telemonitoring: 'Telemonitorización',
    }),
    observations: evaluation.observations.trim() || undefined,
  };
}

/** Compatibilidad con consumidores anteriores: siempre genera desde el estado recibido. */
export function generateReport(evaluation: Evaluation) {
  return reportDataToText(buildReportData(evaluation));
}

export function reportDataToText(data: ReportData): string {
  const lines: string[] = [
    data.heading.toUpperCase(),
    data.subtitle,
    '',
    'DATOS DEL PROFESIONAL Y CENTRO',
    ...data.professional.map(({ label, value }) => `${label}: ${value}`),
    '',
    'RESULTADO DE ESTRATIFICACIÓN',
    `Puntuación total: ${data.stratification.score}`,
    ...Object.entries(DIMENSIONS).map(
      ([id, label]) => `${label}: ${data.stratification.dimensions[id as Dimension]}`,
    ),
    `Prioridad según puntuación: ${data.stratification.priorityByScore}`,
    `Prioridad final: ${data.stratification.finalPriority}`,
  ];
  if (data.stratification.specialRule)
    lines.push(`Regla especial aplicada: ${data.stratification.specialRule}`);
  if (data.stratification.professionalOverride)
    lines.push(`Elevación por criterio profesional: ${data.stratification.professionalOverride}`);

  lines.push('', 'VARIABLES DE ESTRATIFICACIÓN');
  data.variables.forEach((variable) =>
    lines.push(
      `- ${variable.variable}: ${variable.response} | ${variable.points} punto(s) | Fuente: ${variable.source}`,
    ),
  );
  lines.push('', 'PLAN DE ATENCIÓN FARMACÉUTICA');
  CATEGORIES.forEach((category) => {
    const selected = data.interventions[category];
    if (selected.length) lines.push(category, ...selected.map(({ text }) => `- ${text}`));
  });
  if (!CATEGORIES.some((category) => data.interventions[category].length))
    lines.push('Sin intervenciones seleccionadas.');
  lines.push(
    `Periodicidad recomendada: ${data.periodicity}`,
    `Próxima evaluación: ${data.nextEvaluation}`,
    `Criterio de revaloración: ${data.reassessmentCriterion}`,
  );
  if (data.objectives.length)
    lines.push('', 'OBJETIVOS A ALCANZAR', ...data.objectives.map(({ label, value }) => `${label}: ${value}`));
  if (data.opportunity.length)
    lines.push(
      '',
      'OPORTUNIDAD / MODALIDAD ASISTENCIAL',
      ...data.opportunity.map(({ label, value }) => `${label}: ${value}`),
    );
  if (data.observations) lines.push('', 'OBSERVACIONES', data.observations);
  return `${lines.join('\n')}\n`;
}
