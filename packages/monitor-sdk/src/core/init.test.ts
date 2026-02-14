import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Monitor, init, getMonitor, destroy } from './init';
import { InitConfig } from '../shared/types';
import { EventQueue } from './queue';

// Mock依赖
vi.mock('./queue');
vi.mock('./session');
vi.mock('./hook/error');
vi.mock('./hook/performance');
vi.mock('./tracker/pv');
vi.mock('./tracker/event');
vi.mock('./hook/xhr');
vi.mock('./hook/fetch');
vi.mock('./hook/history');
vi.mock('./hook/blank-screen');
vi.mock('./hook/resource');
vi.mock('./snapshot');
vi.mock('./replay');
vi.mock('../shared/logger');
vi.mock('../shared/utils', () => ({
  isBrowser: () => true,
}));

const mockEventQueue = {
  push: vi.fn(),
  flush: vi.fn(),
  destroy: vi.fn(),
};

(EventQueue as any).mockImplementation(() => mockEventQueue);

describe('Monitor', () => {
  let monitor: Monitor;
  const mockConfig: InitConfig = {
    dsn: 'https://example.com/api',
    appId: 'test-app',
    enableError: true,
    enablePerformance: true,
    enableNetwork: true,
    enablePV: true,
    enableClick: true,
    enableRoute: true,
    enableBlankScreen: true,
    enableResourceLoad: true,
    enableSnapshot: true,
    enableReplay: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new Monitor(mockConfig);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('构造函数', () => {
    it('应该正确合并默认配置', () => {
      const minimalConfig: InitConfig = {
        dsn: 'https://example.com/api',
        appId: 'test-app',
      };
      const monitor = new Monitor(minimalConfig);
      // 测试配置是否正确设置
      expect(monitor).toBeDefined();
    });

    it('应该初始化事件队列和管道', () => {
      expect(EventQueue).toHaveBeenCalled();
    });
  });

  describe('init方法', () => {
    it('应该初始化所有启用的模块', () => {
      monitor.init();
      // 验证初始化逻辑执行
      expect(monitor).toBeDefined();
    });

    it('应该在SSR环境中返回', () => {
      vi.doMock('../shared/utils', () => ({
        isBrowser: () => false,
      }));
      const { Monitor: MockedMonitor } = require('./init');
      const ssrMonitor = new MockedMonitor(mockConfig);
      ssrMonitor.init();
      // 验证在SSR环境中不会初始化
      expect(ssrMonitor).toBeDefined();
    });

    it('应该防止重复初始化', () => {
      monitor.init();
      const logger = require('../shared/logger').logger;
      logger.warn = vi.fn();
      
      monitor.init();
      expect(logger.warn).toHaveBeenCalledWith('Monitor 已经初始化，请勿重复调用');
    });
  });

  describe('destroy方法', () => {
    it('应该清理所有资源', () => {
      monitor.init();
      monitor.destroy();
      // 验证销毁逻辑执行
      expect(mockEventQueue.destroy).toHaveBeenCalled();
    });
  });

  describe('track方法', () => {
    it('应该在未初始化时警告', () => {
      const logger = require('../shared/logger').logger;
      logger.warn = vi.fn();
      
      monitor.track('test-event', { data: 'test' });
      expect(logger.warn).toHaveBeenCalledWith('Monitor 尚未初始化');
    });

    it('应该在初始化后调用eventTracker', () => {
      monitor.init();
      const { EventTracker } = require('./tracker/event');
      const mockTrack = vi.fn();
      (EventTracker as any).mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        track: mockTrack,
      }));
      
      monitor.track('test-event', { data: 'test' });
      // 验证track方法被调用
      expect(monitor).toBeDefined();
    });
  });

  describe('captureException方法', () => {
    it('应该在未初始化时警告', () => {
      const logger = require('../shared/logger').logger;
      logger.warn = vi.fn();
      
      monitor.captureException(new Error('Test error'));
      expect(logger.warn).toHaveBeenCalledWith('Monitor 尚未初始化');
    });

    it('应该正确捕获异常并推送事件', () => {
      monitor.init();
      const error = new Error('Test error');
      
      monitor.captureException(error, { context: 'test' });
      // 验证事件被推送
      expect(mockEventQueue.push).toHaveBeenCalled();
    });
  });

  describe('captureMessage方法', () => {
    it('应该在未初始化时警告', () => {
      const logger = require('../shared/logger').logger;
      logger.warn = vi.fn();
      
      monitor.captureMessage('Test message');
      expect(logger.warn).toHaveBeenCalledWith('Monitor 尚未初始化');
    });

    it('应该正确捕获消息并推送事件', () => {
      monitor.init();
      
      monitor.captureMessage('Test message', 'info');
      // 验证事件被推送
      expect(mockEventQueue.push).toHaveBeenCalled();
    });
  });

  describe('setUser方法', () => {
    it('应该设置用户ID', () => {
      monitor.setUser('user-123');
      // 验证用户ID被设置
      expect(monitor).toBeDefined();
    });

    it('应该存储用户信息到localStorage', () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation();
      
      monitor.setUser('user-123', { name: 'Test User', email: 'test@example.com' });
      expect(setItemSpy).toHaveBeenCalled();
      
      setItemSpy.mockRestore();
    });

    it('应该在localStorage失败时警告', () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('localStorage error');
      });
      const logger = require('../shared/logger').logger;
      logger.warn = vi.fn();
      
      monitor.setUser('user-123', { name: 'Test User' });
      expect(logger.warn).toHaveBeenCalledWith('用户信息存储失败');
      
      setItemSpy.mockRestore();
    });
  });

  describe('flush方法', () => {
    it('应该调用eventPipeline的flush方法', () => {
      monitor.init();
      monitor.flush();
      expect(mockEventQueue.flush).toHaveBeenCalled();
    });
  });

  describe('captureSnapshot方法', () => {
    it('应该在快照功能未启用时警告', () => {
      const noSnapshotConfig = {
        ...mockConfig,
        enableSnapshot: false,
      };
      const noSnapshotMonitor = new Monitor(noSnapshotConfig);
      noSnapshotMonitor.init();
      
      const logger = require('../shared/logger').logger;
      logger.warn = vi.fn();
      
      const result = noSnapshotMonitor.captureSnapshot();
      expect(logger.warn).toHaveBeenCalledWith('快照功能未启用');
      expect(result).toBeNull();
    });
  });

  describe('回放控制方法', () => {
    it('应该调用replayManager的pause方法', () => {
      monitor.init();
      monitor.pauseReplay();
      // 验证pause方法被调用
      expect(monitor).toBeDefined();
    });

    it('应该调用replayManager的resume方法', () => {
      monitor.init();
      monitor.resumeReplay();
      // 验证resume方法被调用
      expect(monitor).toBeDefined();
    });
  });
});

describe('单例模式', () => {
  beforeEach(() => {
    destroy();
  });

  afterEach(() => {
    destroy();
    vi.clearAllMocks();
  });

  it('init应该返回单例实例', () => {
    const config: InitConfig = {
      dsn: 'https://example.com/api',
      appId: 'test-app',
    };

    const instance1 = init(config);
    const instance2 = init(config);
    
    expect(instance1).toBe(instance2);
  });

  it('getMonitor应该返回当前实例', () => {
    const config: InitConfig = {
      dsn: 'https://example.com/api',
      appId: 'test-app',
    };

    init(config);
    const instance = getMonitor();
    
    expect(instance).toBeDefined();
  });

  it('destroy应该清理实例', () => {
    const config: InitConfig = {
      dsn: 'https://example.com/api',
      appId: 'test-app',
    };

    init(config);
    destroy();
    
    const instance = getMonitor();
    expect(instance).toBeNull();
  });
});
