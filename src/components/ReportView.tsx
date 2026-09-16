import { DIMENSIONS, type Dimension } from '../data/stratificationModel';
import type { ReportData, ReportField } from '../domain/report';

const FieldList = ({ fields }: { fields: ReportField[] }) => (
  <dl className="report-fields">
    {fields.map(({ label, value }) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

export function ReportView({ data }: { data: ReportData }) {
  const categories = Object.entries(data.interventions).filter(([, items]) => items.length);
  return (
    <article className="clinical-report" id="clinical-report" aria-label="Informe clínico">
      <header className="report-header">
        <p className="report-kicker">Informe clínico</p>
        <h1>{data.heading}</h1>
        <p>{data.subtitle}</p>
      </header>

      <section>
        <h2>A. Datos del profesional y centro</h2>
        <FieldList fields={data.professional} />
      </section>

      <section>
        <h2>B. Resultado de estratificación</h2>
        <div className="report-result">
          <div><span>Puntuación total</span><strong>{data.stratification.score}</strong></div>
          <div><span>Prioridad según puntuación</span><strong>{data.stratification.priorityByScore}</strong></div>
          <div><span>Prioridad final</span><strong>{data.stratification.finalPriority}</strong></div>
        </div>
        <div className="report-dimensions">
          {Object.entries(DIMENSIONS).map(([id, label]) => (
            <div key={id}><span>{label}</span><strong>{data.stratification.dimensions[id as Dimension]}</strong></div>
          ))}
        </div>
        {data.stratification.specialRule && <p><b>Regla especial aplicada:</b> {data.stratification.specialRule}</p>}
        {data.stratification.professionalOverride && <p><b>Elevación por criterio profesional:</b> {data.stratification.professionalOverride}</p>}
      </section>

      <section>
        <h2>C. Variables de estratificación</h2>
        <div className="report-table-wrap">
          <table>
            <thead><tr><th>Variable</th><th>Respuesta seleccionada</th><th>Puntuación</th><th>Fuente / origen</th></tr></thead>
            <tbody>{data.variables.map((variable) => <tr key={variable.id}><td>{variable.variable}</td><td>{variable.response}</td><td>{variable.points}</td><td>{variable.source}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>D. Plan de atención farmacéutica</h2>
        {categories.length ? categories.map(([category, items]) => (
          <div className="report-interventions" key={category}>
            <h3>{category}</h3>
            <ul>{items.map((item, index) => <li key={`${item.text}-${index}`}>{item.text}{item.custom && <small> · Personalizada</small>}</li>)}</ul>
          </div>
        )) : <p>Sin intervenciones seleccionadas.</p>}
        <FieldList fields={[
          { label: 'Periodicidad recomendada', value: data.periodicity },
          { label: 'Próxima evaluación', value: data.nextEvaluation },
          { label: 'Criterio de revaloración', value: data.reassessmentCriterion },
        ]} />
      </section>

      {data.objectives.length > 0 && <section><h2>E. Objetivos a alcanzar</h2><FieldList fields={data.objectives} /></section>}
      {data.opportunity.length > 0 && <section><h2>F. Oportunidad / modalidad asistencial</h2><FieldList fields={data.opportunity} /></section>}
      {data.observations && <section><h2>G. Observaciones</h2><p className="report-observations">{data.observations}</p></section>}
      <footer className="report-footer">{data.footer}</footer>
    </article>
  );
}
