export const els = {
  video: document.getElementById('preview') as HTMLVideoElement | null,
  btnSelect: document.getElementById('select') as HTMLButtonElement | null,
  btnExport: document.getElementById('btn') as HTMLButtonElement | null,
  playPause: document.getElementById('playPause') as HTMLButtonElement | null,
  muteBtn: document.getElementById('muteBtn') as HTMLButtonElement | null,
  volumeSlider: document.getElementById('volume') as HTMLInputElement | null,

  formatSelect: document.getElementById('formatSelect') as HTMLSelectElement | null,
  resolutionSelect: document.getElementById('resolutionSelect') as HTMLSelectElement | null,
  frameRateSelect: document.getElementById('frameRateSelect') as HTMLSelectElement | null,

  startRange: document.getElementById('startRange') as HTMLInputElement | null,
  endRange: document.getElementById('endRange') as HTMLInputElement | null,
  playhead: document.getElementById('playhead') as HTMLInputElement | null,
  timeline: document.getElementById('timeline') as HTMLDivElement | null,
  startDisplay: document.getElementById('startDisplay') as HTMLElement | null,
  endDisplay: document.getElementById('endDisplay') as HTMLElement | null,
  selectedDurationSpan: document.getElementById('selectedDuration') as HTMLElement | null,
  playheadLine: document.getElementById('playheadLine') as HTMLDivElement | null,
  framesContainer: document.getElementById('framesContainer') as HTMLDivElement | null,

  settingsToggle: document.getElementById('settingsToggle') as HTMLButtonElement | null,
  settingsPanel: document.getElementById('settingsPanel') as HTMLDivElement | null,
  outputFolderText: document.getElementById('outputFolderText') as HTMLParagraphElement | null,
  pickFolderBtn: document.getElementById('pickFolderBtn') as HTMLButtonElement | null,
  resetFolderBtn: document.getElementById('resetFolderBtn') as HTMLButtonElement | null,
};
