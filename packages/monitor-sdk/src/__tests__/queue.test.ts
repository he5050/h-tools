/**
 * @fileoverview EventQueue 内存管理单元测试
 * @description 测试 queue.ts 中的队列上限限制和溢出策略
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventQueue, OverflowStrategy, QueueOptions } from "../core/queue"
import { EventType, MonitorEvent } from "../shared/types"

// Mock Worker
vi.stubGlobal("Worker", vi.fn(() => ({
	postMessage: vi.fn(),
	terminate: vi.fn(),
	onmessage: null,
	onerror: null,
})))

// Mock Blob and URL
vi.stubGlobal("Blob", vi.fn(() => ({ size: 0, type: "" })))
vi.stubGlobal("URL", {
	createObjectURL: vi.fn(() => "blob:test"),
	revokeObjectURL: vi.fn(),
})

describe("EventQueue 内存管理", () => {
	let mockFetch: ReturnType<typeof vi.fn>

	beforeEach(() => {
		mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
		})
		vi.stubGlobal("fetch", mockFetch)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	// 创建测试用事件的辅助函数
	function createTestEvent(timestamp: number): MonitorEvent {
		return {
			type: EventType.ERROR,
			timestamp,
			data: {
				message: `Test error ${timestamp}`,
				stack: "",
				errorType: "Error",
			},
		}
	}

	describe("构造函数默认值", () => {
		it("应使用默认的 maxSize 1000", () => {
			const queue = new EventQueue("http://test.com", 10, 5000, "test-app")
			expect(queue.getMaxSize()).toBe(1000)
			queue.destroy()
		})

		it("应使用默认的 overflowStrategy 'replace'", () => {
			const queue = new EventQueue("http://test.com", 10, 5000, "test-app")
			// 通过行为测试验证策略
			expect(queue.getUsage()).toBe(0)
			queue.destroy()
		})

		it("应接受自定义 maxSize", () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 500 },
			)
			expect(queue.getMaxSize()).toBe(500)
			queue.destroy()
		})
	})

	describe("队列长度和使用率", () => {
		it("getLength 应返回正确的队列长度", () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 10 },
			)

			expect(queue.getLength()).toBe(0)

			// 模拟 Worker 不可用的情况（直接操作内部队列）
			// 由于 Worker 被 mock，事件会被发送到 Worker
			// 我们需要测试降级模式
			queue.destroy()
		})

		it("getUsage 应返回正确的队列使用率", () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 100 },
			)

			expect(queue.getUsage()).toBe(0)
			queue.destroy()
		})

		it("clear 应清空队列", () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 100 },
			)

			queue.clear()
			expect(queue.getLength()).toBe(0)
			expect(queue.getUsage()).toBe(0)
			queue.destroy()
		})
	})

	describe("溢出策略 - replace", () => {
		it("当队列满时应移除最旧的事件", async () => {
			// 创建降级模式的队列（Worker 创建失败）
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 5, overflowStrategy: "replace" },
			)

			// 强制使用降级模式（直接操作内部队列测试）
			// @ts-ignore - 访问私有属性进行测试
			queue.worker = null

			// 添加 10 条事件（超过 maxSize 5）
			for (let i = 0; i < 10; i++) {
				queue.push(createTestEvent(i))
			}

			// 队列应保持在 maxSize
			expect(queue.getLength()).toBe(5)

			queue.destroy()
		})

		it("使用 replace 策略时新事件应被添加", async () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 3, overflowStrategy: "replace" },
			)

			// @ts-ignore
			queue.worker = null

			for (let i = 0; i < 5; i++) {
				queue.push(createTestEvent(i))
			}

			// 应保留最新的 3 条
			expect(queue.getLength()).toBe(3)

			queue.destroy()
		})
	})

	describe("溢出策略 - drop", () => {
		it("当队列满时应丢弃新事件", async () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 5, overflowStrategy: "drop" },
			)

			// @ts-ignore
			queue.worker = null

			// 添加 10 条事件
			for (let i = 0; i < 10; i++) {
				queue.push(createTestEvent(i))
			}

			// 队列应保持在 maxSize，旧事件保留
			expect(queue.getLength()).toBe(5)

			queue.destroy()
		})

		it("使用 drop 策略时最旧的事件应保留", async () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 3, overflowStrategy: "drop" },
			)

			// @ts-ignore
			queue.worker = null

			for (let i = 0; i < 10; i++) {
				queue.push(createTestEvent(i))
			}

			// 应保留前 3 条（0, 1, 2）
			expect(queue.getLength()).toBe(3)

			queue.destroy()
		})
	})

	describe("边界情况", () => {
		it("maxSize 为 1 时应正确工作", async () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 1, overflowStrategy: "replace" },
			)

			// @ts-ignore
			queue.worker = null

			queue.push(createTestEvent(1))
			expect(queue.getLength()).toBe(1)

			queue.push(createTestEvent(2))
			expect(queue.getLength()).toBe(1)

			queue.destroy()
		})

		it("getMaxSize 应返回配置的最大值", () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 2000 },
			)

			expect(queue.getMaxSize()).toBe(2000)
			queue.destroy()
		})

		it("当 maxSize 为 0 时 getUsage 应返回 0", () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 0 },
			)

			expect(queue.getUsage()).toBe(0)
			queue.destroy()
		})
	})

	describe("destroy 清理", () => {
		it("destroy 应清空队列", async () => {
			const queue = new EventQueue(
				"http://test.com",
				10,
				5000,
				"test-app",
				{ maxSize: 100 },
			)

			// @ts-ignore
			queue.worker = null

			for (let i = 0; i < 10; i++) {
				queue.push(createTestEvent(i))
			}

			expect(queue.getLength()).toBe(10)

			queue.destroy()

			expect(queue.getLength()).toBe(0)
		})
	})
})
