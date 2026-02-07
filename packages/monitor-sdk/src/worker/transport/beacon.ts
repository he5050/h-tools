/**
 * @fileoverview Beacon API 传输模块
 * @description 使用 Beacon API 在页面卸载时发送数据
 */

import { logger } from "../../shared/logger";

/**
 * Beacon 传输类
 * @description 封装 Navigator.sendBeacon API，用于页面卸载时的数据发送
 */
export class BeaconTransport {
	/** 数据接收地址 */
	private dsn = "";
	/** 应用 ID */
	private appId = "";

	/**
	 * 初始化 Beacon 传输
	 * @param dsn - 数据接收地址
	 * @param appId - 应用 ID
	 */
	public init(dsn: string, appId: string): void {
		this.dsn = dsn;
		this.appId = appId;
		logger.info("Beacon 传输已初始化");
	}

	/**
	 * 发送数据
	 * @param events - 事件数组
	 * @returns 是否发送成功
	 */
	public send(events: Array<Record<string, unknown>>): boolean {
		if (!this.dsn || !navigator.sendBeacon) {
			logger.warn("Beacon API 不可用");
			return false;
		}

		try {
			const payload = {
				appId: this.appId,
				timestamp: Date.now(),
				events,
				// 标记为 beacon 发送
				sentBy: "beacon",
			};

			const blob = new Blob([JSON.stringify(payload)], {
				type: "application/json",
			});

			const success = navigator.sendBeacon(this.dsn, blob);

			if (success) {
				logger.debug(`Beacon 发送成功: ${events.length} 个事件`);
			} else {
				logger.warn("Beacon 发送失败");
			}

			return success;
		} catch (error) {
			logger.error("Beacon 发送异常:", error);
			return false;
		}
	}

	/**
	 * 检查 Beacon API 是否可用
	 * @returns 是否可用
	 */
	public static isSupported(): boolean {
		return typeof navigator !== "undefined" && "sendBeacon" in navigator;
	}
}
