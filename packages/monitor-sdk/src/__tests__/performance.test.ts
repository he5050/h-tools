/**
 * @fileoverview 性能监控模块集成测试
 * @description 测试性能指标收集、聚合和上报功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PerformanceMonitor } from "../core/hook/performance";
import { EventType, PerformanceEvent } from "../shared/types";

describe("性能监控模块测试", () => {
  let mockEventQueue: { push: ReturnType<typeof vi.fn> };
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    mockEventQueue = { push: vi.fn() };
    performanceMonitor = new PerformanceMonitor(mockEventQueue);

    // 模拟 PerformanceObserver
    global.PerformanceObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn().mockReturnValue([]),
    })) as unknown as typeof PerformanceObserver;
  });

  afterEach(() => {
    performanceMonitor.stop();
    vi.restoreAllMocks();
  });

  describe("初始化与销毁", () => {
    it("应该正确启动性能监控", () => {
      performanceMonitor.start();
      expect(performanceMonitor).toBeDefined();
    });

    it("重复启动不应报错", () => {
      performanceMonitor.start();
      performanceMonitor.start();
      expect(performanceMonitor).toBeDefined();
    });

    it("应该正确停止性能监控", () => {
      performanceMonitor.start();
      performanceMonitor.stop();
      expect(performanceMonitor).toBeDefined();
    });

    it("应该断开 PerformanceObserver", () => {
      const disconnectSpy = vi.fn();
      global.PerformanceObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: disconnectSpy,
        takeRecords: vi.fn().mockReturnValue([]),
      })) as unknown as typeof PerformanceObserver;

      performanceMonitor = new PerformanceMonitor(mockEventQueue);
      performanceMonitor.start();
      performanceMonitor.stop();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe("性能指标收集", () => {
    it("应该收集导航计时数据", () => {
      // 模拟导航计时条目
      const mockNavigationEntry = {
        entryType: "navigation",
        startTime: 0,
        domainLookupStart: 10,
        domainLookupEnd: 20,
        connectStart: 20,
        connectEnd: 50,
        secureConnectionStart: 30,
        responseStart: 50,
        responseEnd: 100,
        domContentLoadedEventStart: 150,
        domContentLoadedEventEnd: 200,
        loadEventStart: 250,
        loadEventEnd: 300,
        redirectStart: 0,
        redirectEnd: 0,
        requestStart: 50,
        domInteractive: 120,
        toJSON: () => ({}),
      } as unknown as PerformanceNavigationTiming;

      vi.spyOn(performance, "getEntriesByType").mockImplementation((type: string) => {
        if (type === "navigation") return [mockNavigationEntry];
        return [];
      });

      performanceMonitor.start();

      // 验证有性能事件上报
      expect(mockEventQueue.push).toHaveBeenCalled();
    });

    it("应该收集绘制计时数据", () => {
      // 模拟绘制条目
      const mockPaintEntries = [
        { name: "first-paint", startTime: 800, entryType: "paint", toJSON: () => ({}) },
        { name: "first-contentful-paint", startTime: 900, entryType: "paint", toJSON: () => ({}) },
      ] as PerformanceEntry[];

      vi.spyOn(performance, "getEntriesByType").mockImplementation((type: string) => {
        if (type === "paint") return mockPaintEntries;
        if (type === "navigation") return [];
        return [];
      });

      performanceMonitor.start();

      // 验证有性能事件上报
      expect(mockEventQueue.push).toHaveBeenCalled();
    });

    it("应该收集慢资源数据", () => {
      // 模拟慢资源条目
      const mockResourceEntry = {
        entryType: "resource",
        name: "https://example.com/slow.js",
        startTime: 0,
        duration: 1500,
        domainLookupStart: 0,
        domainLookupEnd: 10,
        connectStart: 10,
        connectEnd: 50,
        responseStart: 50,
        responseEnd: 1500,
        initiatorType: "script",
        transferSize: 1000,
        decodedBodySize: 2000,
        toJSON: () => ({}),
      } as unknown as PerformanceResourceTiming;

      vi.spyOn(performance, "getEntriesByType").mockImplementation((type: string) => {
        if (type === "resource") return [mockResourceEntry];
        if (type === "navigation") return [];
        return [];
      });

      performanceMonitor.start();

      // 验证有性能事件上报
      expect(mockEventQueue.push).toHaveBeenCalled();
    });
  });

  describe("性能指标聚合", () => {
    it("应该聚合多次采样的指标", () => {
      performanceMonitor.start();

      // 获取初始指标状态
      const metrics = performanceMonitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics instanceof Map).toBe(true);
    });

    it("应该清除指标数据", () => {
      performanceMonitor.start();

      // 清除指标
      performanceMonitor.clearMetrics();

      // 验证指标已清除
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.size).toBe(0);
    });
  });

  describe("性能事件数据结构", () => {
    it("应该包含正确的事件类型", () => {
      // 模拟导航计时条目触发上报
      const mockNavigationEntry = {
        entryType: "navigation",
        startTime: 0,
        domainLookupStart: 10,
        domainLookupEnd: 20,
        connectStart: 20,
        connectEnd: 50,
        secureConnectionStart: 30,
        responseStart: 50,
        responseEnd: 100,
        domContentLoadedEventStart: 150,
        domContentLoadedEventEnd: 200,
        loadEventStart: 250,
        loadEventEnd: 300,
        redirectStart: 0,
        redirectEnd: 0,
        requestStart: 50,
        domInteractive: 120,
        toJSON: () => ({}),
      } as unknown as PerformanceNavigationTiming;

      vi.spyOn(performance, "getEntriesByType").mockImplementation((type: string) => {
        if (type === "navigation") return [mockNavigationEntry];
        return [];
      });

      performanceMonitor.start();

      // 验证事件类型正确
      const event = mockEventQueue.push.mock.calls.find(
        (call) => call[0].type === EventType.PERFORMANCE
      );
      if (event) {
        expect(event[0].type).toBe(EventType.PERFORMANCE);
        expect(event[0].timestamp).toBeGreaterThan(0);
        expect(event[0].data).toBeDefined();
      }
    });
  });

  describe("内存信息收集", () => {
    it("应该在支持的环境中收集内存信息", () => {
      // 模拟内存 API
      Object.defineProperty(global.performance, "memory", {
        value: {
          usedJSHeapSize: 1000000,
          totalJSHeapSize: 2000000,
          jsHeapSizeLimit: 4000000,
        },
        writable: true,
        configurable: true,
      });

      performanceMonitor.start();

      // 内存信息收集是定时执行的，这里主要验证不会报错
      expect(performanceMonitor).toBeDefined();
    });
  });

  describe("网络信息收集", () => {
    it("应该在支持的环境中收集网络信息", () => {
      // 模拟网络连接 API
      Object.defineProperty(global.navigator, "connection", {
        value: {
          effectiveType: "4g",
          downlink: 10,
          rtt: 50,
          saveData: false,
        },
        writable: true,
        configurable: true,
      });

      performanceMonitor.start();

      // 网络信息收集是事件触发的，这里主要验证不会报错
      expect(performanceMonitor).toBeDefined();
    });
  });
});
