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
	urlCache,
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
			let startTime = 0;
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
				startTime = performance.now();

				if (!shouldRecord) {
					return originalSend.call(this, body);
				}

				let lazyParams: {
					queryParams?: Record<string, string>;
					requestBody?: string;
					requestHeaders?: Record<string, string>;
				} | null = null;

				const getParams = () => {
					if (!lazyParams) {
						lazyParams = {
							queryParams: networkConfig?.recordQuery !== false 
								? extractQueryParams(requestUrl) 
								: undefined,
							requestBody: networkConfig?.recordBody !== false 
								? serializeRequestBody(body, networkConfig?.maxBodySize ?? 2048) 
								: undefined,
							requestHeaders: networkConfig?.recordHeaders !== false && Object.keys(collectedHeaders).length > 0
								? { ...collectedHeaders }
								: undefined,
						};
					}
					return lazyParams;
				};

				let isReported = false;

				const reportResult = (errorType?: string, errorMessage?: string): void => {
					if (isReported) return;
					isReported = true;

					const endTime = performance.now();
					const duration = Math.round(endTime - startTime);
					const params = getParams();
					const isSuccess = xhr.status >= 200 && xhr.status < 300 && !errorType;

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
							success: isSuccess,
							type: "xhr",
							queryParams: params.queryParams,
							requestBody: params.requestBody,
							requestHeaders: params.requestHeaders,
							...(errorType && { error: errorMessage }),
						},
					};

					eventQueue.push(networkEvent);
					logger.debug("XHR 请求完成:", networkEvent);

					xhr.removeEventListener("loadend", onLoadEnd);
					xhr.removeEventListener("error", onError);
					xhr.removeEventListener("timeout", onTimeout);
					xhr.removeEventListener("abort", onAbort);
				};

				const onLoadEnd = (): void => reportResult();
				const onError = (): void => reportResult("network", "网络请求失败");
				const onTimeout = (): void => reportResult("timeout", `请求超时（超时时间: ${xhr.timeout}ms）`);
				const onAbort = (): void => reportResult("abort", "请求被取消");

				xhr.addEventListener("loadend", onLoadEnd);
				xhr.addEventListener("error", onError);
				xhr.addEventListener("timeout", onTimeout);
				xhr.addEventListener("abort", onAbort);

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
