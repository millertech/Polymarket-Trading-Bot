export class KillSwitch {
  private enabled = false;
  private readonly listeners = new Set<(enabled: boolean) => void>();

  activate(): void {
    this.setState(true);
  }

  deactivate(): void {
    this.setState(false);
  }

  isActive(): boolean {
    return this.enabled;
  }

  setState(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    for (const listener of this.listeners) {
      try {
        listener(this.enabled);
      } catch {
        // Listener errors should not break kill-switch updates.
      }
    }
  }

  onChange(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
