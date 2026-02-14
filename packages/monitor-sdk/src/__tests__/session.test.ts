/**
 * @fileoverview 会话管理模块测试
 * @description 测试 SessionManager 的会话 ID 管理和页面信息获取
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionManager } from "../core/session";

describe("SessionManager 测试", () => {
  const SESSION_KEY = "monitor_session_id";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("会话 ID 生成", () => {
    it("应该生成新的 Session ID", () => {
      const sessionManager = new SessionManager();
      const sessionId = sessionManager.getSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it("生成的 Session ID 应该符合格式", () => {
      const sessionManager = new SessionManager();
      const sessionId = sessionManager.getSessionId();

      // 格式: timestamp-random
      expect(sessionId).toMatch(/^\d+-[a-z0-9]{9}$/);
    });

    it("应该将 Session ID 存储到 localStorage", () => {
      const sessionManager = new SessionManager();
      const sessionId = sessionManager.getSessionId();

      const storedValue = localStorage.getItem(SESSION_KEY);
      // localStorage 存储的是 JSON 序列化后的值，需要解析
      expect(storedValue).toBe(JSON.stringify(sessionId));
    });
  });

  describe("会话 ID 恢复", () => {
    it("应该从 localStorage 恢复已有的 Session ID", () => {
      const existingId = "1234567890-abc123def";
      localStorage.setItem(SESSION_KEY, JSON.stringify(existingId));

      const sessionManager = new SessionManager();
      const sessionId = sessionManager.getSessionId();

      expect(sessionId).toBe(existingId);
    });

    it("多个实例应该共享同一个 Session ID", () => {
      const sessionManager1 = new SessionManager();
      const id1 = sessionManager1.getSessionId();

      const sessionManager2 = new SessionManager();
      const id2 = sessionManager2.getSessionId();

      expect(id1).toBe(id2);
    });
  });

  describe("会话重置", () => {
    it("应该生成新的 Session ID", () => {
      const sessionManager = new SessionManager();
      const oldId = sessionManager.getSessionId();

      sessionManager.resetSession();
      const newId = sessionManager.getSessionId();

      expect(newId).not.toBe(oldId);
      expect(newId).toBeDefined();
      expect(typeof newId).toBe("string");
    });

    it("应该更新 localStorage 中的 Session ID", () => {
      const sessionManager = new SessionManager();
      const oldId = sessionManager.getSessionId();

      sessionManager.resetSession();
      const newId = sessionManager.getSessionId();

      const storedValue = localStorage.getItem(SESSION_KEY);
      expect(storedValue).toBe(JSON.stringify(newId));
      expect(storedValue).not.toBe(JSON.stringify(oldId));
    });

    it("重置后新实例应该使用新的 Session ID", () => {
      const sessionManager1 = new SessionManager();
      sessionManager1.resetSession();
      const newId = sessionManager1.getSessionId();

      const sessionManager2 = new SessionManager();
      const id2 = sessionManager2.getSessionId();

      expect(id2).toBe(newId);
    });
  });

  describe("页面信息获取", () => {
    it("应该返回正确的页面信息结构", () => {
      const sessionManager = new SessionManager();
      const pageInfo = sessionManager.getPageInfo();

      expect(pageInfo).toHaveProperty("url");
      expect(pageInfo).toHaveProperty("route");
      expect(pageInfo).toHaveProperty("title");
      expect(pageInfo).toHaveProperty("referrer");
    });

    it("应该返回当前页面 URL", () => {
      const sessionManager = new SessionManager();
      const pageInfo = sessionManager.getPageInfo();

      expect(pageInfo.url).toBe(window.location.href);
    });

    it("应该返回当前路由路径", () => {
      const sessionManager = new SessionManager();
      const pageInfo = sessionManager.getPageInfo();

      expect(pageInfo.route).toBe(window.location.pathname);
    });

    it("应该返回当前页面标题", () => {
      const originalTitle = document.title;
      document.title = "Test Page Title";

      const sessionManager = new SessionManager();
      const pageInfo = sessionManager.getPageInfo();

      expect(pageInfo.title).toBe("Test Page Title");

      document.title = originalTitle;
    });

    it("应该返回来源页面", () => {
      const sessionManager = new SessionManager();
      const pageInfo = sessionManager.getPageInfo();

      // referrer 可能为空字符串（直接访问）
      expect(typeof pageInfo.referrer).toBe("string");
    });
  });

  describe("localStorage 不可用场景", () => {
    it("应该在 localStorage 不可用时生成新的 ID", () => {
      // 模拟 localStorage 不可用
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error("localStorage not available");
      });

      const sessionManager = new SessionManager();
      const sessionId = sessionManager.getSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");

      localStorage.setItem = originalSetItem;
    });

    it("应该在 localStorage 读取失败时生成新的 ID", () => {
      // 模拟 localStorage 读取失败
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error("localStorage not available");
      });

      const sessionManager = new SessionManager();
      const sessionId = sessionManager.getSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");

      localStorage.getItem = originalGetItem;
    });
  });

  describe("Session ID 唯一性", () => {
    it("多个 SessionManager 实例应该生成不同的 ID", () => {
      // 清除 localStorage 以确保生成新 ID
      localStorage.clear();

      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        localStorage.clear();
        const sessionManager = new SessionManager();
        ids.add(sessionManager.getSessionId());
      }

      expect(ids.size).toBe(10);
    });

    it("Session ID 应该包含时间戳", () => {
      const before = Date.now();
      const sessionManager = new SessionManager();
      const sessionId = sessionManager.getSessionId();
      const after = Date.now();

      const timestamp = parseInt(sessionId.split("-")[0], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});
