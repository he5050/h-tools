/**
 * @fileoverview PV/UV 追踪模块
 * @description 追踪页面浏览量和独立访客数
 */

import type { TrackEvent } from "../../shared/types";
import { EventType } from "../../shared/types";
import { logger } from "../../shared/logger";

/**
 * PV/UV 追踪器类
 * @description 负责追踪页面浏览量(PV)和独立访客数(UV)
 */
export class PVTracker {
	private eventQueue: { push: (event: TrackEvent) => void };
	private sessionManager: { getSessionId: () => string };
	private isTracking = false;

	/**
	 * 构造函数
	 * @param eventQueue - 事件队列实例
	 * @param sessionManager - 会话管理器实例
	 */
	constructor(
		eventQueue: { push: (event: TrackEvent) => void },
		sessionManager: { getSessionId: () => string },
	) {
		this.eventQueue = eventQueue;
		this.sessionManager = sessionManager;
	}

	/**
	 * 启动 PV/UV 追踪
	 * @description 记录页面访问事件
	 */
	public start(): void {
		if (this.isTracking) return;
		this.isTracking = true;

		// 记录 PV 事件
		this.trackPV();

		// 记录 UV 事件（基于会话）
		this.trackUV();

		// 监听页面可见性变化，重新进入页面时记录 PV
		document.addEventListener("visibilitychange", this.handleVisibilityChange);

		logger.info("PV/UV 追踪已启动");
	}

	/**
	 * 停止 PV/UV 追踪
	 * @description 移除事件监听器
	 */
	public stop(): void {
		this.isTracking = false;
		document.removeEventListener("visibilitychange", this.handleVisibilityChange);
		logger.info("PV/UV 追踪已停止");
	}

	/**
	 * 追踪页面浏览量 (PV)
	 * @description 记录每次页面访问
	 */
	private trackPV(): void {
		const pvEvent: TrackEvent = {
			type: EventType.PV,
			timestamp: Date.now(),
			data: {
				url: location.href,
				pathname: location.pathname,
				search: location.search,
				referrer: document.referrer,
				title: document.title,
			},
		};

		this.eventQueue.push(pvEvent);
		logger.debug("PV 事件:", pvEvent);
	}

	/**
	 * 追踪独立访客 (UV)
	 * @description 基于会话记录独立访客
	 */
	private trackUV(): void {
		const sessionId = this.sessionManager.getSessionId();
		const uvEvent: TrackEvent = {
			type: EventType.UV,
			timestamp: Date.now(),
			data: {
				sessionId,
				url: location.href,
				pathname: location.pathname,
				referrer: document.referrer,
			},
		};

		this.eventQueue.push(uvEvent);
		logger.debug("UV 事件:", uvEvent);
	}

	/**
	 * 处理页面可见性变化
	 * @description 当页面重新可见时记录新的 PV
	 */
	private handleVisibilityChange = (): void => {
		if (document.visibilityState === "visible") {
			// 页面重新可见，记录新的 PV
			this.trackPV();
		}
	};
}
