import { v4 as uuidv4 } from 'uuid';

export class SessionManager {
  private sessionId: string;

  constructor() {
    this.sessionId = this.getOrGenerateSessionId();
  }

  private getOrGenerateSessionId(): string {
    const id = localStorage.getItem('monitor_session_id');
    if (id) return id;

    const newId = uuidv4();
    localStorage.setItem('monitor_session_id', newId);
    return newId;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getPageInfo() {
    return {
      url: window.location.href,
      route: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
    };
  }
}
