import { setupVideoPlayer, loadVideoFromPath } from './modules/video.js';
import { setupTimeline } from './modules/timeline.js';
import { setupDropdowns, populateExportOptions } from './modules/dropdowns.js';
import { setupExport } from './modules/export.js';
import { setupSettings } from './modules/settings.js';
import { setupResizeHandler } from './modules/thumbnails.js';
import { setupSession } from './modules/session.js';

window.addEventListener('DOMContentLoaded', async () => {
  setupVideoPlayer();
  setupTimeline();
  setupDropdowns();
  setupResizeHandler();
  setupExport();
  setupSettings();
  setupSession();
  await populateExportOptions();

  const externalFile = new URLSearchParams(location.search).get('externalFile');
  if (externalFile) loadVideoFromPath(externalFile);
});
