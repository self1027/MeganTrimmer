import { els } from './dom.js';
import type { AppSettings } from '../../shared/types.js';

const { settingsToggle, settingsPanel, outputFolderText, pickFolderBtn, resetFolderBtn } = els;

const DEFAULT_FOLDER_LABEL = 'Padrão (Vídeos/MeganTrimmer)';

function loadSettingsIntoPanel(settings: Pick<AppSettings, 'outputFolder'>): void {
  if (outputFolderText) {
    outputFolderText.textContent = settings.outputFolder || DEFAULT_FOLDER_LABEL;
  }
}

async function pickOutputFolder(): Promise<void> {
  const folder = await window.api.pickOutputFolder();
  // Cancelado → null → o texto exibido permanece o anterior.
  if (folder) loadSettingsIntoPanel({ outputFolder: folder });
}

async function restoreDefault(): Promise<void> {
  loadSettingsIntoPanel(await window.api.setSettings({ outputFolder: '' }));
}

export function setupSettings(): void {
  settingsToggle?.addEventListener('click', async () => {
    settingsPanel?.classList.toggle('hidden');
    const isOpen = !!settingsPanel && !settingsPanel.classList.contains('hidden');
    settingsToggle.classList.toggle('active', isOpen);
    settingsToggle.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) loadSettingsIntoPanel(await window.api.getSettings());
  });

  pickFolderBtn?.addEventListener('click', pickOutputFolder);
  resetFolderBtn?.addEventListener('click', restoreDefault);
  window.api.getSettings().then(loadSettingsIntoPanel).catch(console.error);
}
