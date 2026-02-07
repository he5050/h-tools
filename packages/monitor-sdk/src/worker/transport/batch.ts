/**
 * @fileoverview 批量数据传输模块
 * @description 批量发送事件数据到服务器，支持重试和压缩
 */

import { logger } from "../../shared/logger";
import { BeaconTransport } from "./beacon";

/**
 * 批量传输配置接口
 */
interface BatchTransportConfig {
	/** 数据接收地址 */
	dsn: string;
	/** 批量大小 */
	batchSize: number;
	/** 刷新间隔（毫秒） */
	flushInterval: number;
	/** 最大重试次数 */
	maxRetries: number;
	/** 应用 ID */
	appId: string;
	/** 是否启用压缩 */
	enableCompression: boolean;
	/** 发送前回调 */
	onBeforeSend?: (events: Array<Record<string, unknown>>) => Promise<Array<Record<string, unknown>>>;
	/** 发送成功回调 */
	onSuccess?: (events: Array<Record<string, unknown>>) => Promise<void>;
}

/**
 * 批量传输状态
 */
enum TransportState {
	/** 空闲 */
	IDLE = "idle",
	/** 发送中 */
	SENDING = "sending",
	/** 已停止 */
	STOPPED = "stopped",
}

/**
 * 批量传输类
 * @description 管理事件的批量发送，包含重试机制和错误处理
 */
export class BatchTransport {
	/** 配置 */
	private config: BatchTransportConfig | null = null;
	/** 定时器 ID */
	private timerId: ReturnType<typeof setInterval> | null = null;
	/** 当前状态 */
	private state = TransportState.IDLE;
	/** 重试次数 */
	private retryCount = 0;
	/** Beacon 传输实例 */
	private beaconTransport: BeaconTransport;

	/**
	 * 构造函数
	 */
	constructor() {
		this.beaconTransport = new BeaconTransport();
	}

	/**
	 * 初始化传输模块
	 * @param config - 传输配置
	 */
	public init(config: BatchTransportConfig): void {
		this.config = config;
		this.beaconTransport.init(config.dsn, config.appId);
		logger.info("批量传输模块已初始化");
	}

	/**
	 * 启动定时发送
	 */
	public start(): void {
		if (!this.config || this.timerId) return;

		this.timerId = setInterval(() => {
			this.flush();
		}, this.config.flushInterval);

		logger.info("批量传输已启动");
	}

	/**
	 * 停止定时发送
	 */
	public stop(): void {
		if (this.timerId) {
			clearInterval(this.timerId);
			this.timerId = null;
		}
		this.state = TransportState.STOPPED;
		logger.info("批量传输已停止");
	}

	/**
	 * 立即刷新发送
	 * @description 立即发送所有待发送的事件
	 */
	public async flush(): Promise<void> {
		if (!this.config || this.state === TransportState.SENDING) return;

		this.state = TransportState.SENDING;

		try {
			// 获取待发送的事件
			let events: Array<Record<string, unknown>> = [];
			if (this.config.onBeforeSend) {
				events = await this.config.onBeforeSend(events);
			}

			if (events.length === 0) {
				this.state = TransportState.IDLE;
				return;
			}

			// 分批发送
			const batches = this.createBatches(events, this.config.batchSize);

			for (const batch of batches) {
				await this.sendBatch(batch);
			}

			// 发送成功回调
			if (this.config.onSuccess) {
				await this.config.onSuccess(events);
			}

			this.retryCount = 0;
			this.state = TransportState.IDLE;
		} catch (error) {
			logger.error("批量发送失败:", error);
			await this.handleError(error);
		}
	}

	/**
	 * 发送单批数据
	 * @param batch - 批次数据
	 */
	private async sendBatch(batch: Array<Record<string, unknown>>): Promise<void> {
		if (!this.config) return;

		const payload = {
			appId: this.config.appId,
			timestamp: Date.now(),
			events: batch,
		};

		const body = this.config.enableCompression
			? await this.compressData(JSON.stringify(payload))
			: JSON.stringify(payload);

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.config.enableCompression) {
			headers["Content-Encoding"] = "gzip";
		}

		const response = await fetch(this.config.dsn, {
			method: "POST",
			headers,
			body,
			keepalive: true,
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
	}

	/**
	 * 处理发送错误
	 * @param error - 错误对象
	 */
	private async handleError(error: unknown): Promise<void> {
		if (!this.config) return;

		this.retryCount++;

		if (this.retryCount < this.config.maxRetries) {
			// 指数退避重试
			const delay = Math.min(1000 * 2 ** this.retryCount, 30000);
			logger.warn(`将在 ${delay}ms 后重试 (${this.retryCount}/${this.config.maxRetries})`);

			setTimeout(() => {
				this.state = TransportState.IDLE;
				this.flush();
			}, delay);
		} else {
			logger.error("达到最大重试次数，放弃发送");
			this.retryCount = 0;
			this.state = TransportState.IDLE;
		}
	}

	/**
	 * 创建批次
	 * @param events - 事件数组
	 * @param batchSize - 批次大小
	 * @returns 批次数组
	 */
	private createBatches(
		events: Array<Record<string, unknown>>,
		batchSize: number,
	): Array<Array<Record<string, unknown>>> {
		const batches: Array<Array<Record<string, unknown>>> = [];
		for (let i = 0; i < events.length; i += batchSize) {
			batches.push(events.slice(i, i + batchSize));
		}
		return batches;
	}

	/**
	 * 压缩数据
	 * @param data - 原始数据
	 * @returns 压缩后的数据
	 */
	private async compressData(data: string): Promise<Blob> {
		// 使用 CompressionStream API 进行压缩
		if ("CompressionStream" in self) {
			const stream = new Blob([data]).stream();
			const compressedStream = stream.pipeThrough(
				new CompressionStream("gzip"),
			);
			return new Response(compressedStream).blob();
		}

		// 如果不支持压缩，返回原始数据
		return new Blob([data]);
	}

	/**
	 * 使用 Beacon API 发送（用于页面卸载时）
	 * @param events - 事件数组
	 * @returns 是否发送成功
	 */
	public sendBeacon(events: Array<Record<string, unknown>>): boolean {
		return this.beaconTransport.send(events);
	}
}
