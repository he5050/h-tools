/**
 * @fileoverview Worker 主入口
 * @description Web Worker 的入口文件，负责处理主线程发来的消息
 */

import type { WorkerMessage, WorkerResponse } from "../shared/types";
import { IndexedDBStorage } from "./storage/idb";
import { BatchTransport } from "./transport/batch";
import { SnapshotProcessor } from "./processor/snapshot";
import { ReplayProcessor } from "./processor/replay";

/**
 * Worker 上下文类型声明
 */
declare const self: DedicatedWorkerGlobalScope;

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
	public async init(config: {
		dsn: string;
		batchSize: number;
		flushInterval: number;
		maxRetries: number;
		appId: string;
		enableCompression: boolean;
	}): Promise<void> {
		this.config = config;

		// 初始化存储
		await this.storage.init();

		// 初始化传输
		this.transport.init({
			dsn: config.dsn,
			batchSize: config.batchSize,
			flushInterval: config.flushInterval,
			maxRetries: config.maxRetries,
			appId: config.appId,
			enableCompression: config.enableCompression,
			onBeforeSend: async (events) => {
				// 发送前从存储中读取数据
				return this.storage.getEvents(config.batchSize);
			},
			onSuccess: async (events) => {
				// 上报成功后删除已发送的事件
				const ids = events.map((e) => e.id).filter((id): id is number => id !== undefined);
				await this.storage.deleteEvents(ids);
			},
		});

		// 启动传输
		this.transport.start();

		this.sendResponse({ type: "init", success: true });
	}

	/**
	 * 处理事件
	 * @param event - 事件数据
	 */
	public async handleEvent(event: WorkerMessage["payload"]): Promise<void> {
		if (!this.config) {
			this.sendResponse({ type: "error", error: "Worker not initialized" });
			return;
		}

		try {
			// 处理快照数据
			if (event.type === "SNAPSHOT") {
				event = this.snapshotProcessor.process(event);
			}

			// 处理回放数据
			if (event.type === "REPLAY") {
				event = this.replayProcessor.process(event);
			}

			// 存储到 IndexedDB
			const id = await this.storage.addEvent(event);

			// 立即上报关键事件
			if (this.isCriticalEvent(event)) {
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
	private isCriticalEvent(event: WorkerMessage["payload"]): boolean {
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
	const { type, payload } = event.data;

	switch (type) {
		case "init":
			await worker.init(payload as {
				dsn: string;
				batchSize: number;
				flushInterval: number;
				maxRetries: number;
				appId: string;
				enableCompression: boolean;
			});
			break;

		case "event":
			await worker.handleEvent(payload as WorkerMessage["payload"]);
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

// 监听页面卸载事件，使用 Beacon API 发送剩余数据
self.addEventListener("beforeunload", () => {
	worker.flush();
});
