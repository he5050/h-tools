/**
 * @fileoverview 快照数据处理模块
 * @description 处理页面快照数据，包括压缩和优化
 */

import { logger } from "../../shared/logger";
import { STORAGE_LIMITS } from "../storage/schema";

/**
 * 快照处理器类
 * @description 处理快照数据，优化存储大小
 */
export class SnapshotProcessor {
	/**
	 * 处理快照数据
	 * @param event - 原始事件数据
	 * @returns 处理后的数据
	 */
	public process(event: Record<string, unknown>): Record<string, unknown> {
		const data = event.data as Record<string, unknown>;

		if (!data || !data.snapshot) {
			return event;
		}

		const snapshot = data.snapshot as {
			dom?: string;
			url?: string;
			title?: string;
			viewport?: { width: number; height: number };
		};

		// 压缩 DOM 数据
		if (snapshot.dom) {
			snapshot.dom = this.compressDOM(snapshot.dom);
		}

		// 检查大小限制
		const size = JSON.stringify(snapshot).length;
		if (size > STORAGE_LIMITS.MAX_SNAPSHOT_SIZE) {
			logger.warn(`快照数据过大 (${size} bytes)，将使用简化版本`);
			return this.createLiteSnapshot(event, snapshot);
		}

		return {
			...event,
			data: {
				...data,
				snapshot,
				snapshotSize: size,
			},
		};
	}

	/**
	 * 压缩 DOM 字符串
	 * @param dom - DOM HTML 字符串
	 * @returns 压缩后的字符串
	 */
	private compressDOM(dom: string): string {
		return (
			dom
				// 移除注释
				.replace(/<!--[\s\S]*?-->/g, "")
				// 移除多余的空白
				.replace(/>\s+</g, "><")
				.replace(/\s{2,}/g, " ")
				// 移除空的 style 和 class 属性
				.replace(/\s(style|class)=""/g, "")
				// 移除 data- 属性（通常用于框架内部）
				.replace(/\sdata-[a-z-]+="[^"]*"/g, "")
				// 移除事件处理器属性
				.replace(/\son\w+="[^"]*"/g, "")
				// 移除 Vue/React 等框架的特殊属性
				.replace(/\s(v-|@|:|data-v-)[^=]*="[^"]*"/g, "")
				.trim()
		);
	}

	/**
	 * 创建简化版快照
	 * @param event - 原始事件
	 * @param snapshot - 原始快照
	 * @returns 简化后的事件
	 */
	private createLiteSnapshot(
		event: Record<string, unknown>,
		snapshot: Record<string, unknown>,
	): Record<string, unknown> {
		const data = event.data as Record<string, unknown>;

		return {
			...event,
			data: {
				...data,
				snapshot: {
					url: snapshot.url,
					title: snapshot.title,
					viewport: snapshot.viewport,
					// 不包含 DOM，只保留基本信息
					lite: true,
				},
				snapshotSize: 0,
				isLite: true,
			},
		};
	}

	/**
	 * 提取关键元素
	 * @param dom - DOM 字符串
	 * @returns 关键元素信息
	 */
	private extractKeyElements(dom: string): Array<{
		tag: string;
		id?: string;
		class?: string;
	}> {
		const elements: Array<{ tag: string; id?: string; class?: string }> = [];

		// 简单的正则提取，实际项目中可以使用 DOMParser
		const tagRegex = /<([a-z][a-z0-9]*)[^>]*>/gi;
		let match;

		while ((match = tagRegex.exec(dom)) !== null && elements.length < 50) {
			const tag = match[1];
			const attrs = match[0];

			// 提取 id
			const idMatch = attrs.match(/id="([^"]*)"/);
			const id = idMatch ? idMatch[1] : undefined;

			// 提取 class
			const classMatch = attrs.match(/class="([^"]*)"/);
			const className = classMatch ? classMatch[1] : undefined;

			elements.push({ tag, id, class: className });
		}

		return elements;
	}
}
