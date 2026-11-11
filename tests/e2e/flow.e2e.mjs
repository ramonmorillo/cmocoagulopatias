// Recorrido extremo a extremo de CMO Coagulopatías en Chromium (Playwright) sobre dist/. Datos ficticios.
//   npm run build && node --test tests/e2e/flow.e2e.mjs
//   AXE_PATH=<axe.min.js>  añade la auditoría WCAG A/AA
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = await import('playwright')); } catch { chromium = null; } }
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'dist');
const BASE = '/cmocoagulopatias/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
let server, browser, origin;
const external = [];

before(async () => {
  if (!chromium) return;
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (!url.startsWith(BASE)) { res.writeHead(404); res.end(); return; }
    let file = path.join(DIST, url.slice(BASE.length));
    if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
    if (file.endsWith(path.sep) || file === DIST) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise((r) => server.listen(0, r));
  origin = `http://localhost:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function open(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:') && u !== 'about:srcdoc') external.push(u); });
  await page.goto(origin + BASE);
  await page.waitForSelector('.stepper');
  return { page, errors };
}
async function fillStart(page, { pathology = 'ha', advanced = 'no' } = {}) {
  await page.getByLabel('Hospital / centro').fill('Hospital X');
  await page.getByLabel('Farmacéutico/a').fill('Farm. Prueba');
  await page.getByLabel('Identificador pseudonimizado').fill('COAG-001');
  await page.getByLabel('Patología').selectOption(pathology);
  await page.getByLabel('¿El paciente recibe terapia génica').selectOption(advanced);
}
const goStep = (page, n) => page.locator('.stepper button').nth(n).click();

test('provisional → elevación con motivo → informe, PDF, JSON y reimportación', { skip: !chromium }, async () => {
  const { page, errors } = await open();
  await fillStart(page);
  await goStep(page, 2);
  await page.locator('.variable', { hasText: 'Edad' }).first().locator('.options button').first().click();
  await goStep(page, 4);
  assert.ok(await page.locator('[data-provisional]').isVisible());
  assert.match(await page.locator('[data-provisional]').textContent(), /no se interpreta como «No»/);
  assert.match(await page.locator('.hero-result').textContent(), /provisional/);
  // elevar sin motivo suficiente
  await page.getByLabel('Elevar prioridad por criterio profesional').check();
  await page.getByLabel(/Motivo obligatorio/).fill('corto');
  assert.match(await page.locator('[role="alert"]').first().textContent(), /12 caracteres/);
  assert.match(await page.locator('.hero-result').textContent(), /Prioridad final: P3/);
  await page.getByLabel(/Motivo obligatorio/).fill('Riesgo de abandono según valoración presencial.');
  await page.waitForFunction(() => /Prioridad final: P(1|2)/.test(document.querySelector('.hero-result').textContent));
  // intervención con estado
  await page.locator('.interventions input[type="checkbox"]').first().check();
  await page.getByLabel('Estado de la actuación').first().selectOption('done');
  await page.getByLabel('Observaciones').fill('OBS-PROFESIONAL');
  await page.getByRole('button', { name: 'Generar informe' }).click();
  const report = await page.locator('#clinical-report').textContent();
  assert.match(report, /rovisional/);
  assert.match(report, /Realizada/i);
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar PDF' }).click()]);
  assert.equal(fs.readFileSync(await pdf.path()).subarray(0, 5).toString(), '%PDF-');
  await page.getByRole('button', { name: 'Copiar informe para HCE' }).click();
  await page.waitForFunction(() => /copiado/i.test(document.querySelector('.cmo-toast')?.textContent || ''));
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar evaluación JSON' }).click()]);
  const raw = fs.readFileSync(await json.path(), 'utf8');
  assert.match(raw, /cmo-export\/1/);
  // reiniciar con diálogo
  await page.getByRole('button', { name: 'Reiniciar estratificación' }).click();
  await page.locator('dialog.cmo-modal button', { hasText: 'Cancelar' }).click();
  assert.match(await page.locator('.hero-result').textContent(), /PRIORIDAD/, 'cancelar no reinicia');
  await page.getByRole('button', { name: 'Reiniciar estratificación' }).click();
  await page.locator('dialog.cmo-modal button', { hasText: 'Reiniciar' }).last().click();
  await page.waitForSelector('text=Datos del profesional y paciente');
  // importar
  const tmp = path.join(ROOT, 'tests', 'e2e', '.tmp-import.json');
  try {
    fs.writeFileSync(tmp, raw);
    await page.locator('input[type="file"]').setInputFiles(tmp);
    await page.waitForFunction(() => /importada/i.test(document.querySelector('.cmo-toast')?.textContent || ''));
    assert.equal(await page.getByLabel('Hospital / centro').inputValue(), 'Hospital X');
    fs.writeFileSync(tmp, JSON.stringify({ schema: 'cmo-export/1', app: { id: 'otra' }, data: {} }));
    await page.locator('input[type="file"]').setInputFiles(tmp);
    await page.waitForFunction(() => /otra herramienta/.test(document.querySelector('.cmo-toast')?.textContent || ''));
  } finally { fs.rmSync(tmp, { force: true }); }
  assert.deepEqual(errors, []);
});

test('la HCE y las sugerencias no se exportan; las sugerencias requieren confirmación', { skip: !chromium }, async () => {
  const { page } = await open();
  await fillStart(page);
  await goStep(page, 1);
  await page.locator('textarea').fill('Paciente de 45 años con hemofilia A grave. Sin inhibidores. Presenta ansiedad. TEXTO-HCE-SECRETO.');
  await page.getByRole('button', { name: 'Analizar información clínica' }).click();
  await page.waitForSelector('.suggestion');
  assert.ok(await page.locator('.suggestion').count() > 0);
  await goStep(page, 3);
  assert.equal((await page.locator('table tbody tr .pending').count()) > 0, true, 'nada confirmado todavía');
  await goStep(page, 1);
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar evaluación JSON' }).click()]);
  const raw = fs.readFileSync(await json.path(), 'utf8');
  assert.doesNotMatch(raw, /TEXTO-HCE-SECRETO|ansiedad/i);
  assert.deepEqual(external, []);
});

test('móvil 375 px: sin desbordamiento horizontal en los 5 pasos', { skip: !chromium }, async () => {
  const { page } = await open({ width: 375, height: 740 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await fillStart(page);
  for (let i = 0; i < 5; i++) {
    await goStep(page, i);
    if (i === 4) { await page.getByLabel('Elevar prioridad por criterio profesional').check(); await page.locator('.interventions input[type="checkbox"]').first().check(); await page.getByRole('button', { name: 'Generar informe' }).click(); }
    assert.ok((await overflow()) <= 0, `paso ${i + 1}`);
  }
});

test('accesibilidad WCAG A/AA con axe (si AXE_PATH)', { skip: !chromium || !process.env.AXE_PATH }, async () => {
  const { page } = await open();
  const axe = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const run = async (label) => {
    await page.evaluate(axe);
    const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    assert.deepEqual(res.violations.map((v) => `${v.id}:${v.nodes.length}`), [], label);
  };
  await run('paso 1');
  await fillStart(page);
  for (let i = 1; i < 5; i++) {
    await goStep(page, i);
    if (i === 4) { await page.locator('.interventions input[type="checkbox"]').first().check(); await page.getByRole('button', { name: 'Generar informe' }).click(); }
    await run(`paso ${i + 1}`);
  }
});
