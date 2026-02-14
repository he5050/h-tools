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
interface ReplayRecord {
	/** 记录类型 */
	type: RecordType;
	/** 时间戳 */
	timestamp: number;
	/** 记录数据 */
	data: Record<string, unknown>;
}

/**
 * 会话回放管理器类
 * @description 负责录制用户行为序列，支持增量快照优化
 */
export class ReplayManager {
	private eventQueue: { push: (event: ReplayEvent) => void };
	private isRecording = false;
	private records: ReplayRecord[] = [];
	private startTime = 0;
	private observers: MutationObserver[] = [];
	private maxRecords: number;

	private mouseMoveHandler: ((event: MouseEvent) => void) | null = null;
	private clickHandler: ((event: MouseEvent) => void) | null = null;
	private scrollHandler: (() => void) | null = null;
	private inputHandler: ((event: Event) => void) | null = null;
	private resizeHandler: (() => void) | null = null;

	/** 增量快照间隔（毫秒） */
	private snapshotInterval: number;
	/** 快照定时器 */
	private snapshotTimer: ReturnType<typeof setInterval> | null = null;
	/** 上一次快照的 DOM 结构哈希 */
	private lastDomHash: string = "";
	/** 待处理的 DOM 变化队列 */
	private pendingMutations: Array<{ type: string; target: string; timestamp: number }> = [];
	/** DOM 变化批处理定时器 */
	private mutationFlushTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		eventQueue: { push: (event: ReplayEvent) => void },
		maxRecords = 1000,
		snapshotInterval = 10000,
	) {
		this.eventQueue = eventQueue;
		this.maxRecords = maxRecords;
		this.snapshotInterval = snapshotInterval;
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
		this.lastDomHash = "";
		this.pendingMutations = [];

		this.recordInitialState();
		this.observeDOM();
		this.observeMouse();
		this.observeClicks();
		this.observeScroll();
		this.observeInput();
		this.observeViewport();
		this.startIncrementalSnapshots();

		logger.info("会话回放录制已启动");
	}

	/**
	 * 停止录制
	 * @description 停止录制并上报数据
	 */
	public stop(): void {
		if (!this.isRecording) return;
		this.isRecording = false;

		this.observers.forEach((observer) => observer.disconnect());
		this.observers = [];

		if (this.snapshotTimer) {
			clearInterval(this.snapshotTimer);
			this.snapshotTimer = null;
		}

		if (this.mutationFlushTimer) {
			clearTimeout(this.mutationFlushTimer);
			this.mutationFlushTimer = null;
		}

		this.removeEventListeners();
		this.flushPendingMutations();

		this.flush().catch((error) => {
			logger.error("回放数据上报失败:", error);
		});

		logger.info("会话回放录制已停止");
	}

	/**
	 * 移除所有事件监听器
	 */
	private removeEventListeners(): void {
		if (this.mouseMoveHandler) {
			document.removeEventListener("mousemove", this.mouseMoveHandler);
			this.mouseMoveHandler = null;
		}
		if (this.clickHandler) {
			document.removeEventListener("click", this.clickHandler);
			this.clickHandler = null;
		}
		if (this.scrollHandler) {
			window.removeEventListener("scroll", this.scrollHandler);
			this.scrollHandler = null;
		}
		if (this.inputHandler) {
			document.removeEventListener("input", this.inputHandler, true);
			this.inputHandler = null;
		}
		if (this.resizeHandler) {
			window.removeEventListener("resize", this.resizeHandler);
			this.resizeHandler = null;
		}
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

	/** DOM 大小限制（字符数），超过则使用简化模式 */
	private readonly MAX_DOM_SIZE = 50000;

	/**
	 * 录制初始状态
	 * @description 捕获页面初始 DOM 状态，支持大小限制
	 */
	private recordInitialState(): void {
		const fullHtml = document.documentElement.outerHTML;

		// 如果 DOM 过大，使用简化模式（只记录 body 内容）
		if (fullHtml.length > this.MAX_DOM_SIZE) {
			const bodyHtml = document.body?.outerHTML || "";
			const isStillTooLarge = bodyHtml.length > this.MAX_DOM_SIZE;

			this.addRecord({
				type: RecordType.DOM,
				timestamp: 0,
				data: {
					html: isStillTooLarge
						? `<body data-truncated="true">[DOM too large: ${fullHtml.length} chars]</body>`
						: bodyHtml,
					url: location.href,
					title: document.title,
					viewport: {
						width: window.innerWidth,
						height: window.innerHeight,
					},
					// 标记为简化模式
					isSimplified: true,
					originalSize: fullHtml.length,
					recordedSize: isStillTooLarge
						? `<body data-truncated="true">[DOM too large: ${fullHtml.length} chars]</body>`.length
						: bodyHtml.length,
				},
			});
		} else {
			this.addRecord({
				type: RecordType.DOM,
				timestamp: 0,
				data: {
					html: fullHtml,
					url: location.href,
					title: document.title,
					viewport: {
						width: window.innerWidth,
						height: window.innerHeight,
					},
					isSimplified: false,
					originalSize: fullHtml.length,
					recordedSize: fullHtml.length,
				},
			});
		}
	}

	/**
	 * 监听 DOM 变化
	 */
	private observeDOM(): void {
		const observer = new MutationObserver((mutations) => {
			if (!this.isRecording) return;

			for (const mutation of mutations) {
				this.pendingMutations.push({
					type: mutation.type,
					target: this.getElementSelector(mutation.target as HTMLElement),
					timestamp: this.getRelativeTime(),
				});
			}

			if (!this.mutationFlushTimer) {
				this.mutationFlushTimer = setTimeout(() => {
					this.flushPendingMutations();
					this.mutationFlushTimer = null;
				}, 500);
			}
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
	 * 刷新待处理的 DOM 变化
	 */
	private flushPendingMutations(): void {
		if (this.pendingMutations.length === 0) return;

		const groupedMutations = this.pendingMutations.reduce(
			(acc, m) => {
				const key = `${m.type}:${m.target}`;
				if (!acc[key]) {
					acc[key] = { type: m.type, target: m.target, count: 0, lastTimestamp: m.timestamp };
				}
				acc[key].count++;
				acc[key].lastTimestamp = m.timestamp;
				return acc;
			},
			{} as Record<string, { type: string; target: string; count: number; lastTimestamp: number }>,
		);

		for (const key of Object.keys(groupedMutations)) {
			const m = groupedMutations[key];
			this.addRecord({
				type: RecordType.DOM,
				timestamp: m.lastTimestamp,
				data: {
					type: m.type,
					target: m.target,
					count: m.count,
				},
			});
		}

		this.pendingMutations = [];
	}

	/**
	 * 启动增量快照
	 */
	private startIncrementalSnapshots(): void {
		this.snapshotTimer = setInterval(() => {
			if (!this.isRecording) return;

			const currentHash = this.computeDomHash();
			if (currentHash !== this.lastDomHash) {
				this.lastDomHash = currentHash;
				this.addRecord({
					type: RecordType.DOM,
					timestamp: this.getRelativeTime(),
					data: {
						type: "incremental-snapshot",
						hash: currentHash,
						url: location.href,
					},
				});
			}
		}, this.snapshotInterval);
	}

	/**
	 * 计算 DOM 结构哈希
	 */
	private computeDomHash(): string {
		const body = document.body;
		if (!body) return "";

		const nodeCount = body.querySelectorAll("*").length;
		const textLength = body.textContent?.length || 0;
		const classList = Array.from(body.querySelectorAll("[class]"))
			.slice(0, 50)
			.map((el) => el.className)
			.join(",");

		return `${nodeCount}:${textLength}:${classList.length}`;
	}

	/**
	 * 监听鼠标移动
	 */
	private observeMouse(): void {
		// 使用节流减少记录频率
		let lastMoveTime = 0;
		const throttleMs = 100;

		this.mouseMoveHandler = (event: MouseEvent) => {
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
		};

		document.addEventListener("mousemove", this.mouseMoveHandler);
	}

	/**
	 * 监听点击事件
	 */
	private observeClicks(): void {
		this.clickHandler = (event: MouseEvent) => {
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
		};

		document.addEventListener("click", this.clickHandler);
	}

	/**
	 * 监听滚动
	 */
	private observeScroll(): void {
		// 使用节流
		let lastScrollTime = 0;
		const throttleMs = 200;

		this.scrollHandler = () => {
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
		};

		window.addEventListener("scroll", this.scrollHandler);
	}

	/**
	 * 监听输入事件
	 */
	private observeInput(): void {
		this.inputHandler = (event: Event) => {
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
		};

		document.addEventListener("input", this.inputHandler, true);
	}

	/**
	 * 监听视口变化
	 */
	private observeViewport(): void {
		this.resizeHandler = () => {
			if (!this.isRecording) return;

			this.addRecord({
				type: RecordType.VIEWPORT,
				timestamp: this.getRelativeTime(),
				data: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
			});
		};

		window.addEventListener("resize", this.resizeHandler);
	}

	/**
	 * 添加记录
	 * @param record - 回放记录
	 */
	private addRecord(record: ReplayRecord): void {
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
	 * 压缩数据（如果支持）
	 * @param data - 原始数据
	 * @returns 压缩后的数据或原始数据
	 */
	private async compressData(data: unknown): Promise<unknown> {
		// 检查是否支持 Compression Streams API
		if (!("CompressionStream" in window)) {
			return data;
		}

		try {
			const jsonString = JSON.stringify(data);
			const encoder = new TextEncoder();
			const input = encoder.encode(jsonString);

			// 使用 gzip 压缩
			const compressedStream = new CompressionStream("gzip");
			const writer = compressedStream.writable.getWriter();
			writer.write(input);
			writer.close();

			const response = new Response(compressedStream.readable);
			const compressedArray = new Uint8Array(await response.arrayBuffer());

			logger.debug("回放数据压缩成功", {
				originalSize: jsonString.length,
				compressedSize: compressedArray.length,
				ratio: `${((1 - compressedArray.length / jsonString.length) * 100).toFixed(1)}%`,
			});

			return {
				_compressed: true,
				_algorithm: "gzip",
				data: Array.from(compressedArray),
			};
		} catch (error) {
			logger.warn("回放数据压缩失败，使用原始数据:", error);
			return data;
		}
	}

	/**
	 * 上报回放数据
	 */
	private async flush(): Promise<void> {
		if (this.records.length === 0) return;

		const rawData = {
			records: this.records,
			duration: this.getRelativeTime(),
			recordCount: this.records.length,
		};

		const compressedData = await this.compressData(rawData);

		const replayEvent: ReplayEvent = {
			type: EventType.REPLAY,
			timestamp: Date.now(),
			data: compressedData as ReplayEvent["data"],
		};

		this.eventQueue.push(replayEvent);
		logger.debug("回放数据已上报:", replayEvent);
	}
}
