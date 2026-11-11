import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url));
describe('protección del modelo clínico', () => {
  it('huella SHA-256 de scoring, modelo, intervenciones y extractor', () => {
    const fp = JSON.parse(read('tests/fixtures/clinical-files.sha256.json'));
    for (const [f, h] of Object.entries(fp)) expect(crypto.createHash('sha256').update(read(f)).digest('hex'), f).toBe(h);
  });
  it('el adaptador no usa new Date() ni Date.now()', () => {
    expect(read('src/domain/assessment.ts').toString()).not.toMatch(/new Date\(|Date\.now\(/);
  });
});
