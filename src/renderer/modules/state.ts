import type { ExportOptionItem } from '../../shared/types.js';
import type { EditSnapshot } from '../../shared/edit-session.js';

export const state = {
  exporting: false,
  loading: false,
  ready: false,
  loadGeneration: 0,
  thumbnailGeneration: 0,
  savedEdit: null as EditSnapshot | null,
  selectedPath: null as string | null,
  duration: 0,
  rafId: null as number | null,
  scrubAnimationFrame: null as number | null,
  resizeTimeout: undefined as ReturnType<typeof setTimeout> | undefined,

  // Store full lists & original video fps
  originalResolutions: [] as ExportOptionItem[],
  originalFrameRates: [] as ExportOptionItem[],
  formatOptions: [] as ExportOptionItem[],
  originalFps: 0,   // real fps of loaded video
};

export const MIN_GAP = 0.1;
