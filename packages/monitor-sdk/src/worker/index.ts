/**
 * @fileoverview Worker 主入口
 * @description Web Worker 的入口文件，负责处理主线程发来的消息
 */

import type { WorkerMessage, WorkerResponse, MonitorEvent, InitConfig } from "../shared/types";
import { IndexedDBStorage } from "./storage/idb";
import { BatchTransport } from "./transport/batch";
import { SnapshotProcessor } from "./processor/snapshot";
import { ReplayProcessor } from "./processor/replay";

/**
 * Worker 上下文类型声明
 */
declare const self: Worker;

/**
 * 监控 Worker 类
 * @description 处理来自主线程的事件数据，管理存储和上报
 */
class MonitorWorker {
	/** IndexedDB 存储实例 */
	private storage: IndexedDBStorage;
	/** 批量传输实例 */
	private transport: BatchTransport;
	/** 快照处理器 */
	private snapshotProcessor: SnapshotProcessor;
	/** 回放处理器 */
	private replayProcessor: ReplayProcessor;
	/** Worker 配置 */
	private config: {
		dsn: string;
		batchSize: number;
		flushInterval: number;
		maxRetries: number;
		appId: string;
		enableCompression: boolean;
	} | null = null;

	/**
	 * 构造函数
	 * @description 初始化 Worker 组件
	 */
	constructor() {
		this.storage = new IndexedDBStorage();
		this.transport = new BatchTransport();
		this.snapshotProcessor = new SnapshotProcessor();
		this.replayProcessor = new ReplayProcessor();
	}

	/**
	 * 初始化 Worker
	 * @param config - Worker 配置
	 */
	public async init(config: InitConfig): Promise<void> {
		this.config = {
			dsn: config.dsn,
			batchSize: config.batchSize ?? 10,
			flushInterval: config.flushInterval ?? 5000,
			maxRetries: config.maxRetries ?? 3,
			appId: config.appId ?? "",
			enableCompression: config.enableCompression ?? true,
		};

		await this.storage.init();

		this.transport.init({
			dsn: this.config.dsn,
			batchSize: this.config.batchSize,
			flushInterval: this.config.flushInterval,
			maxRetries: this.config.maxRetries,
			appId: this.config.appId,
			enableCompression: this.config.enableCompression,
			onBeforeSend: async (events) => {
				return this.storage.getEvents(this.config!.batchSize);
			},
			onSuccess: async (events) => {
				const ids = events.map((e) => e.id).filter((id): id is number => id !== undefined);
				await this.storage.deleteEvents(ids);
			},
		});

		this.transport.start();

		this.sendResponse({ type: "init", success: true });
	}

	/**
	 * 处理事件
	 * @param event - 事件数据
	 */
	public async handleEvent(event: MonitorEvent): Promise<void> {
		if (!this.config) {
			this.sendResponse({ type: "error", error: "Worker not initialized" });
			return;
		}

		try {
			let processedEvent: MonitorEvent = event;

			if (event.type === "SNAPSHOT") {
				processedEvent = this.snapshotProcessor.process(event as unknown as Record<string, unknown>) as unknown as MonitorEvent;
			}

			if (event.type === "REPLAY") {
				processedEvent = this.replayProcessor.process(event as unknown as Record<string, unknown>) as unknown as MonitorEvent;
			}

			const id = await this.storage.addEvent(processedEvent as unknown as Record<string, unknown>);

			if (this.isCriticalEvent(processedEvent)) {
				await this.transport.flush();
			}

			this.sendResponse({ type: "event", id, success: true });
		} catch (error) {
			this.sendResponse({
				type: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	/**
	 * 立即刷新数据
	 * @description 强制将所有数据上报
	 */
	public async flush(): Promise<void> {
		if (!this.config) return;
		await this.transport.flush();
		this.sendResponse({ type: "flush", success: true });
	}

	/**
	 * 清理过期数据
	 * @description 删除超过 TTL 的数据
	 */
	public async cleanup(): Promise<void> {
		await this.storage.cleanup();
		this.sendResponse({ type: "cleanup", success: true });
	}

	/**
	 * 销毁 Worker
	 * @description 清理资源
	 */
	public async destroy(): Promise<void> {
		this.transport.stop();
		await this.storage.close();
		this.sendResponse({ type: "destroy", success: true });
	}

	/**
	 * 判断是否为关键事件
	 * @param event - 事件数据
	 * @returns 是否为关键事件
	 */
	private isCriticalEvent(event: MonitorEvent): boolean {
		const criticalTypes = ["ERROR", "PROMISE_REJECTION", "RESOURCE_ERROR", "BLANK_SCREEN"];
		return criticalTypes.includes(event.type);
	}

	/**
	 * 发送响应到主线程
	 * @param response - 响应数据
	 */
	private sendResponse(response: WorkerResponse): void {
		self.postMessage(response);
	}
}

// 创建 Worker 实例
const worker = new MonitorWorker();

/**
 * 监听主线程消息
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;
	const type = message.type;

	switch (type) {
		case "init":
			await worker.init((message as { type: "init"; payload: InitConfig }).payload);
			break;

		case "event":
			await worker.handleEvent((message as { type: "event"; payload: MonitorEvent }).payload);
			break;

		case "flush":
			await worker.flush();
			break;

		case "cleanup":
			await worker.cleanup();
			break;

		case "destroy":
			await worker.destroy();
			break;

		default:
			worker["sendResponse"]({ type: "error", error: `Unknown message type: ${type}` });
	}
};
