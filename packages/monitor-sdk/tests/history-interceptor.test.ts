import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HistoryInterceptor } from "../src/core/hook/history";
import type { RouteChangeEvent } from "../src/shared/types";
import { EventType } from "../src/shared/types";

describe("HistoryInterceptor", () => {
	let originalPushState: typeof history.pushState;
	let originalReplaceState: typeof history.replaceState;
	let pushedEvents: RouteChangeEvent[];
	let mockEventQueue: { push: (event: RouteChangeEvent) => void };

	beforeEach(() => {
		originalPushState = history.pushState;
		originalReplaceState = history.replaceState;
		pushedEvents = [];
		mockEventQueue = { push: (event: RouteChangeEvent) => pushedEvents.push(event) };
	});

	afterEach(() => {
		// 确保恢复原始 History API
		history.pushState = originalPushState;
		history.replaceState = originalReplaceState;
	});

	describe("state 参数记录", () => {
		it("pushState 记录传入的 state 参数", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.enable();

			const stateData = { key: "abc123", current: "/detail/1" };
			history.pushState(stateData, "", "/detail/1");

			expect(pushedEvents).toHaveLength(1);
			const event = pushedEvents[0];
			expect(event.type).toBe(EventType.ROUTE_CHANGE);
			expect(event.data.trigger).toBe("pushState");
			expect(event.data.state).toEqual(stateData);

			interceptor.disable();
		});

		it("replaceState 记录传入的 state 参数", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.enable();

			const stateData = { key: "def456", replaced: true };
			history.replaceState(stateData, "", "/replaced");

			expect(pushedEvents).toHaveLength(1);
			const event = pushedEvents[0];
			expect(event.data.trigger).toBe("replaceState");
			expect(event.data.state).toEqual(stateData);

			interceptor.disable();
		});

		it("pushState 传入 null state 时 state 为 null", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.enable();

			history.pushState(null, "", "/no-state");

			expect(pushedEvents).toHaveLength(1);
			expect(pushedEvents[0].data.state).toBeNull();

			interceptor.disable();
		});

		it("记录 history.state 快照", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.enable();

			const stateData = { key: "xyz", position: 3 };
			history.pushState(stateData, "", "/with-history-state");

			expect(pushedEvents).toHaveLength(1);
			// historyState 应该是 pushState 后 history.state 的快照
			expect(pushedEvents[0].data.historyState).toBeDefined();

			interceptor.disable();
		});

		it("嵌套 state 对象正常序列化", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.enable();

			const stateData = {
				key: "abc",
				meta: { title: "详情页", params: { id: "123", tab: "info" } },
				position: 5,
			};
			history.pushState(stateData, "", "/nested-state");

			expect(pushedEvents).toHaveLength(1);
			expect(pushedEvents[0].data.state).toEqual(stateData);

			interceptor.disable();
		});
	});

	describe("基础路由监控", () => {
		it("记录路由变化的基本信息", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.enable();

			history.pushState(null, "", "/new-page?tab=1#section");

			expect(pushedEvents).toHaveLength(1);
			const event = pushedEvents[0];
			expect(event.type).toBe(EventType.ROUTE_CHANGE);
			expect(event.data.pathname).toBe("/new-page");
			expect(event.data.search).toBe("?tab=1");
			expect(event.data.hash).toBe("#section");

			interceptor.disable();
		});

		it("相同 URL 不重复记录", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.enable();

			// 先导航到一个新页面
			history.pushState(null, "", "/same-page");
			const count = pushedEvents.length;

			// 再次导航到相同 URL
			history.pushState(null, "", "/same-page");

			// 不应产生新事件
			expect(pushedEvents.length).toBe(count);

			interceptor.disable();
		});

		it("onRouteChange 回调被正确调用", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			const callback = vi.fn();
			interceptor.onRouteChange(callback);
			interceptor.enable();

			history.pushState(null, "", "/callback-test");

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("/callback-test"),
			);

			interceptor.disable();
		});

		it("disable 后恢复原始 History API", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.enable();

			history.pushState(null, "", "/before-disable");
			expect(pushedEvents).toHaveLength(1);

			interceptor.disable();

			history.pushState(null, "", "/after-disable");
			// disable 后不应记录
			expect(pushedEvents).toHaveLength(1);
		});

		it("重复 enable 不会重复拦截", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.enable();
			interceptor.enable(); // 第二次应被忽略

			history.pushState(null, "", "/no-duplicate");

			// 只应记录一次
			expect(pushedEvents).toHaveLength(1);

			interceptor.disable();
		});

		it("回调异常不影响路由事件记录", () => {
			const interceptor = new HistoryInterceptor(mockEventQueue);
			interceptor.onRouteChange(() => {
				throw new Error("callback error");
			});
			interceptor.enable();

			history.pushState(null, "", "/error-callback");

			// 即使回调抛出异常，事件仍应被记录
			expect(pushedEvents).toHaveLength(1);

			interceptor.disable();
		});
	});
});
