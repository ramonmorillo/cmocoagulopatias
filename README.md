# CMO Coagulopatías Congénitas

Aplicación clínica estática para estratificar y planificar la atención farmacéutica de personas adultas con hemofilia A, hemofilia B o enfermedad de von Willebrand.

## Desarrollo

```bash
npm install
npm test
npm run dev
npm run build
```

El modelo y sus puntuaciones viven exclusivamente en `src/data/stratificationModel.ts`; las intervenciones acumulativas, en `src/data/interventions.ts`. La aplicación no envía datos a servidores ni los persiste automáticamente. La exportación/importación JSON es explícita y usa `schemaVersion`.

## GitHub Pages

Vite utiliza la base `/cmocoagulopatias/`. El workflow `.github/workflows/deploy.yml` ejecuta tests y build antes de publicar `dist` mediante GitHub Pages. En la configuración del repositorio debe seleccionarse **GitHub Actions** como fuente de Pages.

URL prevista: <https://ramonmorillo.github.io/cmocoagulopatias/>

> Herramienta de apoyo profesional. La decisión clínica corresponde al profesional sanitario.
