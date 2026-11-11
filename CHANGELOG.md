# Changelog

## Sin publicar — Flujo común CMO (CMO Design System 0.3.0)

Sin cambios en el modelo clínico: `scoring.ts`, `stratificationModel.ts`, `interventions.ts` y `hce.ts` intactos (huella SHA-256 en `tests/fixtures/clinical-files.sha256.json`). Versión y fecha de publicación sin tocar (las fija el autor en el commit de publicación).
- Núcleo CMO fijado en `src/cmo-ds/` (informe, PDF, flujo) y adaptador `src/domain/assessment.ts` (sin lógica clínica; declaraciones de tipos `*.d.ts` junto al núcleo).
- **Resultado provisional**: variables sin responder (o regla de terapia avanzada / patología sin seleccionar) no puntúan ni se interpretan como «No»; el resultado se marca provisional con cota superior calculada con el propio motor. La variable adicional «calidad de vida» sigue siendo opcional.
- **Elevación por criterio profesional** con motivo de al menos 12 caracteres (antes bastaba cualquier texto); la prioridad por puntuación se conserva y consta en el informe.
- **Estado de las actuaciones** (planificada / realizada / no procede); el informe separa realizadas, planificadas y recomendadas no registradas.
- **Informe único** `cmo-report/1` sustituye a `ReportView`: pantalla, copia, `.txt`, impresión aislada y PDF local, todos desde el mismo modelo. (`buildReportData`/`generateReport` se conservan por compatibilidad con sus pruebas.)
- **Exportación** como sobre `cmo-export/1` (`cmo-coagulopatias-evaluation/2`) **sin texto de la HCE ni evidencias de sugerencias**; **importación** validada y saneada (también acepta el JSON anterior), sin importar HCE ni sugerencias.
- `confirm()`/`alert()` sustituidos por diálogo accesible y avisos; aviso al cerrar con cambios sin exportar; paso actual marcado con `aria-current`.
- Pruebas: 16 unitarias nuevas (99 en total) y 4 e2e (Playwright + axe WCAG A/AA, 375 px, sin peticiones externas).

## 1.1.0 — 2026-10-30

Publicación (decisión del autor: versión menor por el cambio de interfaz). `package.json`, `package-lock.json` y `cmo-app-meta` 1.0.0 → 1.1.0; `cmo-app-meta`: `status: "released"`, `releaseDate: "2026-10-30"`. Sin cambios en `domain/` ni `data/`.

- Dependencias fijadas a versiones exactas, `package-lock.json` y `npm ci` en el despliegue (PR #7).
- Identidad CMO Design System 0.2.0: tema «Estratos», firma de autoría, foco y contrastes accesibles (PR #8).

## 1.0.0

Versión anterior (sin registro de cambios).
