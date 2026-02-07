/**
 * @fileoverview 事件队列模块
 * @description 负责主线程与 Worker 之间的通信，实现事件的异步处理和批量上报
 */

import { MonitorEvent } from "../shared/types"
import { generateId } from "../shared/utils"

/**
 * 事件队列类
 * @description 管理事件的入队、出队和与 Worker 的通信
 */
export class EventQueue {
	/** Worker 实例 */
	private worker: Worker | null = null
	/** 内存队列（Worker 不可用时使用） */
	private queue: MonitorEvent[] = []
	/** 队列最大长度 */
	private maxQueueSize: number
	/** 批量大小 */
	private batchSize: number
	/** 数据接收地址 */
	private dsn: string
	/** 定时刷新的定时器 */
	private flushTimer: ReturnType<typeof setInterval> | null = null
	/** 刷新间隔（毫秒） */
	private flushInterval: number
	/** 应用 ID */
	private appId: string

	/**
	 * 创建事件队列实例
	 * @param dsn - 数据接收地址
	 * @param batchSize - 批量大小
	 * @param flushInterval - 刷新间隔（毫秒）
	 * @param appId - 应用 ID
	 */
	constructor(dsn: string, batchSize = 10, flushInterval = 5000, appId = "") {
		this.dsn = dsn
		this.batchSize = batchSize
		this.maxQueueSize = 100
		this.flushInterval = flushInterval
		this.appId = appId
		this.initWorker()
	}

	/**
	 * 初始化 Worker
	 * @description 创建 Worker 线程，设置消息处理回调
	 */
	private initWorker(): void {
		try {
			// 创建内联 Worker（通过 Blob URL）
			const workerScript = this.createWorkerScript()
			const blob = new Blob([workerScript], { type: "application/javascript" })
			const workerUrl = URL.createObjectURL(blob)
			this.worker = new Worker(workerUrl)

			// 初始化 Worker
			this.worker.postMessage({
				type: "init",
				payload: {
					dsn: this.dsn,
					batchSize: this.batchSize,
					flushInterval: this.flushInterval,
					maxRetries: 3,
					appId: this.appId,
					enableCompression: false,
				},
			})

			// 设置消息接收回调
			this.worker.onmessage = (e) => {
				this.handleWorkerMessage(e.data)
			}

			// 设置错误处理回调
			this.worker.onerror = (error) => {
				console.error("[Monitor SDK] Worker 错误:", error)
				this.fallbackToImmediateSend()
			}
		} catch (error) {
			// Worker 创建失败时降级到主线程处理
			console.warn("[Monitor SDK] Worker 不支持，降级到主线程")
			this.fallbackToImmediateSend()
		}
	}

	/**
	 * 创建 Worker 脚本
	 * @returns Worker 脚本字符串
	 * @description 定义 Worker 线程的执行逻辑
	 */
	private createWorkerScript(): string {
		return `
			// IndexedDB 存储类
			class IndexedDBStorage {
				constructor() {
					this.db = null;
					this.dbName = 'monitor_sdk_db';
					this.dbVersion = 1;
					this.storeName = 'events';
				}

				async init() {
					return new Promise((resolve, reject) => {
						const request = indexedDB.open(this.dbName, this.dbVersion);

						request.onerror = () => reject(request.error);
						request.onsuccess = () => {
							this.db = request.result;
							resolve();
						};

						request.onupgradeneeded = (event) => {
							const db = event.target.result;
							if (!db.objectStoreNames.contains(this.storeName)) {
								const store = db.createObjectStore(this.storeName, {
									keyPath: 'id',
									autoIncrement: true,
								});
								store.createIndex('timestamp', 'timestamp', { unique: false });
							}
						};
					});
				}

				async addEvent(event) {
					return new Promise((resolve, reject) => {
						if (!this.db) {
							reject(new Error('Database not initialized'));
							return;
						}

						const transaction = this.db.transaction([this.storeName], 'readwrite');
						const store = transaction.objectStore(this.storeName);
						const request = store.add({ ...event, timestamp: Date.now() });

						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					});
				}

				async getEvents(limit) {
					return new Promise((resolve, reject) => {
						if (!this.db) {
							reject(new Error('Database not initialized'));
							return;
						}

						const transaction = this.db.transaction([this.storeName], 'readonly');
						const store = transaction.objectStore(this.storeName);
						const request = store.openCursor();

						const events = [];
						request.onsuccess = () => {
							const cursor = request.result;
							if (cursor && events.length < limit) {
								events.push(cursor.value);
								cursor.continue();
							} else {
								resolve(events);
							}
						};

						request.onerror = () => reject(request.error);
					});
				}

				async deleteEvents(ids) {
					return new Promise((resolve, reject) => {
						if (!this.db) {
							reject(new Error('Database not initialized'));
							return;
						}

						const transaction = this.db.transaction([this.storeName], 'readwrite');
						const store = transaction.objectStore(this.storeName);

						let completed = 0;
						let hasError = false;

						if (ids.length === 0) {
							resolve();
							return;
						}

						ids.forEach((id) => {
							const request = store.delete(id);

							request.onsuccess = () => {
								completed++;
								if (completed === ids.length && !hasError) {
									resolve();
								}
							};

							request.onerror = () => {
								hasError = true;
								reject(request.error);
							};
						});
					});
				}

				async close() {
					if (this.db) {
						this.db.close();
						this.db = null;
					}
				}
			}

			// Worker 主逻辑
			let storage = new IndexedDBStorage();
			let config = null;
			let flushTimer = null;

			self.onmessage = async (e) => {
				const message = e.data;

				switch (message.type) {
					case 'init':
						config = message.payload;
						await storage.init();
						startFlushTimer();
						self.postMessage({ type: 'init', success: true });
						break;

					case 'event':
						await storage.addEvent(message.payload);
						self.postMessage({ type: 'event', success: true });
						break;

					case 'flush':
						await flushQueue();
						self.postMessage({ type: 'flush', success: true });
						break;

					case 'destroy':
						stopFlushTimer();
						await storage.close();
						self.postMessage({ type: 'destroy', success: true });
						break;
				}
			};

			async function flushQueue() {
				if (!config) return;

				try {
					const events = await storage.getEvents(config.batchSize);

					if (events.length === 0) return;

					const payload = {
						appId: config.appId,
						timestamp: Date.now(),
						events,
					};

					const response = await fetch(config.dsn, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload),
						keepalive: true,
					});

					if (response.ok) {
						const ids = events.map((e) => e.id).filter((id) => id !== undefined);
						await storage.deleteEvents(ids);
					}
				} catch (error) {
					console.error('[Monitor SDK] 上报失败:', error);
				}
			}

			function startFlushTimer() {
				if (config && flushTimer === null) {
					flushTimer = setInterval(flushQueue, config.flushInterval);
				}
			}

			function stopFlushTimer() {
				if (flushTimer) {
					clearInterval(flushTimer);
					flushTimer = null;
				}
			}

		`
	}

	/**
	 * 处理 Worker 消息
	 * @param message - Worker 发送的消息
	 */
	private handleWorkerMessage(message: { type: string; success?: boolean; error?: string }): void {
		switch (message.type) {
			case "init":
				if (message.success) {
					console.log("[Monitor SDK] Worker 初始化成功")
				} else {
					console.error("[Monitor SDK] Worker 初始化失败:", message.error)
				}
				break
			case "event":
				if (!message.success) {
					console.error("[Monitor SDK] 事件发送失败:", message.error)
				}
				break
			case "flush":
				if (!message.success) {
					console.error("[Monitor SDK] 刷新失败:", message.error)
				}
				break
			case "error":
				console.error("[Monitor SDK] Worker 错误:", message.error)
				break
		}
	}

	/**
	 * 降级到立即发送模式
	 * @description 当 Worker 不可用时，直接在主线程处理
	 */
	private fallbackToImmediateSend(): void {
		this.worker = null

		// 启动定时刷新，直接发送到服务器
		this.flushTimer = setInterval(() => {
			this.flushQueueImmediate()
		}, this.flushInterval)
	}

	/**
	 * 立即刷新队列（降级模式）
	 */
	private async flushQueueImmediate(): Promise<void> {
		if (this.queue.length === 0) return

		const events = this.queue.splice(0, this.batchSize)

		try {
			const payload = {
				appId: this.appId,
				timestamp: Date.now(),
				events,
			}

			const response = await fetch(this.dsn, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				keepalive: true,
			})

			if (!response.ok) {
				console.error("[Monitor SDK] 上报失败:", response.statusText)
			}
		} catch (error) {
			console.error("[Monitor SDK] 上报失败:", error)
		}
	}

	/**
	 * 发送事件到队列
	 * @param event - 监控事件
	 */
	public push(event: MonitorEvent): void {
		// 队列满时移除最旧的消息
		if (this.queue.length >= this.maxQueueSize) {
			this.queue.shift()
		}

		// Worker 不可用时加入内存队列
		if (!this.worker) {
			this.queue.push(event)
			return
		}

		// 发送到 Worker
		this.worker.postMessage({
			type: "event",
			payload: event,
		})
	}

	/**
	 * 刷新队列
	 * @description 强制将队列中的数据立即上报
	 */
	public flush(): void {
		if (this.worker) {
			this.worker.postMessage({
				type: "flush",
			})
		} else {
			this.flushQueueImmediate()
		}
	}

	/**
	 * 销毁队列
	 * @description 清理资源，终止 Worker
	 */
	public destroy(): void {
		this.flush()

		if (this.worker) {
			this.worker.postMessage({ type: "destroy" })
			this.worker.terminate()
			this.worker = null
		}

		if (this.flushTimer) {
			clearInterval(this.flushTimer)
			this.flushTimer = null
		}
	}
}
