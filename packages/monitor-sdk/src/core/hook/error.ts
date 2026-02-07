/**
 * @fileoverview 错误监控模块
 * @description 捕获和报告 JavaScript 错误、Promise 拒绝、资源加载错误等
 */

import type { MonitorErrorEvent, MonitorPromiseRejectionEvent, ResourceErrorEvent } from "../../shared/types";
import { EventType } from "../../shared/types";
import { logger } from "../../shared/logger";

/**
 * 错误监控器类
 * @description 负责捕获各种类型的错误并上报
 */
export class ErrorMonitor {
	private eventQueue: {
		push: (event: MonitorErrorEvent | MonitorPromiseRejectionEvent | ResourceErrorEvent) => void;
	};
	private filterErrors: RegExp[];
	private isListening = false;

	/**
	 * 构造函数
	 * @param eventQueue - 事件队列实例
	 * @param filterErrors - 错误过滤正则表达式列表
	 */
	constructor(
		eventQueue: {
			push: (event: MonitorErrorEvent | MonitorPromiseRejectionEvent | ResourceErrorEvent) => void;
		},
		filterErrors: RegExp[] = [],
	) {
		this.eventQueue = eventQueue;
		this.filterErrors = filterErrors;
	}

	/**
	 * 启动错误监听
	 * @description 注册所有错误事件监听器
	 */
	public start(): void {
		if (this.isListening) return;
		this.isListening = true;

		// 监听 JavaScript 运行时错误
		window.addEventListener("error", this.handleError as EventListener);

		// 监听 Promise 拒绝错误
		window.addEventListener(
			"unhandledrejection",
			this.handlePromiseRejection as EventListener,
		);

		logger.info("错误监控已启动");
	}

	/**
	 * 停止错误监听
	 * @description 移除所有错误事件监听器
	 */
	public stop(): void {
		if (!this.isListening) return;
		this.isListening = false;

		window.removeEventListener("error", this.handleError as EventListener);
		window.removeEventListener(
			"unhandledrejection",
			this.handlePromiseRejection as EventListener,
		);

		logger.info("错误监控已停止");
	}

	/**
	 * 处理 JavaScript 错误事件
	 * @param event - 浏览器原生错误事件对象
	 */
	private handleError = (event: globalThis.ErrorEvent): void => {
		// 检查是否应该过滤此错误
		if (this.shouldFilterError(event.message, event.error?.stack)) {
			return;
		}

		const target = event.target as HTMLElement;

		// 判断是否为资源加载错误
		if (target && (target.tagName === "IMG" || target.tagName === "SCRIPT" || target.tagName === "LINK" || target.tagName === "VIDEO" || target.tagName === "AUDIO" || target.tagName === "IFRAME")) {
			this.handleResourceError(target);
			return;
		}

		// 构建错误事件数据
		const errorEvent: MonitorErrorEvent = {
			type: EventType.ERROR,
			timestamp: Date.now(),
			data: {
				message: event.message,
				stack: event.error?.stack || "",
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				errorType: event.error?.name || "Error",
			},
		};

		this.eventQueue.push(errorEvent);
		logger.debug("捕获到 JS 错误:", errorEvent);
	};

	/**
	 * 处理 Promise 拒绝错误
	 * @param event - 浏览器原生 PromiseRejectionEvent 对象
	 */
	private handlePromiseRejection = (event: globalThis.PromiseRejectionEvent): void => {
		const reason = event.reason;
		let message: string;
		let stack = "";

		// 处理不同类型的拒绝原因
		if (reason instanceof Error) {
			message = reason.message;
			stack = reason.stack || "";
		} else if (typeof reason === "string") {
			message = reason;
		} else {
			message = JSON.stringify(reason);
		}

		// 检查是否应该过滤此错误
		if (this.shouldFilterError(message, stack)) {
			return;
		}

		const rejectionEvent: MonitorPromiseRejectionEvent = {
			type: EventType.PROMISE_REJECTION,
			timestamp: Date.now(),
			data: {
				message,
				stack,
				errorType: "UnhandledPromiseRejection",
			},
		};

		this.eventQueue.push(rejectionEvent);
		logger.debug("捕获到 Promise 拒绝错误:", rejectionEvent);
	};

	/**
	 * 处理资源加载错误
	 * @param target - 发生错误的 DOM 元素
	 */
	private handleResourceError(target: HTMLElement): void {
		const tagName = target.tagName.toLowerCase();
		let url = "";

		// 根据标签类型获取资源 URL
		switch (tagName) {
			case "img":
				url = (target as HTMLImageElement).src;
				break;
			case "script":
				url = (target as HTMLScriptElement).src;
				break;
			case "link":
				url = (target as HTMLLinkElement).href;
				break;
		}

		// 检查是否应该过滤此错误
		if (this.shouldFilterError(url, "")) {
			return;
		}

		const resourceEvent: ResourceErrorEvent = {
			type: EventType.RESOURCE_ERROR,
			timestamp: Date.now(),
			data: {
				url,
				tagName,
				selector: this.getElementSelector(target),
			},
		};

		this.eventQueue.push(resourceEvent);
		logger.debug("捕获到资源加载错误:", resourceEvent);
	}

	/**
	 * 判断错误是否应该被过滤
	 * @param message - 错误消息
	 * @param stack - 错误堆栈
	 * @returns 是否应该过滤
	 */
	private shouldFilterError(message: string, stack?: string): boolean {
		const errorText = `${message} ${stack || ""}`;
		return this.filterErrors.some((pattern) => pattern.test(errorText));
	}

	/**
	 * 获取元素的 CSS 选择器
	 * @param element - DOM 元素
	 * @returns CSS 选择器字符串
	 */
	private getElementSelector(element: HTMLElement): string {
		const parts: string[] = [];
		let current: HTMLElement | null = element;

		while (current && current.tagName !== "BODY") {
			let selector = current.tagName.toLowerCase();

			// 添加 ID
			if (current.id) {
				selector += `#${current.id}`;
			}

			// 添加类名
			if (current.className && typeof current.className === "string") {
				const classes = current.className.split(" ").filter((c) => c.trim());
				if (classes.length > 0) {
					selector += `.${classes.join(".")}`;
				}
			}

			parts.unshift(selector);
			current = current.parentElement;
		}

		return parts.join(" > ");
	}
}
