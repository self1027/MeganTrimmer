import { setupVideoPlayer, loadVideoFromPath } from './modules/video.js';
import { setupTimeline } from './modules/timeline.js';
import { setupDropdowns, populateExportOptions } from './modules/dropdowns.js';
import { setupExport } from './modules/export.js';
import { setupSettings } from './modules/settings.js';
import { setupResizeHandler } from './modules/thumbnails.js';

window.addEventListener('DOMContentLoaded', () => {
  setupVideoPlayer();
  setupTimeline();
  setupDropdowns();
  setupResizeHandler();
  setupExport();
  setupSettings();
  populateExportOptions();

  const externalFile = new URLSearchParams(location.search).get('externalFile');
  if (externalFile) loadVideoFromPath(externalFile);
});
