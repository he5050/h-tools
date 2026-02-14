/**
 * @fileoverview 日志模块单元测试
 * @description 测试 logger 的日志级别控制和输出功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, LogLevel } from "../shared/logger";

describe("日志模块测试", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;
  let consoleTableSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, "group").mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, "groupEnd").mockImplementation(() => {});
    consoleTableSpy = vi.spyOn(console, "table").mockImplementation(() => {});

    // 重置 logger 状态
    logger.init(false, LogLevel.DEBUG);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("日志级别", () => {
    it("应该正确设置日志级别", () => {
      logger.setLevel(LogLevel.INFO);
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });

    it("应该支持所有日志级别", () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.SILENT).toBe(4);
    });
  });

  describe("调试日志 (debug)", () => {
    it("应该在 DEBUG 级别输出调试日志", () => {
      logger.init(true, LogLevel.DEBUG);
      logger.debug("debug message");
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it("应该在 INFO 级别不输出调试日志", () => {
      logger.init(true, LogLevel.INFO);
      logger.debug("debug message");
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it("应该包含正确的日志格式", () => {
      logger.init(true, LogLevel.DEBUG);
      logger.debug("test message");

      const callArg = consoleDebugSpy.mock.calls[0][0];
      expect(callArg).toContain("[Monitor]");
      expect(callArg).toContain("[DEBUG]");
      expect(callArg).toContain("test message");
    });
  });

  describe("信息日志 (info)", () => {
    it("应该在 INFO 级别输出信息日志", () => {
      logger.init(true, LogLevel.INFO);
      logger.info("info message");
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it("应该在 WARN 级别不输出信息日志", () => {
      logger.init(true, LogLevel.WARN);
      logger.info("info message");
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it("应该在 DEBUG 级别输出信息日志", () => {
      logger.init(true, LogLevel.DEBUG);
      logger.info("info message");
      expect(consoleInfoSpy).toHaveBeenCalled();
    });
  });

  describe("警告日志 (warn)", () => {
    it("应该在 WARN 级别输出警告日志", () => {
      logger.init(true, LogLevel.WARN);
      logger.warn("warn message");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("应该在 ERROR 级别不输出警告日志", () => {
      logger.init(true, LogLevel.ERROR);
      logger.warn("warn message");
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("应该在 DEBUG 级别输出警告日志", () => {
      logger.init(true, LogLevel.DEBUG);
      logger.warn("warn message");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe("错误日志 (error)", () => {
    it("应该在 ERROR 级别输出错误日志", () => {
      logger.init(true, LogLevel.ERROR);
      logger.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("应该在 SILENT 级别不输出错误日志", () => {
      logger.init(true, LogLevel.SILENT);
      logger.error("error message");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("应该在 DEBUG 级别输出错误日志", () => {
      logger.init(true, LogLevel.DEBUG);
      logger.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("日志参数", () => {
    it("应该正确传递额外参数", () => {
      logger.init(true, LogLevel.DEBUG);
      const extraData = { key: "value" };
      logger.info("message", extraData);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("message"),
        extraData
      );
    });

    it("应该支持多个额外参数", () => {
      logger.init(true, LogLevel.DEBUG);
      logger.info("message", "arg1", "arg2", 123);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("message"),
        "arg1",
        "arg2",
        123
      );
    });
  });

  describe("日志开关", () => {
    it("禁用时应该不输出任何日志", () => {
      logger.init(false, LogLevel.DEBUG);
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("启用时应该输出日志", () => {
      logger.init(true, LogLevel.DEBUG);
      logger.info("info message");
      expect(consoleInfoSpy).toHaveBeenCalled();
    });
  });

  describe("分组日志 (group)", () => {
    it("应该在启用时输出分组日志", () => {
      logger.init(true, LogLevel.DEBUG);
      logger.group("Test Group", () => {
        logger.info("inside group");
      });

      expect(consoleGroupSpy).toHaveBeenCalledWith("[Monitor] Test Group");
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it("禁用时应该不输出分组日志", () => {
      logger.init(false, LogLevel.DEBUG);
      logger.group("Test Group", () => {
        logger.info("inside group");
      });

      expect(consoleGroupSpy).not.toHaveBeenCalled();
    });

    it("应该执行分组内的函数", () => {
      logger.init(true, LogLevel.DEBUG);
      const innerFn = vi.fn();

      logger.group("Test Group", innerFn);

      expect(innerFn).toHaveBeenCalled();
    });
  });

  describe("表格日志 (table)", () => {
    it("应该在启用时输出表格日志", () => {
      logger.init(true, LogLevel.DEBUG);
      const data = [{ name: "test", value: 1 }];
      logger.table(data);

      expect(consoleTableSpy).toHaveBeenCalledWith(data, undefined);
    });

    it("应该支持指定列", () => {
      logger.init(true, LogLevel.DEBUG);
      const data = [{ name: "test", value: 1, other: 2 }];
      logger.table(data, ["name", "value"]);

      expect(consoleTableSpy).toHaveBeenCalledWith(data, ["name", "value"]);
    });

    it("禁用时应该不输出表格日志", () => {
      logger.init(false, LogLevel.DEBUG);
      const data = [{ name: "test", value: 1 }];
      logger.table(data);

      expect(consoleTableSpy).not.toHaveBeenCalled();
    });
  });

  describe("时间戳", () => {
    it("应该包含 ISO 格式的时间戳", () => {
      logger.init(true, LogLevel.DEBUG);
      logger.info("test");

      const callArg = consoleInfoSpy.mock.calls[0][0];
      // ISO 格式: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(callArg).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
