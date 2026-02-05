export enum EventType {
  // 异常监控
  JS_ERROR = 'js_error',
  PROMISE_ERROR = 'promise_error',
  RESOURCE_ERROR = 'resource_error',

  // 性能监控
  LCP = 'lcp',
  FID = 'fid',
  CLS = 'cls',
  FP = 'fp',
  FCP = 'fcp',

  // 行为监控
  PV = 'pv',
  CLICK = 'click',
  STAY_DURATION = 'stay_duration',

  // 网络监控
  XHR = 'xhr',
  FETCH = 'fetch',

  // 录制与快照
  REPLAY = 'replay',
  SNAPSHOT = 'snapshot'
}

export interface BaseEvent {
  type: EventType;
  timestamp: number;
  sessionId: string;
  page: {
    url: string;
    route: string;
    title: string;
    referrer: string;
  };
  user?: {
    id?: string;
    name?: string;
    [key: string]: any;
  };
}

export interface InitConfig {
  dsn: string;
  appId: string;
  userId?: string;
  reportType?: 'beacon' | 'xhr' | 'fetch';
  enableReplay?: boolean;
  enableSnapshot?: boolean;
  sampleRate?: number; // 0-1
}

export interface WorkerMessage {
  type: 'EVENT' | 'CONFIG' | 'FLUSH';
  payload: any;
}
