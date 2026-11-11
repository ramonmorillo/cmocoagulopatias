// Declaraciones de tipos del núcleo CMO (no forma parte de la copia fijada; no modifica su comportamiento).
export const INTERVENTION_STATUSES: Readonly<Record<'recommended' | 'done' | 'planned' | 'not_applicable', string>>;
export type CmoReport = any;
export function createReport(input?: any): CmoReport;
export function validateReport(r: CmoReport): string[];
export function reportToText(r: CmoReport): string;
export function reportToHtml(r: CmoReport): string;
export function exportEnvelope(args: { app: { id: string; name: string; version: string }; exportedAt: string; report: CmoReport; data: unknown; dataSchema: string }): any;
export function parseEnvelope(raw: string, opts?: { appId?: string; maxBytes?: number }): { ok: true; value: any } | { ok: false; error: string };
