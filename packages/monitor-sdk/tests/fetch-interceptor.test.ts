import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FetchInterceptor } from "../src/core/hook/fetch";
import type { NetworkEvent, NetworkConfig } from "../src/shared/types";
import { EventType } from "../src/shared/types";

describe("FetchInterceptor", () => {
	let originalFetch: typeof fetch;
	let pushedEvents: NetworkEvent[];
	let mockEventQueue: { push: (event: NetworkEvent) => void };

	beforeEach(() => {
		originalFetch = window.fetch;
		pushedEvents = [];
		mockEventQueue = { push: (event: NetworkEvent) => pushedEvents.push(event) };
	});

	afterEach(() => {
		// 确保恢复原始 fetch
		window.fetch = originalFetch;
	});

	/**
	 * 创建一个 mock fetch 返回指定 Response
	 */
	function mockFetchResponse(status = 200, statusText = "OK", body = "ok") {
		window.fetch = vi.fn().mockResolvedValue(
			new Response(body, {
				status,
				statusText,
				headers: { "Content-Length": String(body.length) },
			}),
		);
	}

	describe("白名单/黑名单过滤", () => {
		it("无配置时记录所有请求", async () => {
			mockFetchResponse();
			const interceptor = new FetchInterceptor(mockEventQueue);
			interceptor.enable();

			await window.fetch("https://api.example.com/users");

			expect(pushedEvents).toHaveLength(1);
			expect(pushedEvents[0].data.url).toBe("https://api.example.com/users");

			interceptor.disable();
		});

		it("黑名单命中的请求不记录", async () => {
			mockFetchResponse();
			const config: NetworkConfig = {
				whitelist: ["example.com"],
				blacklist: ["/health"],
			};
			const interceptor = new FetchInterceptor(mockEventQueue, config);
			interceptor.enable();

			await window.fetch("https://api.example.com/health");

			expect(pushedEvents).toHaveLength(0);

			interceptor.disable();
		});

		it("黑名单未命中且白名单命中的请求正常记录", async () => {
			mockFetchResponse();
			const config: NetworkConfig = {
				whitelist: ["example.com"],
				blacklist: ["/health"],
			};
			const interceptor = new FetchInterceptor(mockEventQueue, config);
			interceptor.enable();

			await window.fetch("https://api.example.com/users");

			expect(pushedEvents).toHaveLength(1);

			interceptor.disable();
		});

		it("白名单配置后仅记录白名单内的请求", async () => {
			mockFetchResponse();
			const config: NetworkConfig = {
				whitelist: ["/api/"],
			};
			const interceptor = new FetchInterceptor(mockEventQueue, config);
			interceptor.enable();

			await window.fetch("https://example.com/api/users");
			await window.fetch("https://cdn.example.com/logo.png");

			expect(pushedEvents).toHaveLength(1);
			expect(pushedEvents[0].data.url).toBe("https://example.com/api/users");

			interceptor.disable();
		});

		it("黑名单优先级高于白名单", async () => {
			mockFetchResponse();
			const config: NetworkConfig = {
				whitelist: ["/api/"],
				blacklist: ["/api/health"],
			};
			const interceptor = new FetchInterceptor(mockEventQueue, config);
			interceptor.enable();

			await window.fetch("https://example.com/api/health");
			await window.fetch("https://example.com/api/users");

			expect(pushedEvents).toHaveLength(1);
			expect(pushedEvents[0].data.url).toBe("https://example.com/api/users");

			interceptor.disable();
		});

		it("正则和函数规则也能正常过滤", async () => {
			mockFetchResponse();
			const config: NetworkConfig = {
				whitelist: ["example.com"],
				blacklist: [/\.png$/, (url: string) => url.includes("internal")],
			};
			const interceptor = new FetchInterceptor(mockEventQueue, config);
			interceptor.enable();

			await window.fetch("https://cdn.example.com/logo.png");
			await window.fetch("https://internal.example.com/api/data");
			await window.fetch("https://api.example.com/users");

			expect(pushedEvents).toHaveLength(1);
			expect(pushedEvents[0].data.url).toBe("https://api.example.com/users");

			interceptor.disable();
		});
	});

	describe("请求参数记录", () => {
		it("默认记录查询参数", async () => {
			mockFetchResponse();
			const interceptor = new FetchInterceptor(mockEventQueue);
			interceptor.enable();

			await window.fetch("https://api.example.com/users?page=1&size=10");

			expect(pushedEvents).toHaveLength(1);
			expect(pushedEvents[0].data.queryParams).toEqual({ page: "1", size: "10" });

			interceptor.disable();
		});

		it("默认记录请求体", async () => {
			mockFetchResponse();
			const interceptor = new FetchInterceptor(mockEventQueue);
			interceptor.enable();

			await window.fetch("https://api.example.com/users", {
				method: "POST",
				body: JSON.stringify({ name: "test" }),
			});

			expect(pushedEvents).toHaveLength(1);
			expect(pushedEvents[0].data.requestBody).toBe('{"name":"test"}');

			interceptor.disable();
		});

		it("默认记录请求头", async () => {
			mockFetchResponse();
			const interceptor = new FetchInterceptor(mockEventQueue);
			interceptor.enable();

			await window.fetch("https://api.example.com/users", {
				headers: { "Content-Type": "application/json", "X-Custom": "value" },
			});

			expect(pushedEvents).toHaveLength(1);
			expect(pushedEvents[0].data.requestHeaders).toEqual({
				"Content-Type": "application/json",
				"X-Custom": "value",
			});

			interceptor.disable();
		});

		it("recordBody=false 时不记录请求体", async () => {
			mockFetchResponse();
			const config: NetworkConfig = { whitelist: ["/users"], recordBody: false };
			const interceptor = new FetchInterceptor(mockEventQueue, config);
			interceptor.enable();

			await window.fetch("https://api.example.com/users", {
				method: "POST",
				body: JSON.stringify({ name: "test" }),
			});

			expect(pushedEvents[0].data.requestBody).toBeUndefined();

			interceptor.disable();
		});

		it("recordQuery=false 时不记录查询参数", async () => {
			mockFetchResponse();
			const config: NetworkConfig = { whitelist: ["/users"], recordQuery: false };
			const interceptor = new FetchInterceptor(mockEventQueue, config);
			interceptor.enable();

			await window.fetch("https://api.example.com/users?page=1");

			expect(pushedEvents[0].data.queryParams).toBeUndefined();

			interceptor.disable();
		});

		it("recordHeaders=false 时不记录请求头", async () => {
			mockFetchResponse();
			const config: NetworkConfig = { whitelist: ["/users"], recordHeaders: false };
			const interceptor = new FetchInterceptor(mockEventQueue, config);
			interceptor.enable();

			await window.fetch("https://api.example.com/users", {
				headers: { "Content-Type": "application/json" },
			});

			expect(pushedEvents[0].data.requestHeaders).toBeUndefined();

			interceptor.disable();
		});

		it("excludeHeaders 排除指定请求头", async () => {
			mockFetchResponse();
			const config: NetworkConfig = {
				whitelist: ["/users"],
				excludeHeaders: ["Authorization"],
			};
			const interceptor = new FetchInterceptor(mockEventQueue, config);
			interceptor.enable();

			await window.fetch("https://api.example.com/users", {
				headers: {
					"Content-Type": "application/json",
					"Authorization": "Bearer token123",
				},
			});

			expect(pushedEvents[0].data.requestHeaders).toEqual({
				"Content-Type": "application/json",
			});

			interceptor.disable();
		});
	});

	describe("基础功能", () => {
		it("记录成功请求的基本信息", async () => {
			mockFetchResponse(200, "OK", "response body");
			const interceptor = new FetchInterceptor(mockEventQueue);
			interceptor.enable();

			await window.fetch("https://api.example.com/users");

			expect(pushedEvents).toHaveLength(1);
			const event = pushedEvents[0];
			expect(event.type).toBe(EventType.NETWORK);
			expect(event.data.method).toBe("GET");
			expect(event.data.status).toBe(200);
			expect(event.data.success).toBe(true);
			expect(event.data.type).toBe("fetch");
			expect(event.data.duration).toBeGreaterThanOrEqual(0);

			interceptor.disable();
		});

		it("记录失败请求", async () => {
			window.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));
			const interceptor = new FetchInterceptor(mockEventQueue);
			interceptor.enable();

			await expect(window.fetch("https://api.example.com/fail")).rejects.toThrow("Network Error");

			expect(pushedEvents).toHaveLength(1);
			const event = pushedEvents[0];
			expect(event.data.status).toBe(0);
			expect(event.data.success).toBe(false);
			expect(event.data.error).toBe("Network Error");

			interceptor.disable();
		});

		it("disable 后恢复原始 fetch", async () => {
			mockFetchResponse();
			const interceptor = new FetchInterceptor(mockEventQueue);
			interceptor.enable();

			await window.fetch("https://api.example.com/users");
			expect(pushedEvents).toHaveLength(1);

			interceptor.disable();

			// disable 后的请求不应被记录
			await window.fetch("https://api.example.com/users");
			expect(pushedEvents).toHaveLength(1);
		});

		it("重复 enable 不会重复拦截", () => {
			const interceptor = new FetchInterceptor(mockEventQueue);
			interceptor.enable();
			const fetchAfterFirstEnable = window.fetch;
			interceptor.enable();
			expect(window.fetch).toBe(fetchAfterFirstEnable);
			interceptor.disable();
		});
	});
});
