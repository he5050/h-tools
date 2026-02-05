import { InitConfig } from '../shared/types';
import { SessionManager } from './session';

export class Monitor {
  private config: InitConfig;
  private sessionManager: SessionManager;

  constructor(config: InitConfig) {
    this.config = config;
    this.sessionManager = new SessionManager();
    this.init();
  }

  private init() {
    console.log('[Monitor SDK] Initializing with config:', this.config);
    // TODO: Initialize hooks and worker
  }

  public track(name: string, data: any) {
    // Custom track logic
  }
}

export function init(config: InitConfig) {
  return new Monitor(config);
}
