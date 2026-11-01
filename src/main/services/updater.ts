import type { UpdateState } from '../../shared/types.js';

// Structural port keeps the controller testable without starting Electron or making network requests.
export interface UpdaterPort {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(silent: boolean, relaunch: boolean): void;
}

export class UpdateService {
  private state: UpdateState;
  private listeners = new Set<(state: UpdateState) => void>();
  private checking = false;
  private downloading = false;
  private ready = false;
  private installing = false;

  constructor(private updater: UpdaterPort | null, version: string, private silent = false,
    private canInstall: () => boolean = () => true) {
    this.state = { status: updater ? 'idle' : 'unsupported', currentVersion: version };
    if (!updater) return;
    updater.autoDownload = false;
    // The close controller owns scheduling so changing the preference also affects cached downloads.
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.on('update-available', info => {
      this.publish({ status: 'available', availableVersion: info.version, message: undefined });
      if (this.silent) void this.download();
    });
    updater.on('update-not-available', () => this.publish({ status: 'idle', message: 'Você está na versão mais recente.' }));
    updater.on('download-progress', progress => this.publish({
      status: 'downloading', percent: Math.max(0, Math.min(100, progress.percent)),
    }));
    updater.on('update-downloaded', info => {
      this.ready = true;
      this.publish({ status: 'downloaded', availableVersion: info.version, percent: 100, message: undefined });
    });
    updater.on('error', () => this.fail());
  }

  getState(): UpdateState { return { ...this.state }; }

  subscribe(listener: (state: UpdateState) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  setSilent(enabled: boolean): void {
    this.silent = enabled;
    if (enabled && this.state.status === 'available') void this.download();
  }

  private publish(patch: Partial<UpdateState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener(this.getState()));
  }

  private fail(): void {
    this.ready = false;
    this.publish({ status: 'error', message: 'Não foi possível atualizar. Verifique a conexão e tente novamente.' });
  }

  async check(): Promise<UpdateState> {
    if (!this.updater || this.checking || this.downloading || this.ready || this.installing) return this.getState();
    this.checking = true;
    this.publish({ status: 'checking', message: undefined });
    try { await this.updater.checkForUpdates(); }
    catch { this.fail(); }
    finally { this.checking = false; }
    return this.getState();
  }

  async download(): Promise<UpdateState> {
    if (!this.updater || !this.state.availableVersion || this.downloading || this.ready || this.installing) return this.getState();
    this.downloading = true;
    this.publish({ status: 'downloading', percent: 0, message: undefined });
    try { await this.updater.downloadUpdate(); }
    catch { this.fail(); }
    finally { this.downloading = false; }
    return this.getState();
  }

  install(relaunch: boolean): boolean {
    if (!this.updater || !this.ready || this.installing || !this.canInstall()) return false;
    this.installing = true;
    try { this.updater.quitAndInstall(true, relaunch); return true; }
    catch { this.installing = false; this.fail(); return false; }
  }

  installOnClose(): boolean { return this.silent && this.install(false); }
}
