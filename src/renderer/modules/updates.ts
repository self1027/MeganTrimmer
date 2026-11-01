import type { UpdateState } from '../../shared/types.js';

export function setupUpdates(): void {
  const panel = document.querySelector<HTMLDetailsElement>('#updateSettings')!;
  const status = document.querySelector<HTMLElement>('#updateStatus')!;
  const check = document.querySelector<HTMLButtonElement>('#checkUpdates')!;
  const download = document.querySelector<HTMLButtonElement>('#downloadUpdate')!;
  const install = document.querySelector<HTMLButtonElement>('#installUpdate')!;
  const silent = document.querySelector<HTMLInputElement>('#silentUpdates')!;
  const progress = document.querySelector<HTMLProgressElement>('#updateProgress')!;
  const notice = document.querySelector<HTMLButtonElement>('#updateNotice')!;
  const error = () => { status.textContent = 'Não foi possível atualizar. Tente novamente.'; };

  function render(state: UpdateState): void {
    document.querySelector('#appVersion')!.textContent = `v${state.currentVersion}`;
    const messages: Record<UpdateState['status'], string> = {
      idle: 'Verifique se há uma versão mais recente.', checking: 'Verificando atualizações…',
      available: `Versão ${state.availableVersion} disponível.`, downloading: `Baixando atualização… ${Math.round(state.percent ?? 0)}%`,
      downloaded: 'Atualização pronta. Reinicie quando quiser.', error: 'Não foi possível atualizar. Tente novamente.',
      unsupported: 'Para atualizar, baixe a versão mais recente no GitHub.',
    };
    status.textContent = state.message || messages[state.status];
    check.disabled = ['checking', 'downloading', 'downloaded', 'unsupported'].includes(state.status);
    download.hidden = !['available', 'error'].includes(state.status) || !state.availableVersion;
    install.hidden = state.status !== 'downloaded';
    progress.hidden = state.status !== 'downloading';
    progress.value = state.percent ?? 0;
    silent.disabled = state.status === 'unsupported';
    notice.hidden = !['available', 'downloaded'].includes(state.status);
    notice.textContent = state.status === 'downloaded' ? 'Atualização pronta para instalar' : `Nova versão ${state.availableVersion} disponível`;
  }

  check.addEventListener('click', () => { void window.api.checkForUpdates().then(render).catch(error); });
  notice.addEventListener('click', () => {
    panel.open = true;
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') panel.open = false; });
  document.addEventListener('click', event => {
    if (event.target instanceof Node && !panel.contains(event.target) && !notice.contains(event.target)) panel.open = false;
  });
  download.addEventListener('click', () => { void window.api.downloadUpdate().then(render).catch(error); });
  install.addEventListener('click', () => { void window.api.installUpdate().catch(error); });
  silent.addEventListener('change', async () => {
    silent.disabled = true;
    try { silent.checked = (await window.api.setSettings({ silentUpdates: silent.checked })).silentUpdates; }
    catch { silent.checked = !silent.checked; error(); }
    finally { silent.disabled = false; }
  });
  window.api.getSettings().then(settings => { silent.checked = settings.silentUpdates; }).catch(error);
  const unsubscribe = window.api.onUpdateState(render);
  window.addEventListener('beforeunload', unsubscribe, { once: true });
  void window.api.getUpdateState().then(render).catch(error);
}
