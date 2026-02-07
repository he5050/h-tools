/**
 * @fileoverview 用户行为回放模块
 * @description 记录用户操作序列，支持会话回放
 */

import type { ReplayEvent } from "../shared/types";
import { EventType } from "../shared/types";
import { logger } from "../shared/logger";

/**
 * 回放记录类型
 */
enum RecordType {
	/** DOM 变化 */
	DOM = "dom",
	/** 鼠标移动 */
	MOUSE = "mouse",
	/** 点击事件 */
	CLICK = "click",
	/** 滚动 */
	SCROLL = "scroll",
	/** 输入 */
	INPUT = "input",
	/** 视口变化 */
	VIEWPORT = "viewport",
}

/**
 * 回放记录接口
 */
interface Record {
	/** 记录类型 */
	type: RecordType;
	/** 时间戳 */
	timestamp: number;
	/** 记录数据 */
	data: Record<string, unknown>;
}

/**
 * 会话回放管理器类
 * @description 负责录制用户行为序列
 */
export class ReplayManager {
	private eventQueue: { push: (event: ReplayEvent) => void };
	private isRecording = false;
	private records: Record[] = [];
	private startTime = 0;
	private observers: MutationObserver[] = [];
	private maxRecords: number;

	/**
	 * 构造函数
	 * @param eventQueue - 事件队列实例
	 * @param maxRecords - 最大记录数限制
	 */
	constructor(
		eventQueue: { push: (event: ReplayEvent) => void },
		maxRecords = 1000,
	) {
		this.eventQueue = eventQueue;
		this.maxRecords = maxRecords;
	}

	/**
	 * 开始录制
	 * @description 启动用户行为录制
	 */
	public start(): void {
		if (this.isRecording) return;
		this.isRecording = true;
		this.startTime = Date.now();
		this.records = [];

		// 录制初始 DOM 状态
		this.recordInitialState();

		// 监听 DOM 变化
		this.observeDOM();

		// 监听鼠标移动
		this.observeMouse();

		// 监听点击事件
		this.observeClicks();

		// 监听滚动
		this.observeScroll();

		// 监听输入
		this.observeInput();

		// 监听视口变化
		this.observeViewport();

		logger.info("会话回放录制已启动");
	}

	/**
	 * 停止录制
	 * @description 停止录制并上报数据
	 */
	public stop(): void {
		if (!this.isRecording) return;
		this.isRecording = false;

		// 断开所有观察者
		this.observers.forEach((observer) => observer.disconnect());
		this.observers = [];

		// 上报回放数据
		this.flush();

		logger.info("会话回放录制已停止");
	}

	/**
	 * 暂停录制
	 */
	public pause(): void {
		this.isRecording = false;
		logger.info("会话回放录制已暂停");
	}

	/**
	 * 恢复录制
	 */
	public resume(): void {
		this.isRecording = true;
		logger.info("会话回放录制已恢复");
	}

	/**
	 * 录制初始状态
	 */
	private recordInitialState(): void {
		this.addRecord({
			type: RecordType.DOM,
			timestamp: 0,
			data: {
				html: document.documentElement.outerHTML,
				url: location.href,
				title: document.title,
				viewport: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
			},
		});
	}

	/**
	 * 监听 DOM 变化
	 */
	private observeDOM(): void {
		const observer = new MutationObserver((mutations) => {
			if (!this.isRecording) return;

			mutations.forEach((mutation) => {
				this.addRecord({
					type: RecordType.DOM,
					timestamp: this.getRelativeTime(),
					data: {
						type: mutation.type,
						target: this.getElementSelector(mutation.target as HTMLElement),
					},
				});
			});
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeOldValue: true,
			characterData: true,
		});

		this.observers.push(observer);
	}

	/**
	 * 监听鼠标移动
	 */
	private observeMouse(): void {
		// 使用节流减少记录频率
		let lastMoveTime = 0;
		const throttleMs = 100;

		document.addEventListener("mousemove", (event) => {
			if (!this.isRecording) return;

			const now = Date.now();
			if (now - lastMoveTime < throttleMs) return;
			lastMoveTime = now;

			this.addRecord({
				type: RecordType.MOUSE,
				timestamp: this.getRelativeTime(),
				data: {
					x: event.clientX,
					y: event.clientY,
				},
			});
		});
	}

	/**
	 * 监听点击事件
	 */
	private observeClicks(): void {
		document.addEventListener("click", (event) => {
			if (!this.isRecording) return;

			const target = event.target as HTMLElement;
			this.addRecord({
				type: RecordType.CLICK,
				timestamp: this.getRelativeTime(),
				data: {
					x: event.clientX,
					y: event.clientY,
					target: this.getElementSelector(target),
				},
			});
		});
	}

	/**
	 * 监听滚动
	 */
	private observeScroll(): void {
		// 使用节流
		let lastScrollTime = 0;
		const throttleMs = 200;

		window.addEventListener("scroll", () => {
			if (!this.isRecording) return;

			const now = Date.now();
			if (now - lastScrollTime < throttleMs) return;
			lastScrollTime = now;

			this.addRecord({
				type: RecordType.SCROLL,
				timestamp: this.getRelativeTime(),
				data: {
					x: window.scrollX,
					y: window.scrollY,
				},
			});
		});
	}

	/**
	 * 监听输入事件
	 */
	private observeInput(): void {
		document.addEventListener(
			"input",
			(event) => {
				if (!this.isRecording) return;

				const target = event.target as HTMLInputElement;
				this.addRecord({
					type: RecordType.INPUT,
					timestamp: this.getRelativeTime(),
					data: {
						target: this.getElementSelector(target),
						// 不记录实际值，只记录有输入动作
						hasValue: !!target.value,
					},
				});
			},
			true,
		);
	}

	/**
	 * 监听视口变化
	 */
	private observeViewport(): void {
		window.addEventListener("resize", () => {
			if (!this.isRecording) return;

			this.addRecord({
				type: RecordType.VIEWPORT,
				timestamp: this.getRelativeTime(),
				data: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
			});
		});
	}

	/**
	 * 添加记录
	 * @param record - 回放记录
	 */
	private addRecord(record: Record): void {
		this.records.push(record);

		// 限制记录数量
		if (this.records.length > this.maxRecords) {
			this.records.shift();
		}
	}

	/**
	 * 获取相对时间（相对于录制开始）
	 * @returns 相对时间（毫秒）
	 */
	private getRelativeTime(): number {
		return Date.now() - this.startTime;
	}

	/**
	 * 获取元素的 CSS 选择器
	 * @param element - DOM 元素
	 * @returns CSS 选择器字符串
	 */
	private getElementSelector(element: HTMLElement): string {
		if (!element) return "";

		// 优先使用 ID
		if (element.id) {
			return `#${element.id}`;
		}

		// 使用 tag + class
		let selector = element.tagName.toLowerCase();
		if (element.className && typeof element.className === "string") {
			const classes = element.className.split(" ").filter((c) => c.trim());
			if (classes.length > 0) {
				selector += `.${classes.slice(0, 2).join(".")}`;
			}
		}

		return selector;
	}

	/**
	 * 上报回放数据
	 */
	private flush(): void {
		if (this.records.length === 0) return;

		const replayEvent: ReplayEvent = {
			type: EventType.REPLAY,
			timestamp: Date.now(),
			data: {
				records: this.records,
				duration: this.getRelativeTime(),
				recordCount: this.records.length,
			},
		};

		this.eventQueue.push(replayEvent);
		logger.debug("回放数据已上报:", replayEvent);
	}
}
