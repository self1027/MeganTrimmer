import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SETTINGS,
  FALLBACK_SUBFOLDER,
  SETTINGS_FILENAME
} from '../../shared/constants.js';
import type { AppSettings } from '../../shared/types.js';

/** Caminho absoluto do settings.json dentro de userData. */
export function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILENAME);
}

/**
 * Lê o settings do disco (lazy).
 * - Arquivo inexistente → DEFAULT_SETTINGS (sem criar nada).
 * - JSON inválido → warning fixo + DEFAULT_SETTINGS (nunca crasha; não loga o conteúdo).
 * - Merge defensivo: chaves faltantes ou de tipo errado voltam ao default.
 */
export function loadSettings(): AppSettings {
  const filePath = getSettingsPath();

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return { ...DEFAULT_SETTINGS };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`Warning: invalid ${SETTINGS_FILENAME} at ${filePath}; using default settings.`);
    return { ...DEFAULT_SETTINGS };
  }

  return sanitizeSettings(parsed);
}

function sanitizeSettings(parsed: unknown): AppSettings {
  const outputFolder = (parsed as AppSettings | null | undefined)?.outputFolder;
  return {
    ...DEFAULT_SETTINGS,
    ...(typeof outputFolder === 'string' ? { outputFolder } : {})
  };
}

/** Grava o settings com escrita atômica (tmp + rename) para não corromper no crash. */
export function saveSettings(settings: AppSettings): void {
  const filePath = getSettingsPath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Pasta efetiva de saída: a configurada se existir no disco, senão
 * `Videos/MeganTrimmer` (criada sob demanda). Nunca retorna ''.
 */
export function resolveOutputFolder(settings: AppSettings): string {
  const configured = settings.outputFolder;
  if (configured && fs.existsSync(configured)) return configured;

  const fallback = path.join(app.getPath('videos'), FALLBACK_SUBFOLDER);
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}
