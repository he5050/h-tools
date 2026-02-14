/**
 * @fileoverview 错误监控模块集成测试
 * @description 测试错误捕获、过滤、聚合和上报功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorMonitor } from "../core/hook/error";
import { EventType, MonitorErrorEvent, MonitorPromiseRejectionEvent, ResourceErrorEvent } from "../shared/types";

describe("错误监控模块测试", () => {
  let mockEventQueue: { push: ReturnType<typeof vi.fn> };
  let errorMonitor: ErrorMonitor;

  beforeEach(() => {
    mockEventQueue = { push: vi.fn() };
    errorMonitor = new ErrorMonitor(mockEventQueue, []);
  });

  afterEach(() => {
    errorMonitor.stop();
    vi.restoreAllMocks();
  });

  describe("初始化与销毁", () => {
    it("应该正确启动错误监控", () => {
      errorMonitor.start();
      expect(errorMonitor).toBeDefined();
    });

    it("重复启动不应报错", () => {
      errorMonitor.start();
      errorMonitor.start();
      expect(errorMonitor).toBeDefined();
    });

    it("应该正确停止错误监控", () => {
      errorMonitor.start();
      errorMonitor.stop();
      expect(errorMonitor).toBeDefined();
    });

    it("停止后应该清理事件监听器", () => {
      errorMonitor.start();
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      errorMonitor.stop();
      expect(removeEventListenerSpy).toHaveBeenCalledWith("error", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
    });
  });

  describe("JS错误捕获", () => {
    it("应该捕获同步错误", () => {
      errorMonitor.start();

      const errorEvent = new ErrorEvent("error", {
        message: "Test error",
        filename: "test.js",
        lineno: 10,
        colno: 5,
        error: new Error("Test error"),
      });

      window.dispatchEvent(errorEvent);

      expect(mockEventQueue.push).toHaveBeenCalled();
      const event = mockEventQueue.push.mock.calls[0][0] as MonitorErrorEvent;
      expect(event.type).toBe(EventType.ERROR);
      expect(event.data.message).toBe("Test error");
      expect(event.data.filename).toBe("test.js");
      expect(event.data.lineno).toBe(10);
      expect(event.data.colno).toBe(5);
    });

    it("应该包含错误堆栈", () => {
      errorMonitor.start();

      const testError = new Error("Test error with stack");
      const errorEvent = new ErrorEvent("error", {
        message: "Test error",
        error: testError,
      });

      window.dispatchEvent(errorEvent);

      const event = mockEventQueue.push.mock.calls[0][0] as MonitorErrorEvent;
      expect(event.data.stack).toBeDefined();
    });

    it("应该处理没有error对象的错误事件", () => {
      errorMonitor.start();

      const errorEvent = new ErrorEvent("error", {
        message: "Script error",
        filename: "",
        lineno: 0,
        colno: 0,
      });

      window.dispatchEvent(errorEvent);

      expect(mockEventQueue.push).toHaveBeenCalled();
      const event = mockEventQueue.push.mock.calls[0][0] as MonitorErrorEvent;
      expect(event.data.message).toBe("Script error");
    });
  });

  describe("Promise拒绝捕获", () => {
    it("应该捕获Promise拒绝错误", () => {
      errorMonitor.start();

      const rejectionEvent = new Event("unhandledrejection") as PromiseRejectionEvent;
      Object.defineProperty(rejectionEvent, "reason", {
        value: new Error("Promise rejected"),
      });

      window.dispatchEvent(rejectionEvent);

      expect(mockEventQueue.push).toHaveBeenCalled();
      const event = mockEventQueue.push.mock.calls[0][0] as MonitorPromiseRejectionEvent;
      expect(event.type).toBe(EventType.PROMISE_REJECTION);
      expect(event.data.message).toBe("Promise rejected");
    });

    it("应该处理字符串类型的拒绝原因", () => {
      errorMonitor.start();

      const rejectionEvent = new Event("unhandledrejection") as PromiseRejectionEvent;
      Object.defineProperty(rejectionEvent, "reason", {
        value: "String rejection reason",
      });

      window.dispatchEvent(rejectionEvent);

      const event = mockEventQueue.push.mock.calls[0][0] as MonitorPromiseRejectionEvent;
      expect(event.data.message).toBe("String rejection reason");
    });

    it("应该处理对象类型的拒绝原因", () => {
      errorMonitor.start();

      const rejectionEvent = new Event("unhandledrejection") as PromiseRejectionEvent;
      Object.defineProperty(rejectionEvent, "reason", {
        value: { custom: "error" },
      });

      window.dispatchEvent(rejectionEvent);

      const event = mockEventQueue.push.mock.calls[0][0] as MonitorPromiseRejectionEvent;
      expect(event.data.message).toBe('{"custom":"error"}');
    });
  });

  describe("资源加载错误捕获", () => {
    it("应该捕获图片加载错误", () => {
      errorMonitor.start();

      const img = document.createElement("img");
      img.src = "non-existent-image.png";

      const errorEvent = new Event("error", { bubbles: true }) as ErrorEvent;
      Object.defineProperty(errorEvent, "target", {
        value: img,
        enumerable: true,
      });

      window.dispatchEvent(errorEvent);

      expect(mockEventQueue.push).toHaveBeenCalled();
      const event = mockEventQueue.push.mock.calls[0][0] as ResourceErrorEvent;
      expect(event.type).toBe(EventType.RESOURCE_ERROR);
      expect(event.data.tagName).toBe("img");
    });

    it("应该捕获脚本加载错误", () => {
      errorMonitor.start();

      const script = document.createElement("script");
      script.src = "non-existent-script.js";

      const errorEvent = new Event("error", { bubbles: true }) as ErrorEvent;
      Object.defineProperty(errorEvent, "target", {
        value: script,
        enumerable: true,
      });

      window.dispatchEvent(errorEvent);

      const event = mockEventQueue.push.mock.calls[0][0] as ResourceErrorEvent;
      expect(event.type).toBe(EventType.RESOURCE_ERROR);
      expect(event.data.tagName).toBe("script");
    });

    it("应该捕获样式表加载错误", () => {
      errorMonitor.start();

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "non-existent-style.css";

      const errorEvent = new Event("error", { bubbles: true }) as ErrorEvent;
      Object.defineProperty(errorEvent, "target", {
        value: link,
        enumerable: true,
      });

      window.dispatchEvent(errorEvent);

      const event = mockEventQueue.push.mock.calls[0][0] as ResourceErrorEvent;
      expect(event.type).toBe(EventType.RESOURCE_ERROR);
      expect(event.data.tagName).toBe("link");
    });
  });

  describe("错误过滤", () => {
    it("应该根据filterErrors过滤错误", () => {
      const filterPatterns = [/ignored error/i];
      errorMonitor = new ErrorMonitor(mockEventQueue, filterPatterns);
      errorMonitor.start();

      const errorEvent = new ErrorEvent("error", {
        message: "This is an ignored error",
        error: new Error("This is an ignored error"),
      });

      window.dispatchEvent(errorEvent);

      expect(mockEventQueue.push).not.toHaveBeenCalled();
    });

    it("应该允许多个过滤模式", () => {
      const filterPatterns = [/error1/i, /error2/i];
      errorMonitor = new ErrorMonitor(mockEventQueue, filterPatterns);
      errorMonitor.start();

      const errorEvent1 = new ErrorEvent("error", {
        message: "This is error1",
      });

      window.dispatchEvent(errorEvent1);
      expect(mockEventQueue.push).not.toHaveBeenCalled();

      const errorEvent2 = new ErrorEvent("error", {
        message: "This is error2",
      });

      window.dispatchEvent(errorEvent2);
      expect(mockEventQueue.push).not.toHaveBeenCalled();
    });

    it("应该根据堆栈过滤错误", () => {
      const filterPatterns = [/sensitive-file\.js/i];
      errorMonitor = new ErrorMonitor(mockEventQueue, filterPatterns);
      errorMonitor.start();

      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at sensitive-file.js:10:5";

      const errorEvent = new ErrorEvent("error", {
        message: "Test error",
        error,
      });

      window.dispatchEvent(errorEvent);

      expect(mockEventQueue.push).not.toHaveBeenCalled();
    });
  });

  describe("错误聚合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("应该聚合相同错误", () => {
      errorMonitor.start();

      const errorEvent1 = new ErrorEvent("error", {
        message: "Same error",
        filename: "test.js",
        lineno: 10,
        colno: 5,
      });

      const errorEvent2 = new ErrorEvent("error", {
        message: "Same error",
        filename: "test.js",
        lineno: 10,
        colno: 5,
      });

      window.dispatchEvent(errorEvent1);
      window.dispatchEvent(errorEvent2);

      // 只应该上报一次
      expect(mockEventQueue.push).toHaveBeenCalledTimes(1);
    });

    it("应该在聚合窗口后重新上报", () => {
      errorMonitor.start();

      const errorEvent1 = new ErrorEvent("error", {
        message: "Same error",
        filename: "test.js",
        lineno: 10,
        colno: 5,
      });

      window.dispatchEvent(errorEvent1);
      expect(mockEventQueue.push).toHaveBeenCalledTimes(1);

      // 推进时间超过聚合窗口（60秒）
      vi.advanceTimersByTime(61000);

      const errorEvent2 = new ErrorEvent("error", {
        message: "Same error",
        filename: "test.js",
        lineno: 10,
        colno: 5,
      });

      window.dispatchEvent(errorEvent2);

      // 应该再次上报
      expect(mockEventQueue.push).toHaveBeenCalledTimes(2);
    });

    it("应该记录错误发生次数", () => {
      errorMonitor.start();

      const errorEvent = new ErrorEvent("error", {
        message: "Same error",
        filename: "test.js",
        lineno: 10,
        colno: 5,
      });

      window.dispatchEvent(errorEvent);

      const event = mockEventQueue.push.mock.calls[0][0] as MonitorErrorEvent;
      expect(event.data.occurrenceCount).toBe(1);
    });
  });

  describe("错误事件数据结构", () => {
    it("应该包含正确的事件类型", () => {
      errorMonitor.start();

      const errorEvent = new ErrorEvent("error", {
        message: "Test error",
      });

      window.dispatchEvent(errorEvent);

      const event = mockEventQueue.push.mock.calls[0][0] as MonitorErrorEvent;
      expect(event.type).toBe(EventType.ERROR);
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.data).toBeDefined();
    });

    it("应该包含错误类型信息", () => {
      errorMonitor.start();

      const customError = new TypeError("Type error");
      const errorEvent = new ErrorEvent("error", {
        message: "Type error",
        error: customError,
      });

      window.dispatchEvent(errorEvent);

      const event = mockEventQueue.push.mock.calls[0][0] as MonitorErrorEvent;
      expect(event.data.errorType).toBe("TypeError");
    });

    it("应该为Promise拒绝设置正确的错误类型", () => {
      errorMonitor.start();

      const rejectionEvent = new Event("unhandledrejection") as PromiseRejectionEvent;
      Object.defineProperty(rejectionEvent, "reason", {
        value: new Error("Promise rejected"),
      });

      window.dispatchEvent(rejectionEvent);

      const event = mockEventQueue.push.mock.calls[0][0] as MonitorPromiseRejectionEvent;
      expect(event.data.errorType).toBe("UnhandledPromiseRejection");
    });
  });
});
