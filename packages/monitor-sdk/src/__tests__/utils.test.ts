/**
 * @fileoverview 工具函数单元测试
 * @description 测试 shared/utils.ts 中的所有工具函数
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
	generateId,
	throttle,
	debounce,
	deepMerge,
	getNestedValue,
	formatDate,
	getDeviceInfo,
	isFeatureSupported,
	safeExec,
	hashString,
	maskString,
	truncateString,
	parseUrlParams,
	buildUrl,
	sanitizeUrl,
	isBrowser,
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
	getEnvironmentInfo,
	safeGetLocalStorage,
	safeSetLocalStorage,
	safeRemoveLocalStorage,
	matchNetworkRule,
	shouldRecordRequest,
	extractQueryParams,
	serializeRequestBody,
	extractRequestHeaders,
	safeSerializeState,
	UrlCache,
	urlCache,
} from "../shared/utils"

describe("工具函数测试", () => {
	describe("generateId", () => {
		it("应该生成格式正确的唯一ID", () => {
			const id = generateId()
			expect(id).toMatch(/^\d+-[a-z0-9]{9}$/)
		})

		it("生成的ID应该是唯一的", () => {
			const ids = new Set<string>()
			for (let i = 0; i < 100; i++) {
				ids.add(generateId())
			}
			expect(ids.size).toBe(100)
		})

		it("时间戳部分应该是合理的时间值", () => {
			const before = Date.now()
			const id = generateId()
			const after = Date.now()
			const timestamp = parseInt(id.split("-")[0], 10)
			expect(timestamp).toBeGreaterThanOrEqual(before)
			expect(timestamp).toBeLessThanOrEqual(after)
		})
	})

	describe("throttle", () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("应该在指定时间内只执行一次", () => {
			const fn = vi.fn()
			const throttled = throttle(fn, 100)

			throttled()
			throttled()
			throttled()
			// 第一次立即执行，后续被节流
			expect(fn).toHaveBeenCalledTimes(1)
		})

		it("应该在等待时间后执行延迟调用", () => {
			const fn = vi.fn()
			const throttled = throttle(fn, 100)

			throttled()
			expect(fn).toHaveBeenCalledTimes(1)

			// 在节流时间内再次调用，应该被延迟
			throttled()
			expect(fn).toHaveBeenCalledTimes(1)

			// 推进时间，延迟执行
			vi.advanceTimersByTime(100)
			expect(fn).toHaveBeenCalledTimes(2)
		})

		it("应该正确传递参数", () => {
			const fn = vi.fn()
			const throttled = throttle(fn, 100)

			throttled("arg1", 2)
			expect(fn).toHaveBeenCalledWith("arg1", 2)
		})
	})

	describe("debounce", () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("应该在停止调用后才执行", () => {
			const fn = vi.fn()
			const debounced = debounce(fn, 100)

			debounced()
			debounced()
			debounced()
			expect(fn).not.toHaveBeenCalled()

			vi.advanceTimersByTime(100)
			expect(fn).toHaveBeenCalledTimes(1)
		})

		it("应该取消之前的定时器", () => {
			const fn = vi.fn()
			const debounced = debounce(fn, 100)

			debounced()
			vi.advanceTimersByTime(50)
			debounced()
			vi.advanceTimersByTime(50)
			expect(fn).not.toHaveBeenCalled()

			vi.advanceTimersByTime(50)
			expect(fn).toHaveBeenCalledTimes(1)
		})
	})

	describe("deepMerge", () => {
		it("应该正确合并简单对象", () => {
			const target: Record<string, number> = { a: 1, b: 2 }
			const source: Record<string, number> = { b: 3, c: 4 }
			const result = deepMerge(target, source)
			expect(result).toEqual({ a: 1, b: 3, c: 4 })
		})

		it("应该深度合并嵌套对象", () => {
			const target: Record<string, unknown> = { a: 1, b: { c: 2, d: 3 } }
			const source: Record<string, unknown> = { b: { d: 4, e: 5 } }
			const result = deepMerge(target, source)
			expect(result).toEqual({ a: 1, b: { c: 2, d: 4, e: 5 } })
		})

		it("不应该修改原对象", () => {
			const target: Record<string, unknown> = { a: 1, b: { c: 2 } }
			const source: Record<string, unknown> = { b: { d: 3 } }
			const result = deepMerge(target, source)
			expect(target).toEqual({ a: 1, b: { c: 2 } })
			expect(result).not.toBe(target)
		})
	})

	describe("getNestedValue", () => {
		it("应该获取嵌套对象的值", () => {
			const obj = { a: { b: { c: 1 } } }
			expect(getNestedValue(obj, "a.b.c")).toBe(1)
		})

		it("应该返回默认值当路径不存在", () => {
			const obj = { a: { b: 1 } }
			expect(getNestedValue(obj, "a.b.c", "default")).toBe("default")
		})

		it("应该处理空对象", () => {
			expect(getNestedValue({}, "a.b", "default")).toBe("default")
		})
	})

	describe("formatDate", () => {
		it("应该正确格式化日期", () => {
			const date = new Date(2024, 0, 15, 10, 30, 45)
			expect(formatDate(date)).toBe("2024-01-15 10:30:45")
		})

		it("应该支持时间戳输入", () => {
			const timestamp = new Date(2024, 0, 15).getTime()
			expect(formatDate(timestamp, "YYYY-MM-DD")).toBe("2024-01-15")
		})

		it("应该支持自定义格式", () => {
			const date = new Date(2024, 0, 15, 10, 30, 45, 123)
			expect(formatDate(date, "YYYY/MM/DD HH:mm:ss.SSS")).toBe("2024/01/15 10:30:45.123")
		})
	})

	describe("getDeviceInfo", () => {
		it("应该返回设备信息对象", () => {
			const deviceInfo = getDeviceInfo()
			expect(deviceInfo).toHaveProperty("browser")
			expect(deviceInfo).toHaveProperty("browserVersion")
			expect(deviceInfo).toHaveProperty("os")
			expect(deviceInfo).toHaveProperty("osVersion")
			expect(deviceInfo).toHaveProperty("deviceType")
			expect(deviceInfo).toHaveProperty("screenWidth")
			expect(deviceInfo).toHaveProperty("screenHeight")
			expect(deviceInfo).toHaveProperty("devicePixelRatio")
		})

		it("应该返回有效的设备类型", () => {
			const deviceInfo = getDeviceInfo()
			expect(["desktop", "tablet", "mobile"]).toContain(deviceInfo.deviceType)
		})
	})

	describe("isFeatureSupported", () => {
		it("应该正确检测 indexedDB 支持", () => {
			const result = isFeatureSupported("indexedDB")
			expect(typeof result).toBe("boolean")
		})

		it("应该正确检测 fetch 支持", () => {
			const result = isFeatureSupported("fetch")
			expect(typeof result).toBe("boolean")
		})

		it("应该正确检测未知功能", () => {
			const result = isFeatureSupported("unknownFeature" as any)
			expect(result).toBe(false)
		})
	})

	describe("safeExec", () => {
		it("应该成功执行函数", () => {
			const result = safeExec(() => "success", "default")
			expect(result).toBe("success")
		})

		it("应该在出错时返回默认值", () => {
			const result = safeExec(() => {
				throw new Error("test error")
			}, "default")
			expect(result).toBe("default")
		})
	})

	describe("hashString", () => {
		it("应该为相同字符串生成相同哈希", () => {
			const hash1 = hashString("test")
			const hash2 = hashString("test")
			expect(hash1).toBe(hash2)
		})

		it("应该为不同字符串生成不同哈希", () => {
			const hash1 = hashString("test1")
			const hash2 = hashString("test2")
			expect(hash1).not.toBe(hash2)
		})

		it("空字符串应该返回0", () => {
			expect(hashString("")).toBe(0)
		})
	})

	describe("maskString", () => {
		it("应该正确脱敏字符串", () => {
			expect(maskString("13800138000", 3, 4)).toBe("138****8000")
		})

		it("短字符串应该全部脱敏", () => {
			expect(maskString("1234", 3, 4)).toBe("****")
		})

		it("应该使用自定义保留长度", () => {
			expect(maskString("hello world", 2, 3)).toBe("he******rld")
		})
	})

	describe("truncateString", () => {
		it("应该截断超长字符串", () => {
			// truncateString 会保留 maxLength - suffix.length 个字符
			expect(truncateString("hello world", 8)).toBe("hello...")
		})

		it("不应该截断短字符串", () => {
			expect(truncateString("hello", 10)).toBe("hello")
		})

		it("应该使用自定义后缀", () => {
			// maxLength=8, suffix=".."(2 chars), 所以保留 8-2=6 个字符
			expect(truncateString("hello world", 8, "..")).toBe("hello ..")
		})
	})

	describe("parseUrlParams", () => {
		it("应该解析URL参数", () => {
			const params = parseUrlParams("https://example.com?a=1&b=2")
			expect(params).toEqual({ a: "1", b: "2" })
		})

		it("应该处理空参数", () => {
			const params = parseUrlParams("https://example.com")
			expect(params).toEqual({})
		})

		it("应该处理无效URL", () => {
			const params = parseUrlParams("invalid url")
			expect(params).toEqual({})
		})
	})

	describe("buildUrl", () => {
		it("应该正确构建URL", () => {
			const url = buildUrl("https://example.com", { a: 1, b: "test" })
			expect(url).toBe("https://example.com/?a=1&b=test")
		})

		it("应该处理已有参数的URL", () => {
			const url = buildUrl("https://example.com?x=1", { a: 2 })
			expect(url).toBe("https://example.com/?x=1&a=2")
		})
	})

	describe("sanitizeUrl", () => {
		it("应该脱敏敏感参数", () => {
			const url = sanitizeUrl("https://example.com?token=secret&password=123")
			expect(url).toContain("token=***")
			expect(url).toContain("password=***")
		})

		it("不应该修改普通参数", () => {
			const url = sanitizeUrl("https://example.com?a=1&b=2")
			expect(url).toBe("https://example.com/?a=1&b=2")
		})
	})

	describe("环境检测函数", () => {
		it("isBrowser 应该返回布尔值", () => {
			expect(typeof isBrowser()).toBe("boolean")
		})

		it("isLocalStorageSupported 应该返回布尔值", () => {
			expect(typeof isLocalStorageSupported()).toBe("boolean")
		})

		it("isSessionStorageSupported 应该返回布尔值", () => {
			expect(typeof isSessionStorageSupported()).toBe("boolean")
		})

		it("isCookieSupported 应该返回布尔值", () => {
			expect(typeof isCookieSupported()).toBe("boolean")
		})

		it("isHttps 应该返回布尔值", () => {
			expect(typeof isHttps()).toBe("boolean")
		})

		it("isServiceWorkerSupported 应该返回布尔值", () => {
			expect(typeof isServiceWorkerSupported()).toBe("boolean")
		})

		it("isNotificationSupported 应该返回布尔值", () => {
			expect(typeof isNotificationSupported()).toBe("boolean")
		})

		it("isGeolocationSupported 应该返回布尔值", () => {
			expect(typeof isGeolocationSupported()).toBe("boolean")
		})

		it("isWebSocketSupported 应该返回布尔值", () => {
			expect(typeof isWebSocketSupported()).toBe("boolean")
		})

		it("isCanvasSupported 应该返回布尔值", () => {
			expect(typeof isCanvasSupported()).toBe("boolean")
		})

		it("isWebGLSupported 应该返回布尔值", () => {
			expect(typeof isWebGLSupported()).toBe("boolean")
		})

		it("isTouchSupported 应该返回布尔值", () => {
			expect(typeof isTouchSupported()).toBe("boolean")
		})

		it("isPassiveEventSupported 应该返回布尔值", () => {
			expect(typeof isPassiveEventSupported()).toBe("boolean")
		})
	})

	describe("getEnvironmentInfo", () => {
		it("应该返回环境信息对象", () => {
			const envInfo = getEnvironmentInfo()
			expect(envInfo).toHaveProperty("isBrowser")
			expect(envInfo).toHaveProperty("isNode")
			expect(envInfo).toHaveProperty("isLocalStorageSupported")
			expect(envInfo).toHaveProperty("isSessionStorageSupported")
			expect(envInfo).toHaveProperty("isCookieSupported")
			expect(envInfo).toHaveProperty("isHttps")
			expect(envInfo).toHaveProperty("isServiceWorkerSupported")
			expect(envInfo).toHaveProperty("isNotificationSupported")
			expect(envInfo).toHaveProperty("isGeolocationSupported")
			expect(envInfo).toHaveProperty("isWebSocketSupported")
			expect(envInfo).toHaveProperty("isCanvasSupported")
			expect(envInfo).toHaveProperty("isWebGLSupported")
			expect(envInfo).toHaveProperty("isTouchSupported")
			expect(envInfo).toHaveProperty("isPassiveEventSupported")
		})
	})

	describe("localStorage操作", () => {
		beforeEach(() => {
			localStorage.clear()
		})

		describe("safeSetLocalStorage", () => {
			it("应该成功存储值", () => {
				const result = safeSetLocalStorage("key", { a: 1 })
				expect(result).toBe(true)
				expect(localStorage.getItem("key")).toBe('{"a":1}')
			})

			it("应该存储字符串", () => {
				safeSetLocalStorage("key", "value")
				expect(localStorage.getItem("key")).toBe('"value"')
			})
		})

		describe("safeGetLocalStorage", () => {
			it("应该成功读取值", () => {
				localStorage.setItem("key", '{"a":1}')
				const value = safeGetLocalStorage("key", {})
				expect(value).toEqual({ a: 1 })
			})

			it("应该返回默认值当key不存在", () => {
				const value = safeGetLocalStorage("nonexistent", "default")
				expect(value).toBe("default")
			})

			it("应该返回默认值当解析失败", () => {
				localStorage.setItem("key", "invalid json")
				const value = safeGetLocalStorage("key", "default")
				expect(value).toBe("default")
			})
		})

		describe("safeRemoveLocalStorage", () => {
			it("应该成功移除值", () => {
				localStorage.setItem("key", "value")
				const result = safeRemoveLocalStorage("key")
				expect(result).toBe(true)
				expect(localStorage.getItem("key")).toBeNull()
			})
		})
	})

	describe("网络过滤函数", () => {
		describe("matchNetworkRule", () => {
			it("应该匹配字符串规则", () => {
				expect(matchNetworkRule("https://api.example.com/data", "example.com")).toBe(true)
				expect(matchNetworkRule("https://api.example.com/data", "other.com")).toBe(false)
			})

			it("应该匹配正则规则", () => {
				expect(matchNetworkRule("https://api.example.com/data", /api\.\w+\.com/)).toBe(true)
				expect(matchNetworkRule("https://api.example.com/data", /other\.\w+\.com/)).toBe(false)
			})

			it("应该匹配函数规则", () => {
				const rule = (url: string) => url.includes("example")
				expect(matchNetworkRule("https://example.com", rule)).toBe(true)
				expect(matchNetworkRule("https://other.com", rule)).toBe(false)
			})

			it("应该处理函数异常", () => {
				const rule = () => {
					throw new Error("test")
				}
				expect(matchNetworkRule("https://example.com", rule)).toBe(false)
			})
		})

		describe("shouldRecordRequest", () => {
			it("无配置时应该记录所有请求", () => {
				expect(shouldRecordRequest("https://example.com", undefined)).toBe(true)
			})

			it("黑名单匹配时应该过滤", () => {
				const config = { blacklist: ["exclude.com"] }
				expect(shouldRecordRequest("https://exclude.com/api", config)).toBe(false)
				expect(shouldRecordRequest("https://example.com/api", config)).toBe(true)
			})

			it("白名单配置时应该只记录匹配的", () => {
				const config = { whitelist: ["include.com"] }
				expect(shouldRecordRequest("https://include.com/api", config)).toBe(true)
				expect(shouldRecordRequest("https://other.com/api", config)).toBe(false)
			})

			it("黑名单优先级应该高于白名单", () => {
				const config = {
					whitelist: ["example.com"],
					blacklist: ["exclude.example.com"],
				}
				expect(shouldRecordRequest("https://exclude.example.com", config)).toBe(false)
				expect(shouldRecordRequest("https://example.com", config)).toBe(true)
			})
		})
	})

	describe("请求处理函数", () => {
		describe("extractQueryParams", () => {
			it("应该提取查询参数", () => {
				const params = extractQueryParams("https://example.com?a=1&b=2")
				expect(params).toEqual({ a: "1", b: "2" })
			})

			it("无参数时应该返回undefined", () => {
				const params = extractQueryParams("https://example.com")
				expect(params).toBeUndefined()
			})
		})

		describe("serializeRequestBody", () => {
			it("应该序列化字符串", () => {
				expect(serializeRequestBody("test")).toBe("test")
			})

			it("应该序列化对象", () => {
				expect(serializeRequestBody({ a: 1 })).toBe('{"a":1}')
			})

			it("应该处理FormData", () => {
				const formData = new FormData()
				formData.append("key", "value")
				const result = serializeRequestBody(formData)
				expect(result).toContain("key")
				expect(result).toContain("value")
			})

			it("应该截断超长内容", () => {
				const longString = "a".repeat(3000)
				const result = serializeRequestBody(longString, 2048)
				expect(result).toContain("...[truncated]")
				// 2048 + "...[truncated]"(14 chars) = 2062
				expect(result!.length).toBeLessThanOrEqual(2062)
			})

			it("应该返回undefined当body为null", () => {
				expect(serializeRequestBody(null)).toBeUndefined()
			})

			it("应该处理URLSearchParams", () => {
				const params = new URLSearchParams()
				params.append("key", "value")
				expect(serializeRequestBody(params)).toBe("key=value")
			})

			it("应该处理ArrayBuffer", () => {
				const buffer = new ArrayBuffer(100)
				const result = serializeRequestBody(buffer)
				expect(result).toContain("Binary")
				expect(result).toContain("100 bytes")
			})

			it("应该处理Blob", () => {
				const blob = new Blob(["test"], { type: "text/plain" })
				const result = serializeRequestBody(blob)
				expect(result).toContain("Blob")
			})
		})

		describe("extractRequestHeaders", () => {
			it("应该提取Headers对象", () => {
				const headers = new Headers()
				headers.append("Content-Type", "application/json")
				headers.append("Authorization", "Bearer token")

				const result = extractRequestHeaders(headers, ["authorization"])
				expect(result).toEqual({ "content-type": "application/json" })
			})

			it("应该提取普通对象", () => {
				const headers = { "Content-Type": "application/json" }
				const result = extractRequestHeaders(headers)
				expect(result).toEqual({ "Content-Type": "application/json" })
			})

			it("应该返回undefined当headers为空", () => {
				expect(extractRequestHeaders(null)).toBeUndefined()
				expect(extractRequestHeaders({})).toBeUndefined()
			})

			it("应该处理数组格式的headers", () => {
				const headers: [string, string][] = [
					["Content-Type", "application/json"],
					["Authorization", "Bearer token"],
				]
				const result = extractRequestHeaders(headers, ["authorization"])
				expect(result).toEqual({ "Content-Type": "application/json" })
			})
		})
	})

	describe("safeSerializeState", () => {
		it("应该序列化普通对象", () => {
			const state = { a: 1, b: "test" }
			expect(safeSerializeState(state)).toEqual({ a: 1, b: "test" })
		})

		it("应该返回null当state为null", () => {
			expect(safeSerializeState(null)).toBeNull()
		})

		it("应该处理循环引用", () => {
			const state: Record<string, unknown> = { a: 1 }
			state.self = state
			expect(safeSerializeState(state)).toBeNull()
		})

		it("应该包装非对象值", () => {
			expect(safeSerializeState("string")).toEqual({ value: "string" })
			expect(safeSerializeState(123)).toEqual({ value: 123 })
		})
	})

	describe("UrlCache", () => {
		let cache: UrlCache

		beforeEach(() => {
			cache = new UrlCache(10)
		})

		it("应该正确解析pathname", () => {
			expect(cache.getPathname("https://example.com/path?query=1")).toBe("/path")
		})

		it("应该正确解析search", () => {
			expect(cache.getSearch("https://example.com/path?query=1")).toBe("?query=1")
		})

		it("应该缓存结果", () => {
			const url = "https://example.com/path"
			cache.getPathname(url)
			cache.getPathname(url) // 第二次应该从缓存获取
			// 无法直接验证缓存，但可以验证结果一致
			expect(cache.getPathname(url)).toBe("/path")
		})

		it("应该处理缓存溢出", () => {
			const smallCache = new UrlCache(2)
			smallCache.getPathname("https://example.com/1")
			smallCache.getPathname("https://example.com/2")
			smallCache.getPathname("https://example.com/3") // 应该移除第一个

			// 验证仍然可以正常工作
			expect(smallCache.getPathname("https://example.com/3")).toBe("/3")
		})

		it("应该正确清空缓存", () => {
			cache.getPathname("https://example.com/path")
			cache.clear()
			// 清空后应该仍然可以正常工作
			expect(cache.getPathname("https://example.com/path")).toBe("/path")
		})

		it("应该处理无效URL", () => {
			// 无效 URL 会返回经过 URL 编码的路径
			const result = cache.getPathname("invalid url")
			expect(result).toBe("/invalid%20url")
		})
	})

	describe("urlCache 全局实例", () => {
		it("应该存在全局实例", () => {
			expect(urlCache).toBeDefined()
			expect(urlCache instanceof UrlCache).toBe(true)
		})

		it("全局实例应该可以正常使用", () => {
			expect(urlCache.getPathname("https://example.com/test")).toBe("/test")
		})
	})
})
