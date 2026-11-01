import type { UpdateState } from '../../shared/types.js';

export function setupUpdates(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#updateDialog')!;
  const status = document.querySelector<HTMLElement>('#updateStatus')!;
  const check = document.querySelector<HTMLButtonElement>('#checkUpdates')!;
  const update = document.querySelector<HTMLButtonElement>('#updateNow')!;
  const skip = document.querySelector<HTMLButtonElement>('#skipUpdate')!;
  const progress = document.querySelector<HTMLProgressElement>('#updateProgress')!;
  let current: UpdateState;
  let declinedVersion: string | undefined;
  let chosenUpdate = false;
  let restarting = false;

  function open(): void { if (!dialog.open) dialog.showModal(); }
  function failure(): void {
    chosenUpdate = false;
    update.disabled = false;
    status.textContent = 'Não foi possível atualizar. Tente novamente ou continue sem atualizar.';
  }
  async function restart(): Promise<void> {
    if (restarting) return;
    chosenUpdate = false;
    restarting = true;
    update.disabled = true;
    try {
      if (!await window.api.installUpdate()) {
        status.textContent = 'Você pode continuar editando ou tentar atualizar quando estiver pronto.';
      }
    } catch { failure(); }
    finally { restarting = false; update.disabled = false; }
  }
  function render(state: UpdateState): void {
    current = state;
    document.querySelector('#appVersion')!.textContent = `v${state.currentVersion}`;
    const messages: Record<UpdateState['status'], string> = {
      idle: 'Você está na versão mais recente.', checking: 'Verificando atualizações…',
      available: `A versão ${state.availableVersion} está disponível. Quer atualizar agora?`,
      downloading: `Baixando atualização… ${Math.round(state.percent ?? 0)}%`,
      downloaded: 'Atualização pronta. Reinicie para instalar.',
      error: 'Não foi possível atualizar. Tente novamente ou continue sem atualizar.',
      unsupported: 'Baixe a versão mais recente pelo link do GitHub Releases.',
    };
    status.textContent = state.message || messages[state.status];
    check.disabled = state.status === 'checking';
    check.title = messages[state.status];
    update.disabled = ['checking', 'downloading', 'unsupported'].includes(state.status) || restarting;
    update.textContent = state.status === 'downloaded' ? 'Reiniciar e atualizar' : state.status === 'error' ? 'Tentar novamente' : 'Atualizar agora';
    progress.hidden = state.status !== 'downloading';
    progress.value = state.percent ?? 0;
    if (state.status === 'error') chosenUpdate = false;
    if (state.availableVersion && state.availableVersion !== declinedVersion &&
        ['available', 'downloaded', 'error'].includes(state.status)) open();
    if (state.status === 'downloaded' && chosenUpdate) void restart();
  }

  dialog.addEventListener('cancel', event => event.preventDefault());
  skip.addEventListener('click', () => {
    declinedVersion = current?.availableVersion;
    chosenUpdate = false;
    dialog.close();
  });
  update.addEventListener('click', async () => {
    chosenUpdate = true;
    if (current.status === 'downloaded') { void restart(); return; }
    try {
      if (!current.availableVersion) await window.api.checkForUpdates();
      if (current.status === 'available' || current.availableVersion) await window.api.downloadUpdate();
    } catch { failure(); }
  });
  check.addEventListener('click', async () => {
    declinedVersion = undefined;
    if (current && ['available', 'downloaded', 'downloading', 'unsupported'].includes(current.status)) {
      open(); return;
    }
    try { render(await window.api.checkForUpdates()); } catch { failure(); }
  });
  const unsubscribe = window.api.onUpdateState(render);
  window.addEventListener('beforeunload', unsubscribe, { once: true });
  void window.api.getUpdateState().then(render).catch(failure);
}
