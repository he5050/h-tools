import { describe, it, expect } from "vitest";
import {
	matchNetworkRule,
	shouldRecordRequest,
	extractQueryParams,
	serializeRequestBody,
	extractRequestHeaders,
	safeSerializeState,
} from "../src/shared/utils";
import type { NetworkConfig } from "../src/shared/types";

describe("网络过滤工具函数", () => {
	// ==================== matchNetworkRule ====================
	describe("matchNetworkRule", () => {
		it("字符串规则：url.includes 匹配", () => {
			expect(matchNetworkRule("https://api.example.com/health", "/health")).toBe(true);
			expect(matchNetworkRule("https://api.example.com/users", "/health")).toBe(false);
		});

		it("正则规则：test 匹配", () => {
			expect(matchNetworkRule("https://cdn.example.com/logo.png", /\.png$/)).toBe(true);
			expect(matchNetworkRule("https://cdn.example.com/logo.jpg", /\.png$/)).toBe(false);
			expect(matchNetworkRule("https://api.example.com/v1/users", /\/v\d+\//)).toBe(true);
		});

		it("函数规则：自定义匹配", () => {
			const rule = (url: string) => new URL(url).hostname === "internal.example.com";
			expect(matchNetworkRule("https://internal.example.com/api", rule)).toBe(true);
			expect(matchNetworkRule("https://public.example.com/api", rule)).toBe(false);
		});

		it("函数规则抛出异常时返回 false", () => {
			const rule = () => {
				throw new Error("boom");
			};
			expect(matchNetworkRule("https://example.com", rule)).toBe(false);
		});
	});

	// ==================== shouldRecordRequest ====================
	describe("shouldRecordRequest", () => {
		it("未传 config 时默认记录所有请求", () => {
			expect(shouldRecordRequest("https://api.example.com/users")).toBe(true);
			expect(shouldRecordRequest("https://api.example.com/users", undefined)).toBe(true);
		});

		it("传了空 config 对象时不记录（因为没有白名单）", () => {
			expect(shouldRecordRequest("https://api.example.com/users", {})).toBe(false);
		});

		it("只配黑名单没配白名单：所有请求都不记录", () => {
			const config: NetworkConfig = {
				blacklist: ["/health", /\.png$/],
			};
			// 命中黑名单 → 不记录
			expect(shouldRecordRequest("https://api.example.com/health", config)).toBe(false);
			expect(shouldRecordRequest("https://cdn.example.com/logo.png", config)).toBe(false);
			// 未命中黑名单，但也没有白名单 → 不记录
			expect(shouldRecordRequest("https://api.example.com/users", config)).toBe(false);
		});

		it("白名单配置后仅记录白名单内的请求", () => {
			const config: NetworkConfig = {
				whitelist: ["/api/"],
			};
			expect(shouldRecordRequest("https://example.com/api/users", config)).toBe(true);
			expect(shouldRecordRequest("https://cdn.example.com/logo.png", config)).toBe(false);
		});

		it("黑名单优先级高于白名单", () => {
			const config: NetworkConfig = {
				whitelist: ["/api/"],
				blacklist: ["/api/health"],
			};
			// /api/health 同时命中白名单和黑名单，黑名单优先 → 排除
			expect(shouldRecordRequest("https://example.com/api/health", config)).toBe(false);
			// /api/users 命中白名单，未命中黑名单 → 记录
			expect(shouldRecordRequest("https://example.com/api/users", config)).toBe(true);
			// /static/logo.png 未命中白名单 → 排除
			expect(shouldRecordRequest("https://example.com/static/logo.png", config)).toBe(false);
		});

		it("配置了 networkConfig 但未配置白名单时不记录", () => {
			const config: NetworkConfig = {};
			expect(shouldRecordRequest("https://api.example.com/anything", config)).toBe(false);
		});

		it("空白名单/黑名单数组时不记录", () => {
			const config: NetworkConfig = {
				whitelist: [],
				blacklist: [],
			};
			expect(shouldRecordRequest("https://api.example.com/anything", config)).toBe(false);
		});

		it("仅配置黑名单时：未命中黑名单也不记录（因为没有白名单）", () => {
			const config: NetworkConfig = {
				blacklist: ["/health"],
			};
			// 命中黑名单 → 不记录
			expect(shouldRecordRequest("https://api.example.com/health", config)).toBe(false);
			// 未命中黑名单，但也没有白名单 → 不记录
			expect(shouldRecordRequest("https://api.example.com/users", config)).toBe(false);
		});

		it("混合规则类型：黑名单 + 白名单配合使用", () => {
			const config: NetworkConfig = {
				whitelist: ["/api/", "/users"],
				blacklist: [
					"/health",
					/\.(png|jpg|gif)$/,
					(url: string) => url.includes("internal"),
				],
			};
			// 命中黑名单 → 不记录
			expect(shouldRecordRequest("https://example.com/api/health", config)).toBe(false);
			expect(shouldRecordRequest("https://cdn.example.com/img.jpg", config)).toBe(false);
			expect(shouldRecordRequest("https://internal.example.com/api/data", config)).toBe(false);
			// 命中白名单且未命中黑名单 → 记录
			expect(shouldRecordRequest("https://example.com/api/users", config)).toBe(true);
			// 未命中白名单 → 不记录
			expect(shouldRecordRequest("https://cdn.example.com/style.css", config)).toBe(false);
		});
	});

	// ==================== extractQueryParams ====================
	describe("extractQueryParams", () => {
		it("提取 URL 查询参数", () => {
			const params = extractQueryParams("https://api.example.com/users?page=1&size=10");
			expect(params).toEqual({ page: "1", size: "10" });
		});

		it("无查询参数返回 undefined", () => {
			expect(extractQueryParams("https://api.example.com/users")).toBeUndefined();
		});

		it("仅有 ? 无参数返回 undefined", () => {
			expect(extractQueryParams("https://api.example.com/users?")).toBeUndefined();
		});

		it("相对路径也能解析", () => {
			const params = extractQueryParams("/api/users?page=2");
			expect(params).toEqual({ page: "2" });
		});

		it("无效 URL 返回 undefined", () => {
			expect(extractQueryParams("not a url at all :::")).toBeUndefined();
		});
	});

	// ==================== serializeRequestBody ====================
	describe("serializeRequestBody", () => {
		it("null/undefined 返回 undefined", () => {
			expect(serializeRequestBody(null)).toBeUndefined();
			expect(serializeRequestBody(undefined)).toBeUndefined();
		});

		it("字符串直接返回", () => {
			expect(serializeRequestBody('{"name":"test"}')).toBe('{"name":"test"}');
		});

		it("对象序列化为 JSON", () => {
			expect(serializeRequestBody({ name: "test" })).toBe('{"name":"test"}');
		});

		it("URLSearchParams 序列化", () => {
			const params = new URLSearchParams({ a: "1", b: "2" });
			const result = serializeRequestBody(params);
			expect(result).toContain("a=1");
			expect(result).toContain("b=2");
		});

		it("超出 maxSize 截断", () => {
			const longStr = "a".repeat(100);
			const result = serializeRequestBody(longStr, 50);
			expect(result).toHaveLength(50 + "...[truncated]".length);
			expect(result).toContain("...[truncated]");
		});

		it("Blob 返回描述信息", () => {
			const blob = new Blob(["hello"], { type: "text/plain" });
			const result = serializeRequestBody(blob);
			expect(result).toContain("[Blob:");
			expect(result).toContain("text/plain");
		});

		it("ArrayBuffer 返回描述信息", () => {
			const buffer = new ArrayBuffer(16);
			const result = serializeRequestBody(buffer);
			expect(result).toBe("[Binary: 16 bytes]");
		});

		it("Uint8Array 返回描述信息", () => {
			const arr = new Uint8Array(8);
			const result = serializeRequestBody(arr);
			expect(result).toBe("[Binary: 8 bytes]");
		});
	});

	// ==================== extractRequestHeaders ====================
	describe("extractRequestHeaders", () => {
		it("null/undefined 返回 undefined", () => {
			expect(extractRequestHeaders(null)).toBeUndefined();
			expect(extractRequestHeaders(undefined)).toBeUndefined();
		});

		it("从普通对象提取请求头", () => {
			const headers = { "Content-Type": "application/json", "X-Custom": "value" };
			expect(extractRequestHeaders(headers)).toEqual({
				"Content-Type": "application/json",
				"X-Custom": "value",
			});
		});

		it("排除指定的请求头（大小写不敏感）", () => {
			const headers = {
				"Content-Type": "application/json",
				"Authorization": "Bearer token",
				"Cookie": "session=abc",
			};
			const result = extractRequestHeaders(headers, ["authorization", "cookie"]);
			expect(result).toEqual({ "Content-Type": "application/json" });
		});

		it("从 Headers 对象提取", () => {
			const headers = new Headers();
			headers.set("Content-Type", "application/json");
			headers.set("X-Request-Id", "123");
			const result = extractRequestHeaders(headers);
			expect(result).toEqual({
				"content-type": "application/json",
				"x-request-id": "123",
			});
		});

		it("从二维数组提取", () => {
			const headers: [string, string][] = [
				["Content-Type", "application/json"],
				["Authorization", "Bearer token"],
			];
			const result = extractRequestHeaders(headers, ["Authorization"]);
			expect(result).toEqual({ "Content-Type": "application/json" });
		});

		it("所有头都被排除时返回 undefined", () => {
			const headers = { "Authorization": "Bearer token" };
			const result = extractRequestHeaders(headers, ["Authorization"]);
			expect(result).toBeUndefined();
		});
	});

	// ==================== safeSerializeState ====================
	describe("safeSerializeState", () => {
		it("null/undefined 返回 null", () => {
			expect(safeSerializeState(null)).toBeNull();
			expect(safeSerializeState(undefined)).toBeNull();
		});

		it("普通对象正常序列化", () => {
			const state = { key: "abc", current: "/detail/123", position: 5 };
			expect(safeSerializeState(state)).toEqual(state);
		});

		it("嵌套对象正常序列化", () => {
			const state = {
				key: "abc",
				meta: { title: "详情页", params: { id: "123" } },
			};
			expect(safeSerializeState(state)).toEqual(state);
		});

		it("原始值包装为 { value: ... }", () => {
			expect(safeSerializeState(42)).toEqual({ value: 42 });
			expect(safeSerializeState("hello")).toEqual({ value: "hello" });
			expect(safeSerializeState(true)).toEqual({ value: true });
		});

		it("包含不可序列化属性时返回 null", () => {
			const circular: Record<string, unknown> = { a: 1 };
			circular.self = circular;
			expect(safeSerializeState(circular)).toBeNull();
		});

		it("函数属性会被 JSON.stringify 忽略", () => {
			const state = { key: "abc", fn: () => {} };
			const result = safeSerializeState(state);
			expect(result).toEqual({ key: "abc" });
			expect(result).not.toHaveProperty("fn");
		});
	});
});
