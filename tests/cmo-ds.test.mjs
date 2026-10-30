import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const html = read('../index.html');
const meta = JSON.parse(/<script type="application\/json" id="cmo-app-meta">([\s\S]*?)<\/script>/.exec(html)[1]);

describe('CMO Design System', () => {
  it('la versión de la firma coincide con package.json', () => {
    expect(meta.schema).toBe('cmo-app-meta/1');
    expect(meta.appVersion).toBe(JSON.parse(read('../package.json')).version);
  });
  it('fecha solo con estado publicado y nunca generada en tiempo de ejecución', () => {
    if (meta.status === 'released') expect(meta.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    else expect(meta.releaseDate).toBeNull();
    expect(read('../src/cmo-ds/cmo-author-signature.js')).not.toMatch(/new Date\(|Date\.now\(/);
  });
  it('atribuye el modelo clínico al documento SEFH que cita la propia app', () => {
    const app = read('../src/App.tsx');
    const title = /<footer><strong>([^<]+)<\/strong>/.exec(app)[1];
    expect(meta.credits.some((c) => c.name.includes(title))).toBe(true);
  });
  it('copia fijada íntegra (sin ediciones manuales)', () => {
    const dir = new URL('../src/cmo-ds/', import.meta.url);
    const man = JSON.parse(fs.readFileSync(new URL('CMO-DS-VERSION.json', dir), 'utf8'));
    expect(man.version).toBe(meta.designSystem);
    for (const [f, h] of Object.entries(man.files)) {
      expect(crypto.createHash('sha256').update(fs.readFileSync(new URL(f, dir))).digest('hex')).toBe(h);
    }
  });
});
