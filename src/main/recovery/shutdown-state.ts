import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type PreviousRunState = 'first-run' | 'clean' | 'unclean' | 'invalid';

type RuntimeState = {
  schemaVersion: 1;
  sessionId: string;
  status: 'running' | 'clean';
  startedAt: string;
  endedAt?: string;
};

function isRuntimeState(value: unknown): value is RuntimeState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RuntimeState>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.sessionId === 'string' &&
    (candidate.status === 'running' || candidate.status === 'clean') &&
    typeof candidate.startedAt === 'string'
  );
}

export class ShutdownState {
  private currentState: RuntimeState | null = null;

  public constructor(private readonly statePath: string) {
    mkdirSync(dirname(statePath), { recursive: true });
  }

  public inspectPreviousRun(): PreviousRunState {
    try {
      const raw = readFileSync(this.statePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);

      if (!isRuntimeState(parsed)) {
        return 'invalid';
      }

      return parsed.status === 'clean' ? 'clean' : 'unclean';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return 'first-run';
      }

      return 'invalid';
    }
  }

  public markRunning(sessionId: string): void {
    const state: RuntimeState = {
      schemaVersion: 1,
      sessionId,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    this.currentState = state;
    this.writeState(state);
  }

  public markClean(): void {
    if (!this.currentState) {
      return;
    }

    const state: RuntimeState = {
      ...this.currentState,
      status: 'clean',
      endedAt: new Date().toISOString(),
    };

    this.currentState = state;
    this.writeState(state);
  }

  private writeState(state: RuntimeState): void {
    const tempPath = `${this.statePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8' });

    try {
      renameSync(tempPath, this.statePath);
    } catch {
      rmSync(this.statePath, { force: true });
      renameSync(tempPath, this.statePath);
    }
  }
}
