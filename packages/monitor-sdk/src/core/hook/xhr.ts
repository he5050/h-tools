/**
 * @fileoverview XMLHttpRequest 拦截模块
 * @description 拦截 XHR 请求以监控网络请求性能和错误，支持白名单/黑名单过滤和请求参数记录
 */

import type { NetworkEvent, NetworkConfig } from "../../shared/types";
import { EventType } from "../../shared/types";
import { logger } from "../../shared/logger";
import {
	shouldRecordRequest,
	extractQueryParams,
	serializeRequestBody,
	extractRequestHeaders,
} from "../../shared/utils";

/**
 * XHR 请求拦截器类
 * @description 拦截 XMLHttpRequest 请求，收集网络请求数据，支持过滤和参数记录
 */
export class XHRInterceptor {
	private eventQueue: { push: (event: NetworkEvent) => void };
	private originalXHR: typeof XMLHttpRequest;
	private isIntercepting = false;
	/** 网络监控配置 */
	private networkConfig?: NetworkConfig;

	/**
	 * 构造函数
	 * @param eventQueue - 事件队列实例
	 * @param networkConfig - 网络监控配置（白名单/黑名单/参数记录）
	 */
	constructor(
		eventQueue: { push: (event: NetworkEvent) => void },
		networkConfig?: NetworkConfig,
	) {
		this.eventQueue = eventQueue;
		this.originalXHR = window.XMLHttpRequest;
		this.networkConfig = networkConfig;
	}

	/**
	 * 启用 XHR 拦截
	 * @description 重写 XMLHttpRequest 以拦截请求
	 */
	public enable(): void {
		if (this.isIntercepting) return;
		this.isIntercepting = true;

		const OriginalXHR = this.originalXHR;
		const eventQueue = this.eventQueue;
		const networkConfig = this.networkConfig;

		/**
		 * 自定义 XMLHttpRequest 类
		 * @description 包装原生 XHR 以添加监控逻辑
		 */
		function CustomXHR(this: XMLHttpRequest): XMLHttpRequest {
			const xhr = new OriginalXHR();
			const startTime = performance.now();
			let requestMethod = "GET";
			let requestUrl = "";
			/** 收集通过 setRequestHeader 设置的请求头 */
			const collectedHeaders: Record<string, string> = {};
			/** 标记是否需要记录此请求 */
			let shouldRecord = true;

			// 保存原始方法引用
			const originalOpen = xhr.open;
			const originalSend = xhr.send;
			const originalSetRequestHeader = xhr.setRequestHeader;

			/**
			 * 重写 open 方法
			 * @param method - HTTP 方法
			 * @param url - 请求 URL
			 */
			xhr.open = function (
				method: string,
				url: string | URL,
				async?: boolean,
				username?: string | null,
				password?: string | null,
			): void {
				requestMethod = method;
				requestUrl = url.toString();

				// 在 open 时判断是否需要记录
				shouldRecord = shouldRecordRequest(requestUrl, networkConfig);

				return originalOpen.call(this, method, url, async ?? true, username, password);
			};

			/**
			 * 重写 setRequestHeader 方法，收集请求头
			 */
			xhr.setRequestHeader = function (name: string, value: string): void {
				if (shouldRecord && networkConfig?.recordHeaders !== false) {
					const excludeSet = new Set(
						(networkConfig?.excludeHeaders || []).map((h) => h.toLowerCase()),
					);
					if (!excludeSet.has(name.toLowerCase())) {
						collectedHeaders[name] = value;
					}
				}
				return originalSetRequestHeader.call(this, name, value);
			};

			/**
			 * 重写 send 方法
			 * @param body - 请求体
			 */
			xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
				// 不需要记录的请求直接放行
				if (!shouldRecord) {
					return originalSend.call(this, body);
				}

				// 预提取请求参数
				let queryParams: Record<string, string> | undefined;
				let requestBody: string | undefined;
				let requestHeaders: Record<string, string> | undefined;

				if (networkConfig?.recordQuery !== false) {
					queryParams = extractQueryParams(requestUrl);
				}
				if (networkConfig?.recordBody !== false) {
					requestBody = serializeRequestBody(
						body,
						networkConfig?.maxBodySize ?? 2048,
					);
				}
				if (networkConfig?.recordHeaders !== false && Object.keys(collectedHeaders).length > 0) {
					requestHeaders = collectedHeaders;
				}

				// 监听请求完成
				const onLoadEnd = (): void => {
					const endTime = performance.now();
					const duration = Math.round(endTime - startTime);

					const networkEvent: NetworkEvent = {
						type: EventType.NETWORK,
						timestamp: Date.now(),
						data: {
							url: requestUrl,
							method: requestMethod,
							status: xhr.status,
							statusText: xhr.statusText,
							duration,
							size: xhr.responseText?.length || 0,
							success: xhr.status >= 200 && xhr.status < 300,
							type: "xhr",
							queryParams,
							requestBody,
							requestHeaders,
						},
					};

					eventQueue.push(networkEvent);
					logger.debug("XHR 请求完成:", networkEvent);

					// 移除监听器
					xhr.removeEventListener("loadend", onLoadEnd);
				};

				xhr.addEventListener("loadend", onLoadEnd);
				return originalSend.call(this, body);
			};

			return xhr;
		}

		// 复制原型和方法
		CustomXHR.prototype = OriginalXHR.prototype;
		Object.setPrototypeOf(CustomXHR, OriginalXHR);

		// 替换全局 XMLHttpRequest
		(window as typeof window & { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
			CustomXHR as unknown as typeof XMLHttpRequest;

		logger.info("XHR 拦截已启用");
	}

	/**
	 * 禁用 XHR 拦截
	 * @description 恢复原生 XMLHttpRequest
	 */
	public disable(): void {
		if (!this.isIntercepting) return;
		this.isIntercepting = false;

		window.XMLHttpRequest = this.originalXHR;
		logger.info("XHR 拦截已禁用");
	}
}
