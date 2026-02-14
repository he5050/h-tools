/**
 * @fileoverview 类型和常量测试
 * @description 测试类型定义和常量值
 */

import { describe, it, expect } from "vitest";
import { EventType } from "../shared/types";
import { DEFAULT_CONFIG, PERFORMANCE_THRESHOLDS, DB_CONFIG, TTL_CONFIG, STORAGE_LIMITS, SDK_VERSION, SDK_NAME } from "../shared/constants";

describe("类型和常量测试", () => {
  describe("EventType 枚举", () => {
    it("应该包含所有必要的事件类型", () => {
      expect(EventType.ERROR).toBe("ERROR");
      expect(EventType.PROMISE_REJECTION).toBe("PROMISE_REJECTION");
      expect(EventType.RESOURCE_ERROR).toBe("RESOURCE_ERROR");
      expect(EventType.PERFORMANCE).toBe("PERFORMANCE");
      expect(EventType.NETWORK).toBe("NETWORK");
      expect(EventType.ROUTE_CHANGE).toBe("ROUTE_CHANGE");
      expect(EventType.PV).toBe("PV");
      expect(EventType.UV).toBe("UV");
      expect(EventType.CLICK).toBe("CLICK");
      expect(EventType.CUSTOM).toBe("CUSTOM");
      expect(EventType.BLANK_SCREEN).toBe("BLANK_SCREEN");
      expect(EventType.SNAPSHOT).toBe("SNAPSHOT");
      expect(EventType.REPLAY).toBe("REPLAY");
      expect(EventType.STAY_DURATION).toBe("STAY_DURATION");
      expect(EventType.RESOURCE_LOAD).toBe("RESOURCE_LOAD");
    });

    it("事件类型值应该是字符串", () => {
      for (const key in EventType) {
        expect(typeof EventType[key as keyof typeof EventType]).toBe("string");
      }
    });
  });

  describe("DEFAULT_CONFIG 默认配置", () => {
    it("应该包含所有必要的配置项", () => {
      expect(DEFAULT_CONFIG).toHaveProperty("dsn");
      expect(DEFAULT_CONFIG).toHaveProperty("appId");
      expect(DEFAULT_CONFIG).toHaveProperty("appVersion");
      expect(DEFAULT_CONFIG).toHaveProperty("env");
      expect(DEFAULT_CONFIG).toHaveProperty("enableError");
      expect(DEFAULT_CONFIG).toHaveProperty("enablePerformance");
      expect(DEFAULT_CONFIG).toHaveProperty("enableNetwork");
      expect(DEFAULT_CONFIG).toHaveProperty("enableRoute");
      expect(DEFAULT_CONFIG).toHaveProperty("enablePV");
      expect(DEFAULT_CONFIG).toHaveProperty("enableClick");
      expect(DEFAULT_CONFIG).toHaveProperty("enableBlankScreen");
      expect(DEFAULT_CONFIG).toHaveProperty("enableResourceLoad");
      expect(DEFAULT_CONFIG).toHaveProperty("enableSnapshot");
      expect(DEFAULT_CONFIG).toHaveProperty("enableReplay");
      expect(DEFAULT_CONFIG).toHaveProperty("enableTracker");
      expect(DEFAULT_CONFIG).toHaveProperty("sampleRate");
      expect(DEFAULT_CONFIG).toHaveProperty("batchSize");
      expect(DEFAULT_CONFIG).toHaveProperty("flushInterval");
      expect(DEFAULT_CONFIG).toHaveProperty("maxRetries");
      expect(DEFAULT_CONFIG).toHaveProperty("debug");
      expect(DEFAULT_CONFIG).toHaveProperty("userId");
      expect(DEFAULT_CONFIG).toHaveProperty("context");
      expect(DEFAULT_CONFIG).toHaveProperty("filterErrors");
      expect(DEFAULT_CONFIG).toHaveProperty("enableCompression");
      expect(DEFAULT_CONFIG).toHaveProperty("dataExpireDays");
    });

    it("应该设置正确的默认值", () => {
      expect(DEFAULT_CONFIG.dsn).toBe("");
      expect(DEFAULT_CONFIG.appId).toBe("");
      expect(DEFAULT_CONFIG.appVersion).toBe("1.0.0");
      expect(DEFAULT_CONFIG.env).toBe("production");
      expect(DEFAULT_CONFIG.enableError).toBe(true);
      expect(DEFAULT_CONFIG.enablePerformance).toBe(true);
      expect(DEFAULT_CONFIG.enableNetwork).toBe(true);
      expect(DEFAULT_CONFIG.enableRoute).toBe(true);
      expect(DEFAULT_CONFIG.enablePV).toBe(true);
      expect(DEFAULT_CONFIG.enableClick).toBe(true);
      expect(DEFAULT_CONFIG.enableBlankScreen).toBe(true);
      expect(DEFAULT_CONFIG.enableResourceLoad).toBe(true);
      expect(DEFAULT_CONFIG.enableSnapshot).toBe(false);
      expect(DEFAULT_CONFIG.enableReplay).toBe(false);
      expect(DEFAULT_CONFIG.enableTracker).toBe(true);
      expect(DEFAULT_CONFIG.sampleRate).toBe(1.0);
      expect(DEFAULT_CONFIG.batchSize).toBe(10);
      expect(DEFAULT_CONFIG.flushInterval).toBe(5000);
      expect(DEFAULT_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_CONFIG.debug).toBe(false);
      expect(DEFAULT_CONFIG.userId).toBe("");
      expect(DEFAULT_CONFIG.context).toEqual({});
      expect(DEFAULT_CONFIG.filterErrors).toEqual([]);
      expect(DEFAULT_CONFIG.enableCompression).toBe(false);
      expect(DEFAULT_CONFIG.dataExpireDays).toBe(30);
    });

    it("filterErrors 应该是数组", () => {
      expect(Array.isArray(DEFAULT_CONFIG.filterErrors)).toBe(true);
    });

    it("context 应该是对象", () => {
      expect(typeof DEFAULT_CONFIG.context).toBe("object");
    });
  });

  describe("PERFORMANCE_THRESHOLDS 性能阈值", () => {
    it("应该包含所有必要的性能阈值", () => {
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty("LCP_GOOD");
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty("LCP_POOR");
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty("FID_GOOD");
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty("FID_POOR");
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty("CLS_GOOD");
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty("CLS_POOR");
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty("SLOW_RESOURCE");
      expect(PERFORMANCE_THRESHOLDS).toHaveProperty("BLANK_SCREEN_CHECK_DELAY");
    });

    it("应该设置合理的阈值", () => {
      expect(PERFORMANCE_THRESHOLDS.LCP_GOOD).toBe(2500);
      expect(PERFORMANCE_THRESHOLDS.LCP_POOR).toBe(4000);
      expect(PERFORMANCE_THRESHOLDS.FID_GOOD).toBe(100);
      expect(PERFORMANCE_THRESHOLDS.FID_POOR).toBe(300);
      expect(PERFORMANCE_THRESHOLDS.CLS_GOOD).toBe(0.1);
      expect(PERFORMANCE_THRESHOLDS.CLS_POOR).toBe(0.25);
      expect(PERFORMANCE_THRESHOLDS.SLOW_RESOURCE).toBe(1000);
      expect(PERFORMANCE_THRESHOLDS.BLANK_SCREEN_CHECK_DELAY).toBe(3000);
    });

    it("阈值应该是数字", () => {
      for (const key in PERFORMANCE_THRESHOLDS) {
        expect(typeof PERFORMANCE_THRESHOLDS[key as keyof typeof PERFORMANCE_THRESHOLDS]).toBe("number");
      }
    });

    it("GOOD 阈值应该小于 POOR 阈值", () => {
      expect(PERFORMANCE_THRESHOLDS.LCP_GOOD).toBeLessThan(PERFORMANCE_THRESHOLDS.LCP_POOR);
      expect(PERFORMANCE_THRESHOLDS.FID_GOOD).toBeLessThan(PERFORMANCE_THRESHOLDS.FID_POOR);
      expect(PERFORMANCE_THRESHOLDS.CLS_GOOD).toBeLessThan(PERFORMANCE_THRESHOLDS.CLS_POOR);
    });
  });

  describe("DB_CONFIG 数据库配置", () => {
    it("应该包含所有必要的数据库配置", () => {
      expect(DB_CONFIG).toHaveProperty("NAME");
      expect(DB_CONFIG).toHaveProperty("VERSION");
      expect(DB_CONFIG).toHaveProperty("EVENT_STORE");
      expect(DB_CONFIG).toHaveProperty("SNAPSHOT_STORE");
      expect(DB_CONFIG).toHaveProperty("REPLAY_STORE");
    });

    it("应该设置正确的数据库配置值", () => {
      expect(DB_CONFIG.NAME).toBe("monitor_sdk_db");
      expect(DB_CONFIG.VERSION).toBe(1);
      expect(DB_CONFIG.EVENT_STORE).toBe("events");
      expect(DB_CONFIG.SNAPSHOT_STORE).toBe("snapshots");
      expect(DB_CONFIG.REPLAY_STORE).toBe("replays");
    });
  });

  describe("TTL_CONFIG 数据过期配置", () => {
    it("应该包含所有必要的 TTL 配置", () => {
      expect(TTL_CONFIG).toHaveProperty("DEFAULT_EVENT_TTL");
      expect(TTL_CONFIG).toHaveProperty("ERROR_EVENT_TTL");
      expect(TTL_CONFIG).toHaveProperty("SNAPSHOT_TTL");
      expect(TTL_CONFIG).toHaveProperty("REPLAY_TTL");
      expect(TTL_CONFIG).toHaveProperty("PERFORMANCE_TTL");
    });

    it("应该设置正确的 TTL 值（30天）", () => {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      expect(TTL_CONFIG.DEFAULT_EVENT_TTL).toBe(thirtyDays);
      expect(TTL_CONFIG.ERROR_EVENT_TTL).toBe(thirtyDays);
      expect(TTL_CONFIG.SNAPSHOT_TTL).toBe(thirtyDays);
      expect(TTL_CONFIG.REPLAY_TTL).toBe(thirtyDays);
      expect(TTL_CONFIG.PERFORMANCE_TTL).toBe(thirtyDays);
    });

    it("TTL 值应该是正数", () => {
      for (const key in TTL_CONFIG) {
        expect(TTL_CONFIG[key as keyof typeof TTL_CONFIG]).toBeGreaterThan(0);
      }
    });
  });

  describe("STORAGE_LIMITS 存储限制", () => {
    it("应该包含所有必要的存储限制", () => {
      expect(STORAGE_LIMITS).toHaveProperty("MAX_EVENT_SIZE");
      expect(STORAGE_LIMITS).toHaveProperty("MAX_SNAPSHOT_SIZE");
      expect(STORAGE_LIMITS).toHaveProperty("MAX_DB_SIZE");
      expect(STORAGE_LIMITS).toHaveProperty("MAX_EVENT_COUNT");
    });

    it("应该设置合理的存储限制", () => {
      expect(STORAGE_LIMITS.MAX_EVENT_SIZE).toBe(100 * 1024); // 100KB
      expect(STORAGE_LIMITS.MAX_SNAPSHOT_SIZE).toBe(500 * 1024); // 500KB
      expect(STORAGE_LIMITS.MAX_DB_SIZE).toBe(50 * 1024 * 1024); // 50MB
      expect(STORAGE_LIMITS.MAX_EVENT_COUNT).toBe(10000);
    });

    it("存储限制应该是正数", () => {
      for (const key in STORAGE_LIMITS) {
        expect(STORAGE_LIMITS[key as keyof typeof STORAGE_LIMITS]).toBeGreaterThan(0);
      }
    });

    it("存储限制应该有合理的大小关系", () => {
      expect(STORAGE_LIMITS.MAX_EVENT_SIZE).toBeLessThan(STORAGE_LIMITS.MAX_SNAPSHOT_SIZE);
      expect(STORAGE_LIMITS.MAX_SNAPSHOT_SIZE).toBeLessThan(STORAGE_LIMITS.MAX_DB_SIZE);
    });
  });

  describe("SDK 版本信息", () => {
    it("应该有版本号", () => {
      expect(SDK_VERSION).toBeDefined();
      expect(typeof SDK_VERSION).toBe("string");
      expect(SDK_VERSION.length).toBeGreaterThan(0);
    });

    it("应该有 SDK 名称", () => {
      expect(SDK_NAME).toBeDefined();
      expect(typeof SDK_NAME).toBe("string");
      expect(SDK_NAME.length).toBeGreaterThan(0);
    });

    it("版本号应该符合语义化版本格式", () => {
      expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });
  });
});
