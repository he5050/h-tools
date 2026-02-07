/**
 * @fileoverview IndexedDB 存储模块
 * @description 使用 IndexedDB 进行客户端数据持久化存储
 */

import { DB_NAME, DB_VERSION, STORE_NAME, TTL_CONFIG } from "./schema";
import { logger } from "../../shared/logger";

/**
 * IndexedDB 存储类
 * @description 封装 IndexedDB 操作，提供事件存储、查询和清理功能
 */
export class IndexedDBStorage {
	/** 数据库实例 */
	private db: IDBDatabase | null = null;
	/** 数据库名称 */
	private readonly dbName: string;
	/** 数据库版本 */
	private readonly dbVersion: number;
	/** 存储对象名称 */
	private readonly storeName: string;

	/**
	 * 构造函数
	 * @param dbName - 数据库名称
	 * @param dbVersion - 数据库版本
	 * @param storeName - 存储对象名称
	 */
	constructor(
		dbName = DB_NAME,
		dbVersion = DB_VERSION,
		storeName = STORE_NAME,
	) {
		this.dbName = dbName;
		this.dbVersion = dbVersion;
		this.storeName = storeName;
	}

	/**
	 * 初始化数据库
	 * @returns Promise 对象
	 */
	public async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				logger.error("IndexedDB 打开失败:", request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.db = request.result;
				logger.info("IndexedDB 连接成功");
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// 创建事件存储对象
				if (!db.objectStoreNames.contains(this.storeName)) {
					const store = db.createObjectStore(this.storeName, {
						keyPath: "id",
						autoIncrement: true,
					});

					// 创建索引
					store.createIndex("timestamp", "timestamp", { unique: false });
					store.createIndex("type", "type", { unique: false });
					store.createIndex("expireAt", "expireAt", { unique: false });

					logger.info("IndexedDB 存储对象创建成功");
				}
			};
		});
	}

	/**
	 * 添加事件
	 * @param event - 事件数据
	 * @returns 事件 ID
	 */
	public async addEvent(event: Record<string, unknown>): Promise<number> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const transaction = this.db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);

			// 添加过期时间
			const eventWithTTL = {
				...event,
				expireAt: Date.now() + TTL_CONFIG.DEFAULT_EVENT_TTL,
			};

			const request = store.add(eventWithTTL);

			request.onsuccess = () => {
				resolve(request.result as number);
			};

			request.onerror = () => {
				logger.error("添加事件失败:", request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * 获取事件列表
	 * @param limit - 最大返回数量
	 * @returns 事件数组
	 */
	public async getEvents(limit = 50): Promise<Array<Record<string, unknown> & { id: number }>> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const transaction = this.db.transaction([this.storeName], "readonly");
			const store = transaction.objectStore(this.storeName);
			const request = store.openCursor();

			const events: Array<Record<string, unknown> & { id: number }> = [];

			request.onsuccess = () => {
				const cursor = request.result;
				if (cursor && events.length < limit) {
					events.push(cursor.value as Record<string, unknown> & { id: number });
					cursor.continue();
				} else {
					resolve(events);
				}
			};

			request.onerror = () => {
				logger.error("获取事件失败:", request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * 删除事件
	 * @param ids - 要删除的事件 ID 数组
	 */
	public async deleteEvents(ids: number[]): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const transaction = this.db.transaction([this.storeName], "readwrite");
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
					logger.error(`删除事件 ${id} 失败:`, request.error);
					reject(request.error);
				};
			});
		});
	}

	/**
	 * 清理过期数据
	 * @description 删除超过 TTL 的事件
	 */
	public async cleanup(): Promise<number> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const transaction = this.db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);
			const index = store.index("expireAt");

			const now = Date.now();
			const range = IDBKeyRange.upperBound(now);
			const request = index.openCursor(range);

			let deletedCount = 0;

			request.onsuccess = () => {
				const cursor = request.result;
				if (cursor) {
					store.delete(cursor.primaryKey);
					deletedCount++;
					cursor.continue();
				} else {
					logger.info(`清理完成，删除了 ${deletedCount} 条过期数据`);
					resolve(deletedCount);
				}
			};

			request.onerror = () => {
				logger.error("清理过期数据失败:", request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * 获取存储统计信息
	 * @returns 统计信息
	 */
	public async getStats(): Promise<{
		totalCount: number;
		oldestEvent: number | null;
		newestEvent: number | null;
	}> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const transaction = this.db.transaction([this.storeName], "readonly");
			const store = transaction.objectStore(this.storeName);
			const countRequest = store.count();

			countRequest.onsuccess = () => {
				const totalCount = countRequest.result;

				// 获取最早和最晚的事件时间
				const index = store.index("timestamp");
				const oldestRequest = index.openCursor();
				const newestRequest = index.openCursor(null, "prev");

				let oldestEvent: number | null = null;
				let newestEvent: number | null = null;
				let completed = 0;

				const checkComplete = () => {
					completed++;
					if (completed === 2) {
						resolve({ totalCount, oldestEvent, newestEvent });
					}
				};

				oldestRequest.onsuccess = () => {
					const cursor = oldestRequest.result;
					if (cursor) {
						oldestEvent = (cursor.value as { timestamp: number }).timestamp;
					}
					checkComplete();
				};

				newestRequest.onsuccess = () => {
					const cursor = newestRequest.result;
					if (cursor) {
						newestEvent = (cursor.value as { timestamp: number }).timestamp;
					}
					checkComplete();
				};

				oldestRequest.onerror = () => {
					checkComplete();
				};

				newestRequest.onerror = () => {
					checkComplete();
				};
			};

			countRequest.onerror = () => {
				reject(countRequest.error);
			};
		});
	}

	/**
	 * 关闭数据库连接
	 */
	public async close(): Promise<void> {
		if (this.db) {
			this.db.close();
			this.db = null;
			logger.info("IndexedDB 连接已关闭");
		}
	}
}
