/**
 * @fileoverview 回放数据处理模块
 * @description 处理用户行为回放数据，包括压缩和采样
 */

import { logger } from "../../shared/logger";
import { STORAGE_LIMITS } from "../storage/schema";

/**
 * 回放处理器类
 * @description 处理回放数据，优化存储和传输
 */
export class ReplayProcessor {
	/**
	 * 处理回放数据
	 * @param event - 原始事件数据
	 * @returns 处理后的数据
	 */
	public process(event: Record<string, unknown>): Record<string, unknown> {
		const data = event.data as Record<string, unknown>;

		if (!data || !data.records) {
			return event;
		}

		const records = data.records as Array<Record<string, unknown>>;

		// 采样处理
		const sampledRecords = this.sampleRecords(records);

		// 压缩记录
		const compressedRecords = this.compressRecords(sampledRecords);

		// 检查大小
		const size = JSON.stringify(compressedRecords).length;
		if (size > STORAGE_LIMITS.MAX_EVENT_SIZE * 5) {
			logger.warn(`回放数据过大 (${size} bytes)，将进一步压缩`);
			return this.createCompressedReplay(event, compressedRecords);
		}

		return {
			...event,
			data: {
				...data,
				records: compressedRecords,
				originalCount: records.length,
				sampledCount: compressedRecords.length,
				compressionRatio: records.length / compressedRecords.length,
			},
		};
	}

	/**
	 * 采样记录
	 * @param records - 原始记录
	 * @returns 采样后的记录
	 */
	private sampleRecords(
		records: Array<Record<string, unknown>>,
	): Array<Record<string, unknown>> {
		if (records.length <= 100) {
			return records;
		}

		// 保留关键事件（点击、输入等）
		const criticalTypes = ["click", "input", "submit", "navigate"];
		const criticalRecords = records.filter((r) =>
			criticalTypes.includes(r.type as string),
		);

		// 对鼠标移动进行采样
		const mouseRecords = records.filter(
			(r) => r.type === "mouse" || r.type === "mousemove",
		);
		const sampledMouseRecords = this.sampleMouseRecords(mouseRecords);

		// 合并并排序
		const result = [...criticalRecords, ...sampledMouseRecords].sort(
			(a, b) => (a.timestamp as number) - (b.timestamp as number),
		);

		return result;
	}

	/**
	 * 采样鼠标记录
	 * @param records - 鼠标记录
	 * @returns 采样后的记录
	 */
	private sampleMouseRecords(
		records: Array<Record<string, unknown>>,
	): Array<Record<string, unknown>> {
		if (records.length <= 50) {
			return records;
		}

		// 保留起点、终点和关键转折点
		const sampled: Array<Record<string, unknown>> = [];
		let lastRecord: Record<string, unknown> | null = null;

		for (let i = 0; i < records.length; i++) {
			const record = records[i];

			// 始终保留第一个和最后一个
			if (i === 0 || i === records.length - 1) {
				sampled.push(record);
				lastRecord = record;
				continue;
			}

			// 计算与上一个保留点的距离
			if (lastRecord) {
				const dx =
					((record.x as number) || 0) - ((lastRecord.x as number) || 0);
				const dy =
					((record.y as number) || 0) - ((lastRecord.y as number) || 0);
				const distance = Math.sqrt(dx * dx + dy * dy);

				// 距离超过阈值才保留
				if (distance > 20) {
					sampled.push(record);
					lastRecord = record;
				}
			}
		}

		return sampled;
	}

	/**
	 * 压缩记录
	 * @param records - 记录数组
	 * @returns 压缩后的记录
	 */
	private compressRecords(
		records: Array<Record<string, unknown>>,
	): Array<Record<string, unknown>> {
		return records.map((record) => {
			// 移除不必要的字段
			const { id, ...compressed } = record;

			// 对数据字段进行简化
			if (compressed.data && typeof compressed.data === "object") {
				const data = compressed.data as Record<string, unknown>;
				compressed.data = this.simplifyData(data);
			}

			return compressed;
		});
	}

	/**
	 * 简化数据对象
	 * @param data - 原始数据
	 * @returns 简化后的数据
	 */
	private simplifyData(data: Record<string, unknown>): Record<string, unknown> {
		const simplified: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(data)) {
			// 跳过空值
			if (value === null || value === undefined) {
				continue;
			}

			// 限制字符串长度
			if (typeof value === "string" && value.length > 100) {
				simplified[key] = value.substring(0, 100) + "...";
				continue;
			}

			// 限制数组长度
			if (Array.isArray(value) && value.length > 10) {
				simplified[key] = value.slice(0, 10);
				simplified[`${key}_truncated`] = true;
				continue;
			}

			simplified[key] = value;
		}

		return simplified;
	}

	/**
	 * 创建高度压缩的回放数据
	 * @param event - 原始事件
	 * @param records - 记录数组
	 * @returns 压缩后的事件
	 */
	private createCompressedReplay(
		event: Record<string, unknown>,
		records: Array<Record<string, unknown>>,
	): Record<string, unknown> {
		const data = event.data as Record<string, unknown>;

		// 只保留关键事件
		const criticalRecords = records.filter((r) => {
			const type = r.type as string;
			return ["click", "input", "submit", "navigate", "error"].includes(type);
		});

		return {
			...event,
			data: {
				...data,
				records: criticalRecords,
				originalCount: (data.records as Array<unknown>).length,
				sampledCount: criticalRecords.length,
				heavilyCompressed: true,
			},
		};
	}
}
