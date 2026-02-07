/**
 * @fileoverview History API 拦截模块
 * @description 拦截 History API 以监控 SPA 路由变化，支持记录 history.state 参数
 */

import type { RouteChangeEvent } from "../../shared/types";
import { EventType } from "../../shared/types";
import { logger } from "../../shared/logger";
import { safeSerializeState } from "../../shared/utils";

/**
 * History 路由拦截器类
 * @description 拦截 History API 调用，监听单页应用路由变化，记录 state 参数
 */
export class HistoryInterceptor {
	private eventQueue: { push: (event: RouteChangeEvent) => void };
	private originalPushState: typeof history.pushState;
	private originalReplaceState: typeof history.replaceState;
	private isIntercepting = false;
	private lastUrl = location.href;
	/** 路由变化回调（供白屏检测等模块监听） */
	private onRouteChangeCallbacks: Array<(from: string, to: string) => void> = [];

	/**
	 * 构造函数
	 * @param eventQueue - 事件队列实例
	 */
	constructor(eventQueue: { push: (event: RouteChangeEvent) => void }) {
		this.eventQueue = eventQueue;
		this.originalPushState = history.pushState.bind(history);
		this.originalReplaceState = history.replaceState.bind(history);
	}

	/**
	 * 注册路由变化回调
	 * @param callback - 路由变化时的回调函数
	 */
	public onRouteChange(callback: (from: string, to: string) => void): void {
		this.onRouteChangeCallbacks.push(callback);
	}

	/**
	 * 启用 History 拦截
	 * @description 重写 History API 以监听路由变化
	 */
	public enable(): void {
		if (this.isIntercepting) return;
		this.isIntercepting = true;

		const self = this;

		/**
		 * 重写 pushState 方法
		 * @description 拦截 pushState 调用，记录传入的 state 参数
		 */
		history.pushState = function (
			data: unknown,
			unused: string,
			url?: string | URL | null,
		): void {
			self.originalPushState.call(this, data, unused, url);
			self.handleRouteChange("pushState", undefined, undefined, data);
		};

		/**
		 * 重写 replaceState 方法
		 * @description 拦截 replaceState 调用，记录传入的 state 参数
		 */
		history.replaceState = function (
			data: unknown,
			unused: string,
			url?: string | URL | null,
		): void {
			self.originalReplaceState.call(this, data, unused, url);
			self.handleRouteChange("replaceState", undefined, undefined, data);
		};

		// 监听 popstate 事件（后退/前进按钮）— 使用具名函数以便移除
		window.addEventListener("popstate", this.handlePopState);

		// 监听 hashchange 事件（hash 路由）— 使用具名函数以便移除
		window.addEventListener("hashchange", this.handleHashChange);

		logger.info("History 拦截已启用");
	}

	/**
	 * 禁用 History 拦截
	 * @description 恢复原生 History API 并移除所有事件监听器
	 */
	public disable(): void {
		if (!this.isIntercepting) return;
		this.isIntercepting = false;

		history.pushState = this.originalPushState;
		history.replaceState = this.originalReplaceState;

		// 移除事件监听器，防止内存泄漏
		window.removeEventListener("popstate", this.handlePopState);
		window.removeEventListener("hashchange", this.handleHashChange);

		this.onRouteChangeCallbacks = [];
		logger.info("History 拦截已禁用");
	}

	/**
	 * popstate 事件处理器
	 * @description popstate 触发时，state 来自 history.state（浏览器自动恢复）
	 */
	private handlePopState = (): void => {
		this.handleRouteChange("popstate");
	};

	/**
	 * hashchange 事件处理器
	 */
	private handleHashChange = (event: HashChangeEvent): void => {
		this.handleRouteChange("hashchange", event.oldURL, event.newURL);
	};

	/**
	 * 处理路由变化
	 * @param trigger - 触发路由变化的方式
	 * @param from - 来源 URL（可选）
	 * @param to - 目标 URL（可选）
	 * @param stateData - pushState/replaceState 传入的 state 参数（可选）
	 */
	private handleRouteChange(
		trigger: string,
		from?: string,
		to?: string,
		stateData?: unknown,
	): void {
		const currentUrl = location.href;
		const previousUrl = from || this.lastUrl;

		if (previousUrl === currentUrl) return;

		// 序列化 pushState/replaceState 传入的 state 参数
		const state = safeSerializeState(stateData);
		// 获取当前 history.state 快照（包含框架注入的完整 state）
		const historyState = safeSerializeState(history.state);

		const routeEvent: RouteChangeEvent = {
			type: EventType.ROUTE_CHANGE,
			timestamp: Date.now(),
			data: {
				from: previousUrl,
				to: currentUrl,
				trigger,
				pathname: location.pathname,
				search: location.search,
				hash: location.hash,
				state,
				historyState,
			},
		};

		this.eventQueue.push(routeEvent);
		this.lastUrl = currentUrl;

		// 通知路由变化回调
		for (const callback of this.onRouteChangeCallbacks) {
			try {
				callback(previousUrl, currentUrl);
			} catch (e) {
				logger.warn("路由变化回调执行失败:", e);
			}
		}

		logger.debug("路由变化:", routeEvent);
	}
}
