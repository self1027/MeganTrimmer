export class ExitGuard {
  private pending = false;
  constructor(private busy: () => boolean, private dirty: () => boolean,
    private confirmDiscard: () => Promise<boolean>) {}

  async approve(): Promise<boolean> {
    if (this.pending || this.busy()) return false;
    this.pending = true;
    try {
      const approved = !this.dirty() || await this.confirmDiscard();
      return approved && !this.busy();
    } finally { this.pending = false; }
  }
}
