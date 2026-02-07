/**
 * @fileoverview 事件追踪模块
 * @description 追踪用户点击行为和自定义事件
 */

import type { TrackEvent } from "../../shared/types";
import { EventType } from "../../shared/types";
import { logger } from "../../shared/logger";

/**
 * 事件追踪器类
 * @description 负责追踪用户点击事件和自定义事件
 */
export class EventTracker {
	private eventQueue: { push: (event: TrackEvent) => void };
	private isTracking = false;

	/**
	 * 构造函数
	 * @param eventQueue - 事件队列实例
	 */
	constructor(eventQueue: { push: (event: TrackEvent) => void }) {
		this.eventQueue = eventQueue;
	}

	/**
	 * 启动事件追踪
	 * @description 注册点击事件监听器
	 */
	public start(): void {
		if (this.isTracking) return;
		this.isTracking = true;

		// 使用事件委托监听点击事件
		document.addEventListener("click", this.handleClick);

		logger.info("事件追踪已启动");
	}

	/**
	 * 停止事件追踪
	 * @description 移除点击事件监听器
	 */
	public stop(): void {
		if (!this.isTracking) return;
		this.isTracking = false;

		document.removeEventListener("click", this.handleClick);

		logger.info("事件追踪已停止");
	}

	/**
	 * 追踪自定义事件
	 * @param eventName - 事件名称
	 * @param data - 事件数据
	 */
	public track(eventName: string, data?: Record<string, unknown>): void {
		const customEvent: TrackEvent = {
			type: EventType.CUSTOM,
			timestamp: Date.now(),
			data: {
				eventName,
				...data,
			},
		};

		this.eventQueue.push(customEvent);
		logger.debug("自定义事件:", customEvent);
	}

	/**
	 * 处理点击事件
	 * @param event - MouseEvent 对象
	 */
	private handleClick = (event: MouseEvent): void => {
		const target = event.target as HTMLElement;
		if (!target) return;

		// 获取点击元素的信息
		const elementInfo = this.getElementInfo(target);

		const clickEvent: TrackEvent = {
			type: EventType.CLICK,
			timestamp: Date.now(),
			data: {
				x: event.clientX,
				y: event.clientY,
				...elementInfo,
			},
		};

		this.eventQueue.push(clickEvent);
		logger.debug("点击事件:", clickEvent);
	};

	/**
	 * 获取元素信息
	 * @param element - DOM 元素
	 * @returns 元素信息对象
	 */
	private getElementInfo(element: HTMLElement): {
		tagName: string;
		id?: string;
		className?: string;
		text?: string;
		href?: string;
		selector: string;
	} {
		const info: {
			tagName: string;
			id?: string;
			className?: string;
			text?: string;
			href?: string;
			selector: string;
		} = {
			tagName: element.tagName.toLowerCase(),
			selector: this.getElementSelector(element),
		};

		// ID
		if (element.id) {
			info.id = element.id;
		}

		// 类名
		if (element.className && typeof element.className === "string") {
			info.className = element.className;
		}

		// 文本内容（限制长度）
		const text = element.textContent?.trim();
		if (text && text.length > 0) {
			info.text = text.length > 50 ? `${text.substring(0, 50)}...` : text;
		}

		// 链接地址
		if (element instanceof HTMLAnchorElement) {
			info.href = element.href;
		}

		return info;
	}

	/**
	 * 获取元素的 CSS 选择器
	 * @param element - DOM 元素
	 * @returns CSS 选择器字符串
	 */
	private getElementSelector(element: HTMLElement): string {
		const parts: string[] = [];
		let current: HTMLElement | null = element;

		while (current && current.tagName !== "BODY" && parts.length < 5) {
			let selector = current.tagName.toLowerCase();

			// 添加 ID
			if (current.id) {
				selector += `#${current.id}`;
				parts.unshift(selector);
				break;
			}

			// 添加类名（限制数量）
			if (current.className && typeof current.className === "string") {
				const classes = current.className.split(" ").filter((c) => c.trim());
				if (classes.length > 0) {
					selector += `.${classes.slice(0, 3).join(".")}`;
				}
			}

			parts.unshift(selector);
			current = current.parentElement;
		}

		return parts.join(" > ");
	}
}
