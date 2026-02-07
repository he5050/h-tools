/**
 * @fileoverview Fetch API 拦截模块
 * @description 拦截 Fetch 请求以监控网络请求性能和错误，支持白名单/黑名单过滤和请求参数记录
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
 * Fetch 请求拦截器类
 * @description 拦截全局 fetch 函数，收集网络请求数据，支持过滤和参数记录
 */
export class FetchInterceptor {
	private eventQueue: { push: (event: NetworkEvent) => void };
	private originalFetch: typeof fetch;
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
		this.originalFetch = window.fetch.bind(window);
		this.networkConfig = networkConfig;
	}

	/**
	 * 启用 Fetch 拦截
	 * @description 重写全局 fetch 函数以拦截请求
	 */
	public enable(): void {
		if (this.isIntercepting) return;
		this.isIntercepting = true;

		const originalFetch = this.originalFetch;
		const eventQueue = this.eventQueue;
		const networkConfig = this.networkConfig;

		/**
		 * 自定义 fetch 函数
		 * @param input - 请求 URL 或 Request 对象
		 * @param init - 请求配置
		 * @returns Promise<Response>
		 */
		window.fetch = async function (
			input: RequestInfo | URL,
			init?: RequestInit,
		): Promise<Response> {
			const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
			const method = init?.method || "GET";

			// 白名单/黑名单过滤：不符合条件的请求直接放行，不记录
			if (!shouldRecordRequest(url, networkConfig)) {
				return originalFetch(input, init);
			}

			const startTime = performance.now();

			// 预提取请求参数（在请求发出前收集）
			let queryParams: Record<string, string> | undefined;
			let requestBody: string | undefined;
			let requestHeaders: Record<string, string> | undefined;

			if (networkConfig?.recordQuery !== false) {
				queryParams = extractQueryParams(url);
			}
			if (networkConfig?.recordBody !== false) {
				requestBody = serializeRequestBody(
					init?.body,
					networkConfig?.maxBodySize ?? 2048,
				);
			}
			if (networkConfig?.recordHeaders !== false) {
				requestHeaders = extractRequestHeaders(
					init?.headers,
					networkConfig?.excludeHeaders,
				);
			}

			try {
				const response = await originalFetch(input, init);
				const endTime = performance.now();
				const duration = Math.round(endTime - startTime);

				// 优先从 Content-Length header 获取大小，避免 clone+blob 导致大文件内存溢出
				let size = 0;
				const contentLength = response.headers.get("content-length");
				if (contentLength) {
					size = parseInt(contentLength, 10) || 0;
				}

				const networkEvent: NetworkEvent = {
					type: EventType.NETWORK,
					timestamp: Date.now(),
					data: {
						url,
						method,
						status: response.status,
						statusText: response.statusText,
						duration,
						size,
						success: response.ok,
						type: "fetch",
						queryParams,
						requestBody,
						requestHeaders,
					},
				};

				eventQueue.push(networkEvent);
				logger.debug("Fetch 请求完成:", networkEvent);

				return response;
			} catch (error) {
				const endTime = performance.now();
				const duration = Math.round(endTime - startTime);

				const networkEvent: NetworkEvent = {
					type: EventType.NETWORK,
					timestamp: Date.now(),
					data: {
						url,
						method,
						status: 0,
						statusText: error instanceof Error ? error.message : "Network Error",
						duration,
						size: 0,
						success: false,
						type: "fetch",
						error: error instanceof Error ? error.message : "Unknown Error",
						queryParams,
						requestBody,
						requestHeaders,
					},
				};

				eventQueue.push(networkEvent);
				logger.debug("Fetch 请求失败:", networkEvent);

				throw error;
			}
		};

		logger.info("Fetch 拦截已启用");
	}

	/**
	 * 禁用 Fetch 拦截
	 * @description 恢复原生 fetch 函数
	 */
	public disable(): void {
		if (!this.isIntercepting) return;
		this.isIntercepting = false;

		window.fetch = this.originalFetch;
		logger.info("Fetch 拦截已禁用");
	}
}
