/**
 * @fileoverview SSR 环境兼容性测试
 * @description 测试所有浏览器 API 调用在 SSR 环境中的安全性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
	getDeviceInfo,
	isFeatureSupported,
	isLocalStorageSupported,
	isSessionStorageSupported,
	isCookieSupported,
	isHttps,
	isServiceWorkerSupported,
	isNotificationSupported,
	isGeolocationSupported,
	isWebSocketSupported,
	isCanvasSupported,
	isWebGLSupported,
	isTouchSupported,
	isPassiveEventSupported,
	isBrowser,
	getEnvironmentInfo,
} from "../shared/utils"

describe("SSR 环境兼容性", () => {
	let originalWindow: typeof window | undefined
	let originalDocument: typeof document | undefined
	let originalNavigator: typeof navigator | undefined

	beforeEach(() => {
		// 保存原始值
		originalWindow = global.window
		originalDocument = global.document
		originalNavigator = global.navigator

		// @ts-ignore - 模拟 SSR 环境
		delete global.window
		// @ts-ignore
		delete global.document
		// @ts-ignore
		delete global.navigator
	})

	afterEach(() => {
		// 恢复原始值
		global.window = originalWindow as typeof window
		global.document = originalDocument as typeof document
		global.navigator = originalNavigator as typeof navigator
	})

	describe("isBrowser", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isBrowser()).toBe(false)
		})
	})

	describe("getDeviceInfo", () => {
		it("在 SSR 环境应返回默认值", () => {
			const info = getDeviceInfo()
			expect(info.browser).toBe("SSR")
			expect(info.os).toBe("Server")
			expect(info.browserVersion).toBe("N/A")
			expect(info.osVersion).toBe("N/A")
			expect(info.deviceType).toBe("desktop")
			expect(info.screenWidth).toBe(0)
			expect(info.screenHeight).toBe(0)
			expect(info.devicePixelRatio).toBe(1)
		})
	})

	describe("isFeatureSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isFeatureSupported("indexedDB")).toBe(false)
			expect(isFeatureSupported("webWorker")).toBe(false)
			expect(isFeatureSupported("performanceObserver")).toBe(false)
			expect(isFeatureSupported("mutationObserver")).toBe(false)
			expect(isFeatureSupported("fetch")).toBe(false)
			expect(isFeatureSupported("beacon")).toBe(false)
			expect(isFeatureSupported("compression")).toBe(false)
		})
	})

	describe("isLocalStorageSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isLocalStorageSupported()).toBe(false)
		})
	})

	describe("isSessionStorageSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isSessionStorageSupported()).toBe(false)
		})
	})

	describe("isCookieSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isCookieSupported()).toBe(false)
		})
	})

	describe("isHttps", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isHttps()).toBe(false)
		})
	})

	describe("isServiceWorkerSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isServiceWorkerSupported()).toBe(false)
		})
	})

	describe("isNotificationSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isNotificationSupported()).toBe(false)
		})
	})

	describe("isGeolocationSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isGeolocationSupported()).toBe(false)
		})
	})

	describe("isWebSocketSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isWebSocketSupported()).toBe(false)
		})
	})

	describe("isCanvasSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isCanvasSupported()).toBe(false)
		})
	})

	describe("isWebGLSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isWebGLSupported()).toBe(false)
		})
	})

	describe("isTouchSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isTouchSupported()).toBe(false)
		})
	})

	describe("isPassiveEventSupported", () => {
		it("在 SSR 环境应返回 false", () => {
			expect(isPassiveEventSupported()).toBe(false)
		})
	})

	describe("getEnvironmentInfo", () => {
		it("在 SSR 环境应正确返回信息", () => {
			const info = getEnvironmentInfo()
			expect(info.isBrowser).toBe(false)
			expect(info.isLocalStorageSupported).toBe(false)
			expect(info.isSessionStorageSupported).toBe(false)
			expect(info.isCookieSupported).toBe(false)
			expect(info.isHttps).toBe(false)
			expect(info.isServiceWorkerSupported).toBe(false)
			expect(info.isNotificationSupported).toBe(false)
			expect(info.isGeolocationSupported).toBe(false)
			expect(info.isWebSocketSupported).toBe(false)
			expect(info.isCanvasSupported).toBe(false)
			expect(info.isWebGLSupported).toBe(false)
			expect(info.isTouchSupported).toBe(false)
			expect(info.isPassiveEventSupported).toBe(false)
		})
	})
})

describe("浏览器环境正常工作", () => {
	it("isBrowser 应返回 true", () => {
		expect(isBrowser()).toBe(true)
	})

	it("getDeviceInfo 应返回实际设备信息", () => {
		const info = getDeviceInfo()
		expect(info.browser).not.toBe("SSR")
		expect(info.os).not.toBe("Server")
		// jsdom 环境下 screen 可能为 0，只检查非负数
		expect(info.screenWidth).toBeGreaterThanOrEqual(0)
		expect(info.screenHeight).toBeGreaterThanOrEqual(0)
	})
})
