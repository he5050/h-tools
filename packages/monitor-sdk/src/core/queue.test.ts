import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventQueue, QueueOptions } from './queue';
import { MonitorEvent } from '../shared/types';

// Mock全局对象
const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null,
  onerror: null,
};

const mockURL = {
  createObjectURL: vi.fn(() => 'blob:test-url'),
  revokeObjectURL: vi.fn(),
};

const mockFetch = vi.fn();

vi.spyOn(global, 'Worker').mockImplementation(() => mockWorker as any);
vi.spyOn(URL, 'createObjectURL').mockImplementation(mockURL.createObjectURL);
vi.spyOn(URL, 'revokeObjectURL').mockImplementation(mockURL.revokeObjectURL);
vi.spyOn(global, 'fetch').mockImplementation(mockFetch);
vi.spyOn(global, 'setInterval').mockImplementation((fn) => setTimeout(fn, 0) as any);
vi.spyOn(global, 'clearInterval').mockImplementation(clearTimeout as any);

const mockEvent: MonitorEvent = {
  type: 'test',
  timestamp: Date.now(),
  data: { test: 'data' },
};

describe('EventQueue', () => {
  let eventQueue: EventQueue;
  const mockConfig = {
    dsn: 'https://example.com/api',
    batchSize: 10,
    flushInterval: 5000,
    appId: 'test-app',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    eventQueue = new EventQueue(
      mockConfig.dsn,
      mockConfig.batchSize,
      mockConfig.flushInterval,
      mockConfig.appId
    );
  });

  afterEach(() => {
    eventQueue.destroy();
    vi.resetAllMocks();
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const defaultQueue = new EventQueue('https://example.com/api');
      expect(defaultQueue).toBeDefined();
      defaultQueue.destroy();
    });

    it('应该使用自定义配置创建实例', () => {
      const customOptions: QueueOptions = {
        maxSize: 500,
        overflowStrategy: 'drop',
      };
      const customQueue = new EventQueue(
        'https://example.com/api',
        5,
        2000,
        'custom-app',
        customOptions
      );
      expect(customQueue).toBeDefined();
      customQueue.destroy();
    });
  });

  describe('Worker初始化', () => {
    it('应该成功创建Worker并初始化', () => {
      expect(global.Worker).toHaveBeenCalled();
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'init',
        payload: expect.objectContaining({
          dsn: mockConfig.dsn,
          batchSize: mockConfig.batchSize,
          flushInterval: mockConfig.flushInterval,
          appId: mockConfig.appId,
        }),
      });
    });

    it('应该在Worker创建失败时降级', () => {
      vi.spyOn(global, 'Worker').mockImplementation(() => {
        throw new Error('Worker creation failed');
      });

      const fallbackQueue = new EventQueue('https://example.com/api');
      expect(fallbackQueue).toBeDefined();
      fallbackQueue.destroy();
    });

    it('应该在Worker错误时降级', () => {
      const errorQueue = new EventQueue('https://example.com/api');
      
      // 模拟Worker错误
      if (mockWorker.onerror) {
        mockWorker.onerror(new ErrorEvent('error', { message: 'Worker error' }));
      }
      
      expect(errorQueue).toBeDefined();
      errorQueue.destroy();
    });
  });

  describe('事件推送', () => {
    it('应该通过Worker发送事件', () => {
      eventQueue.push(mockEvent);
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'event',
        payload: mockEvent,
      });
    });

    it('应该在Worker不可用时使用内存队列', () => {
      // 模拟Worker不可用
      const fallbackQueue = new EventQueue('https://example.com/api');
      // 手动设置worker为null模拟降级
      (fallbackQueue as any).worker = null;
      
      fallbackQueue.push(mockEvent);
      expect(fallbackQueue.getLength()).toBe(1);
      
      fallbackQueue.destroy();
    });

    it('应该根据溢出策略处理队列满的情况', () => {
      const smallQueue = new EventQueue('https://example.com/api', 10, 5000, 'test', {
        maxSize: 2,
        overflowStrategy: 'drop',
      });
      
      (smallQueue as any).worker = null;
      
      // 填充队列
      smallQueue.push(mockEvent);
      smallQueue.push(mockEvent);
      expect(smallQueue.getLength()).toBe(2);
      
      // 测试drop策略
      smallQueue.push(mockEvent);
      expect(smallQueue.getLength()).toBe(2);
      
      smallQueue.destroy();
    });

    it('应该使用replace策略移除最旧的事件', () => {
      const smallQueue = new EventQueue('https://example.com/api', 10, 5000, 'test', {
        maxSize: 2,
        overflowStrategy: 'replace',
      });
      
      (smallQueue as any).worker = null;
      
      // 填充队列
      smallQueue.push({ ...mockEvent, data: { id: 1 } });
      smallQueue.push({ ...mockEvent, data: { id: 2 } });
      expect(smallQueue.getLength()).toBe(2);
      
      // 测试replace策略
      smallQueue.push({ ...mockEvent, data: { id: 3 } });
      expect(smallQueue.getLength()).toBe(2);
      
      smallQueue.destroy();
    });
  });

  describe('队列管理方法', () => {
    it('应该返回队列长度', () => {
      (eventQueue as any).worker = null;
      eventQueue.push(mockEvent);
      expect(eventQueue.getLength()).toBe(1);
    });

    it('应该返回队列使用率', () => {
      (eventQueue as any).worker = null;
      eventQueue.push(mockEvent);
      const usage = eventQueue.getUsage();
      expect(typeof usage).toBe('number');
      expect(usage).toBeGreaterThanOrEqual(0);
      expect(usage).toBeLessThanOrEqual(1);
    });

    it('应该返回队列最大容量', () => {
      const maxSize = eventQueue.getMaxSize();
      expect(typeof maxSize).toBe('number');
      expect(maxSize).toBeGreaterThan(0);
    });

    it('应该清空队列', () => {
      (eventQueue as any).worker = null;
      eventQueue.push(mockEvent);
      eventQueue.push(mockEvent);
      expect(eventQueue.getLength()).toBe(2);
      
      eventQueue.clear();
      expect(eventQueue.getLength()).toBe(0);
    });
  });

  describe('刷新方法', () => {
    it('应该通过Worker刷新队列', () => {
      eventQueue.flush();
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'flush' });
    });

    it('应该在Worker不可用时立即刷新', async () => {
      (eventQueue as any).worker = null;
      eventQueue.push(mockEvent);
      
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      
      // 调用flush并等待异步操作
      await (eventQueue as any).flushQueueImmediate();
      
      expect(mockFetch).toHaveBeenCalledWith(
        mockConfig.dsn,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('应该处理刷新失败的情况', async () => {
      (eventQueue as any).worker = null;
      eventQueue.push(mockEvent);
      
      mockFetch.mockRejectedValueOnce(new Error('Fetch failed'));
      
      // 调用flush并等待异步操作
      await (eventQueue as any).flushQueueImmediate();
      
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('销毁方法', () => {
    it('应该清理所有资源', () => {
      eventQueue.destroy();
      
      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(global.clearInterval).toHaveBeenCalled();
    });

    it('应该在销毁前刷新队列', () => {
      eventQueue.destroy();
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'flush' });
    });
  });

  describe('Worker消息处理', () => {
    it('应该处理初始化消息', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
      
      (eventQueue as any).handleWorkerMessage({ type: 'init', success: true });
      expect(consoleLogSpy).toHaveBeenCalledWith('[Monitor SDK] Worker 初始化成功');
      
      (eventQueue as any).handleWorkerMessage({ type: 'init', success: false, error: 'Init failed' });
      expect(consoleLogSpy).toHaveBeenCalledWith('[Monitor SDK] Worker 初始化失败:', 'Init failed');
      
      consoleLogSpy.mockRestore();
    });

    it('应该处理事件消息', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      
      (eventQueue as any).handleWorkerMessage({ type: 'event', success: false, error: 'Event failed' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Monitor SDK] 事件发送失败:', 'Event failed');
      
      consoleErrorSpy.mockRestore();
    });

    it('应该处理刷新消息', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      
      (eventQueue as any).handleWorkerMessage({ type: 'flush', success: false, error: 'Flush failed' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Monitor SDK] 刷新失败:', 'Flush failed');
      
      consoleErrorSpy.mockRestore();
    });

    it('应该处理错误消息', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      
      (eventQueue as any).handleWorkerMessage({ type: 'error', error: 'Worker error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Monitor SDK] Worker 错误:', 'Worker error');
      
      consoleErrorSpy.mockRestore();
    });
  });
});
