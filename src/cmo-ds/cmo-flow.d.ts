export function toast(message: string, opts?: { type?: 'info' | 'error'; timeout?: number }): HTMLElement;
export function confirmDialog(opts: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean>;
export function guardUnsaved(isDirty: () => boolean): () => void;
export function copyText(text: string): Promise<boolean>;
export function download(filename: string, content: string | Uint8Array, type?: string): void;
export function printHtml(html: string, title?: string, lang?: string): void;
export function safeFilename(...parts: Array<string | undefined>): string;
