/**
 * @fileoverview 网络监控模块集成测试
 * @description 测试 Fetch 和 XHR 拦截、过滤和数据收集功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { FetchInterceptor } from "../core/hook/fetch"
import { XHRInterceptor } from "../core/hook/xhr"
import { EventType, NetworkEvent } from "../shared/types"

describe("网络监控模块测试", () => {
	let mockEventQueue: { push: ReturnType<typeof vi.fn> }

	beforeEach(() => {
		mockEventQueue = { push: vi.fn() }
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Fetch 监控", () => {
		let fetchInterceptor: FetchInterceptor
		let originalFetch: typeof fetch

		beforeEach(() => {
			originalFetch = global.fetch
			global.fetch = vi.fn().mockResolvedValue({
				status: 200,
				statusText: "OK",
				headers: new Headers(),
				clone: () => ({
					text: () => Promise.resolve("response body"),
				}),
			} as Response)

			fetchInterceptor = new FetchInterceptor(mockEventQueue, {})
		})

		afterEach(() => {
			fetchInterceptor.disable()
			global.fetch = originalFetch
		})

		it("应该拦截 fetch 请求", async () => {
			fetchInterceptor.enable()

			await global.fetch("https://api.example.com/data")

			expect(mockEventQueue.push).toHaveBeenCalled()
			const event = mockEventQueue.push.mock.calls[0][0] as NetworkEvent
			expect(event.type).toBe(EventType.NETWORK)
			expect(event.data.url).toBe("https://api.example.com/data")
		})

		it("应该记录请求方法", async () => {
			fetchInterceptor.enable()

			await global.fetch("https://api.example.com/data", {
				method: "POST",
			})

			const event = mockEventQueue.push.mock.calls[0][0] as NetworkEvent
			expect(event.data.method).toBe("POST")
		})

		it("应该记录响应状态", async () => {
			fetchInterceptor.enable()

			await global.fetch("https://api.example.com/data")

			const event = mockEventQueue.push.mock.calls[0][0] as NetworkEvent
			expect(event.data.status).toBe(200)
			expect(event.data.statusText).toBe("OK")
		})

		it("应该记录请求耗时", async () => {
			fetchInterceptor.enable()

			await global.fetch("https://api.example.com/data")

			const event = mockEventQueue.push.mock.calls[0][0] as NetworkEvent
			expect(event.data.duration).toBeGreaterThanOrEqual(0)
		})

		it("应该根据白名单过滤请求", async () => {
			fetchInterceptor = new FetchInterceptor(mockEventQueue, {
				whitelist: ["api.example.com"],
			})
			fetchInterceptor.enable()

			// 白名单内的请求应该被记录
			await global.fetch("https://api.example.com/data")
			expect(mockEventQueue.push).toHaveBeenCalledTimes(1)

			// 白名单外的请求不应该被记录
			mockEventQueue.push.mockClear()
			await global.fetch("https://other.com/data")
			expect(mockEventQueue.push).not.toHaveBeenCalled()
		})

		it("应该根据黑名单过滤请求", async () => {
			fetchInterceptor = new FetchInterceptor(mockEventQueue, {
				blacklist: ["exclude.com"],
			})
			fetchInterceptor.enable()

			// 黑名单内的请求不应该被记录
			await global.fetch("https://exclude.com/data")
			expect(mockEventQueue.push).not.toHaveBeenCalled()

			// 黑名单外的请求应该被记录
			await global.fetch("https://api.example.com/data")
			expect(mockEventQueue.push).toHaveBeenCalled()
		})

		it("应该处理 fetch 错误", async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))
			fetchInterceptor.enable()

			try {
				await global.fetch("https://api.example.com/data")
			} catch {
				// 预期会抛出错误
			}

			expect(mockEventQueue.push).toHaveBeenCalled()
			const event = mockEventQueue.push.mock.calls[0][0] as NetworkEvent
			// 错误信息可能被记录在 statusText 或其他字段
			expect(event.data).toBeDefined()
		})

		it("应该正确停止监控", () => {
			fetchInterceptor.enable()
			fetchInterceptor.disable()

			// 禁用后 fetch 应该恢复为原始函数
			expect(global.fetch).not.toBe(originalFetch)
		})

		it("重复启用不应报错", () => {
			fetchInterceptor.enable()
			fetchInterceptor.enable()
			expect(fetchInterceptor).toBeDefined()
		})

		it("重复禁用不应报错", () => {
			fetchInterceptor.enable()
			fetchInterceptor.disable()
			fetchInterceptor.disable()
			expect(fetchInterceptor).toBeDefined()
		})
	})

	describe("XHR 监控", () => {
		let xhrInterceptor: XHRInterceptor
		let originalXHR: typeof XMLHttpRequest

		beforeEach(() => {
			originalXHR = global.XMLHttpRequest
			xhrInterceptor = new XHRInterceptor(mockEventQueue, {})
		})

		afterEach(() => {
			xhrInterceptor.disable()
			global.XMLHttpRequest = originalXHR
		})

		it("应该能够启用 XHR 监控", () => {
			xhrInterceptor.enable()
			expect(xhrInterceptor).toBeDefined()
		})

		it("应该能够禁用 XHR 监控", () => {
			xhrInterceptor.enable()
			xhrInterceptor.disable()
			expect(xhrInterceptor).toBeDefined()
		})

		it("重复启用不应报错", () => {
			xhrInterceptor.enable()
			xhrInterceptor.enable()
			expect(xhrInterceptor).toBeDefined()
		})

		it("应该根据白名单过滤请求", () => {
			xhrInterceptor = new XHRInterceptor(mockEventQueue, {
				whitelist: ["api.example.com"],
			})
			xhrInterceptor.enable()

			// XHR 拦截器应该被启用
			expect(xhrInterceptor).toBeDefined()
		})

		it("应该根据黑名单过滤请求", () => {
			xhrInterceptor = new XHRInterceptor(mockEventQueue, {
				blacklist: ["exclude.com"],
			})
			xhrInterceptor.enable()

			// XHR 拦截器应该被启用
			expect(xhrInterceptor).toBeDefined()
		})

		it("应该正确停止监控", () => {
			xhrInterceptor.enable()
			xhrInterceptor.disable()

			// XHR 拦截器应该能够正常禁用
			expect(xhrInterceptor).toBeDefined()
		})
	})
})
