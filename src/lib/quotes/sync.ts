export type QuoteBundle = { quotes: unknown[]; seq: number };
export type SyncStatus = "loading" | "saving" | "saved" | "failed" | "ready";

type QueueOptions<T> = {
  read: () => T;
  save: (snapshot: T) => Promise<unknown>;
  onStatus?: (status: SyncStatus, error?: unknown) => void;
  delay?: number;
};

/** Single-flight, latest-snapshot save queue. Call changed() after local mutations. */
export class SaveQueue<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;
  private persistedRevision = 0;
  private running = false;
  private disposed = false;
  private failure: unknown;
  private readonly delay: number;
  private readonly options: QueueOptions<T>;

  constructor(options: QueueOptions<T>) {
    this.options = options;
    this.delay = options.delay ?? 400;
  }

  changed() {
    if (this.disposed) return;
    this.revision += 1;
    this.failure = undefined;
    this.options.onStatus?.("saving");
    if (this.running) return;
    this.schedule();
  }

  retry() {
    if (this.disposed || this.running || this.revision === this.persistedRevision) return;
    this.failure = undefined;
    this.options.onStatus?.("saving");
    this.schedule(0);
  }

  get isDirty() {
    return this.revision !== this.persistedRevision;
  }

  get isFailed() {
    return this.failure !== undefined;
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(delay = this.delay) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delay);
  }

  private async flush() {
    if (this.disposed || this.running || !this.isDirty) return;
    this.running = true;
    try {
      while (!this.disposed && this.isDirty) {
        const revision = this.revision;
        // Read at execution time, never from a stale subscription callback.
        const snapshot = this.options.read();
        try {
          await this.options.save(snapshot);
        } catch (error) {
          if (!this.disposed) {
            this.failure = error;
            this.options.onStatus?.("failed", error);
          }
          return;
        }
        if (this.disposed) return;
        this.persistedRevision = revision;
        this.failure = undefined;
      }
      if (!this.disposed) this.options.onStatus?.("saved");
    } finally {
      this.running = false;
    }
  }
}
