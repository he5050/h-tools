/**
 * @fileoverview 页面快照模块
 * @description 捕获页面 DOM 快照，用于错误发生时的上下文记录
 */

import { logger } from "../shared/logger";

/**
 * 快照配置接口
 */
interface SnapshotConfig {
	/** 是否包含输入框的值 */
	includeInputValues: boolean;
	/** 是否隐藏敏感信息（如密码） */
	maskSensitiveFields: boolean;
	/** 最大 DOM 深度 */
	maxDepth: number;
}

/**
 * 快照数据接口
 */
interface SnapshotData {
	/** 页面 URL */
	url: string;
	/** 页面标题 */
	title: string;
	/** 视口尺寸 */
	viewport: { width: number; height: number };
	/** DOM 快照 */
	dom: string;
	/** 时间戳 */
	timestamp: number;
}

/**
 * 页面快照管理器类
 * @description 负责捕获和序列化页面 DOM 状态
 */
export class SnapshotManager {
	private config: SnapshotConfig;

	/**
	 * 构造函数
	 * @param config - 快照配置
	 */
	constructor(config: Partial<SnapshotConfig> = {}) {
		this.config = {
			includeInputValues: true,
			maskSensitiveFields: true,
			maxDepth: 10,
			...config,
		};
	}

	/**
	 * 捕获页面快照
	 * @returns 快照数据对象
	 */
	public capture(): SnapshotData {
		const snapshot: SnapshotData = {
			url: location.href,
			title: document.title,
			viewport: {
				width: window.innerWidth,
				height: window.innerHeight,
			},
			dom: this.serializeDOM(document.documentElement, 0),
			timestamp: Date.now(),
		};

		logger.debug("页面快照已捕获");
		return snapshot;
	}

	/**
	 * 序列化 DOM 元素
	 * @param element - DOM 元素
	 * @param depth - 当前深度
	 * @returns 序列化后的 HTML 字符串
	 */
	private serializeDOM(element: Element, depth: number): string {
		// 限制深度
		if (depth > this.config.maxDepth) {
			return "";
		}

		// 跳过脚本标签，防止 XSS 风险
		const tagName = element.tagName.toUpperCase();
		if (tagName === "SCRIPT" || tagName === "NOSCRIPT") {
			return "";
		}

		// 克隆元素以避免修改原始 DOM
		const clone = element.cloneNode(false) as Element;

		// 移除可能导致 XSS 的事件属性
		this.removeEventAttributes(clone);

		// 处理输入框值
		if (this.config.includeInputValues && element instanceof HTMLInputElement) {
			const input = element as HTMLInputElement;
			const cloneInput = clone as HTMLInputElement;

			// 敏感字段处理
			if (this.config.maskSensitiveFields && this.isSensitiveField(input)) {
				cloneInput.value = "***";
			} else if (input.type !== "file") {
				cloneInput.value = input.value;
			}

			cloneInput.setAttribute("value", cloneInput.value);
		}

		// 处理 textarea
		if (element instanceof HTMLTextAreaElement) {
			const textarea = element as HTMLTextAreaElement;
			const cloneTextarea = clone as HTMLTextAreaElement;

			if (this.config.maskSensitiveFields && this.isSensitiveField(textarea)) {
				cloneTextarea.value = "***";
			} else {
				cloneTextarea.value = textarea.value;
			}
		}

		// 处理 select
		if (element instanceof HTMLSelectElement) {
			const select = element as HTMLSelectElement;
			const cloneSelect = clone as HTMLSelectElement;
			cloneSelect.value = select.value;
		}

		// 递归处理子元素，使用 DOM API 而非 innerHTML 拼接
		const children = element.children;
		const childrenHtml: string[] = [];
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const serializedChild = this.serializeDOM(child, depth + 1);
			if (serializedChild) {
				childrenHtml.push(serializedChild);
			}
		}

		// 如果有子元素，将其插入到克隆元素中
		if (childrenHtml.length > 0) {
			// 使用 DOMParser 安全地解析子元素 HTML
			const parser = new DOMParser();
			for (const childHtml of childrenHtml) {
				try {
					const doc = parser.parseFromString(childHtml, "text/html");
					// 使用 firstElementChild 确保获取元素节点（而非文本节点）
					const parsedChild = doc.body.firstElementChild;
					if (parsedChild) {
						clone.appendChild(parsedChild.cloneNode(true));
					}
				} catch {
					// 解析失败则跳过该子元素
				}
			}
		}

		return clone.outerHTML;
	}

	/**
	 * 移除元素上的事件属性，防止 XSS
	 * @param element - DOM 元素
	 */
	private removeEventAttributes(element: Element): void {
		const attributes = element.attributes;
		if (!attributes) return;
		const toRemove: string[] = [];

		for (let i = 0; i < attributes.length; i++) {
			const attrName = attributes[i].name.toLowerCase();
			// 移除所有 on* 事件属性和 javascript: 协议
			if (attrName.startsWith("on") || attributes[i].value.toLowerCase().includes("javascript:")) {
				toRemove.push(attributes[i].name);
			}
		}

		for (const attr of toRemove) {
			element.removeAttribute(attr);
		}
	}

	/**
	 * 判断是否为敏感字段
	 * @param element - 表单元素
	 * @returns 是否为敏感字段
	 */
	private isSensitiveField(element: HTMLInputElement | HTMLTextAreaElement): boolean {
		const sensitiveTypes = ["password", "credit-card", "cvv"];
		const sensitiveNames = ["password", "passwd", "pwd", "credit-card", "cvv", "ssn"];

		// 检查 type 属性
		if (element instanceof HTMLInputElement) {
			if (sensitiveTypes.includes(element.type.toLowerCase())) {
				return true;
			}
		}

		// 检查 name 属性
		const name = element.name?.toLowerCase() || "";
		if (sensitiveNames.some((n) => name.includes(n))) {
			return true;
		}

		// 检查 autocomplete 属性
		const autocomplete = element.getAttribute("autocomplete")?.toLowerCase() || "";
		if (sensitiveTypes.some((t) => autocomplete.includes(t))) {
			return true;
		}

		return false;
	}

	/**
	 * 获取简化版快照（仅包含关键信息）
	 * @returns 简化快照数据
	 */
	public captureLite(): Pick<SnapshotData, "url" | "title" | "viewport" | "timestamp"> {
		return {
			url: location.href,
			title: document.title,
			viewport: {
				width: window.innerWidth,
				height: window.innerHeight,
			},
			timestamp: Date.now(),
		};
	}
}
