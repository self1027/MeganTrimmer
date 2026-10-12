import fs from 'node:fs';
import path from 'node:path';

/** Número máximo de tentativas antes de desistir (evita loop infinito). */
const MAX_ATTEMPTS = 999;

/**
 * Resolve um caminho de saída livre, sem sobrescrever arquivos existentes.
 *
 * - Se `desiredPath` não existe → retorna o próprio caminho.
 * - Se existe → tenta `base (1).ext`, `base (2).ext`, … até achar um livre.
 *   O primeiro candidato é sempre `(1)`; nunca reutiliza o nome original.
 *
 * Regras de parsing (último ponto apenas; ponto inicial = arquivo oculto sem extensão):
 * - `video_trimmed.mp4`  → base `video_trimmed`, ext `.mp4`
 * - `video_trimmed`       → base `video_trimmed`, ext ``
 * - `my.holiday.2024.mp4` → base `my.holiday.2024`, ext `.mp4`
 * - `.hidden`             → base `.hidden`, ext `` (não é extensão vazia)
 *
 * Função pura e síncrona: não cria arquivos, apenas retorna o caminho.
 */
export function resolveOutputPath(desiredPath: string): string {
  if (typeof desiredPath !== 'string' || desiredPath.trim() === '') {
    throw new Error('Invalid output path: expected a non-empty string');
  }

  if (!fs.existsSync(desiredPath)) return desiredPath;

  const dir = path.dirname(desiredPath);
  const filename = path.basename(desiredPath);

  const dotIndex = filename.lastIndexOf('.');
  const hasExtension = dotIndex > 0; // `.hidden` → dotIndex 0 → sem extensão
  const base = hasExtension ? filename.slice(0, dotIndex) : filename;
  const ext = hasExtension ? filename.slice(dotIndex) : '';

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const candidate = path.join(dir, `${base} (${i})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    `Could not resolve a unique output path for "${desiredPath}" after ${MAX_ATTEMPTS} attempts`
  );
}
