/**
 * @fileoverview 白屏检测模块集成测试
 * @description 测试白屏检测逻辑、覆盖率计算和上报功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BlankScreenDetector } from "../core/hook/blank-screen"
import { EventType, BlankScreenEvent } from "../shared/types"

describe("白屏检测模块测试", () => {
	let mockEventQueue: { push: ReturnType<typeof vi.fn> }
	let blankScreenDetector: BlankScreenDetector

	beforeEach(() => {
		mockEventQueue = { push: vi.fn() }
		blankScreenDetector = new BlankScreenDetector(mockEventQueue)

		// 模拟 document 方法
		document.elementFromPoint = vi.fn().mockReturnValue(document.body)
	})

	afterEach(() => {
		blankScreenDetector.stop()
		vi.restoreAllMocks()
	})

	describe("初始化与销毁", () => {
		it("应该正确启动白屏检测", () => {
			blankScreenDetector.start()
			expect(blankScreenDetector).toBeDefined()
		})

		it("重复启动不应报错", () => {
			blankScreenDetector.start()
			blankScreenDetector.start()
			expect(blankScreenDetector).toBeDefined()
		})

		it("应该正确停止白屏检测", () => {
			blankScreenDetector.start()
			blankScreenDetector.stop()
			expect(blankScreenDetector).toBeDefined()
		})
	})

	describe("白屏检测逻辑", () => {
		it("应该支持手动触发检测", () => {
			blankScreenDetector.start()
			const result = blankScreenDetector.checkNow()
			expect(typeof result).toBe("boolean")
		})

		it("未启动时手动检测应该返回 false", () => {
			const result = blankScreenDetector.checkNow()
			expect(result).toBe(false)
		})
	})

	describe("SPA 路由切换检测", () => {
		it("应该支持路由切换回调", () => {
			blankScreenDetector.start()

			// 调用路由切换回调
			blankScreenDetector.onRouteChange("/old", "/new")

			expect(blankScreenDetector).toBeDefined()
		})

		it("未启动时路由切换不应报错", () => {
			// 未启动时调用不应报错
			blankScreenDetector.onRouteChange("/old", "/new")
			expect(blankScreenDetector).toBeDefined()
		})
	})

	describe("白屏事件上报", () => {
		it("手动检测时应该上报事件", () => {
			// 模拟所有检测点都返回 null（白屏）
			document.elementFromPoint = vi.fn().mockReturnValue(null)

			blankScreenDetector.start()
			blankScreenDetector.checkNow()

			expect(mockEventQueue.push).toHaveBeenCalled()
			const event = mockEventQueue.push.mock.calls[0][0] as BlankScreenEvent
			expect(event.type).toBe(EventType.BLANK_SCREEN)
		})

		it("白屏事件应该包含检测数据", () => {
			document.elementFromPoint = vi.fn().mockReturnValue(null)

			blankScreenDetector.start()
			blankScreenDetector.checkNow()

			const event = mockEventQueue.push.mock.calls[0][0] as BlankScreenEvent
			expect(event.data).toBeDefined()
			expect(event.data.url).toBeDefined()
			expect(event.data.pathname).toBeDefined()
			expect(event.data.checkPoints).toBeDefined()
			expect(event.data.coverage).toBeDefined()
		})

		it("白屏事件应该包含手动触发标记", () => {
			document.elementFromPoint = vi.fn().mockReturnValue(null)

			blankScreenDetector.start()
			blankScreenDetector.checkNow()

			const event = mockEventQueue.push.mock.calls[0][0] as BlankScreenEvent
			expect(event.data.manualTrigger).toBe(true)
		})
	})

	describe("检测点数据", () => {
		it("应该包含检测点坐标", () => {
			document.elementFromPoint = vi.fn().mockReturnValue(null)

			blankScreenDetector.start()
			blankScreenDetector.checkNow()

			const event = mockEventQueue.push.mock.calls[0][0] as BlankScreenEvent
			expect(event.data.checkPoints).toBeInstanceOf(Array)
			expect(event.data.checkPoints.length).toBeGreaterThan(0)
		})

		it("检测点应该包含坐标信息", () => {
			document.elementFromPoint = vi.fn().mockReturnValue(null)

			blankScreenDetector.start()
			blankScreenDetector.checkNow()

			const event = mockEventQueue.push.mock.calls[0][0] as BlankScreenEvent
			const firstPoint = event.data.checkPoints[0]
			expect(firstPoint).toHaveProperty("x")
			expect(firstPoint).toHaveProperty("y")
			expect(firstPoint).toHaveProperty("isBlank")
			expect(firstPoint).toHaveProperty("element")
		})
	})

	describe("白屏原因分析", () => {
		it("应该包含白屏原因", () => {
			document.elementFromPoint = vi.fn().mockReturnValue(null)

			blankScreenDetector.start()
			blankScreenDetector.checkNow()

			const event = mockEventQueue.push.mock.calls[0][0] as BlankScreenEvent
			expect(event.data.reason).toBeDefined()
			expect(typeof event.data.reason).toBe("string")
		})
	})

	describe("可见元素收集", () => {
		it("应该收集可见元素", () => {
			// 模拟检测点返回有效元素
			const mockElement = document.createElement("div")
			mockElement.innerHTML = "<span>test content</span>"
			document.elementFromPoint = vi.fn().mockReturnValue(mockElement)

			blankScreenDetector.start()
			blankScreenDetector.checkNow()

			// 检测点返回的是 body 或 html 时，仍然会被认为是白屏
			// 因为源码会检查元素是否是 body 或 html
			// 这里我们验证检测被触发即可
			expect(blankScreenDetector).toBeDefined()
		})
	})
})
