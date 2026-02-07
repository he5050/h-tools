/**
 * @fileoverview 会话管理模块
 * @description 管理用户会话生命周期，包括 Session ID 生成/恢复、页面信息获取
 */

import { PageInfo } from '../shared/types';
import { generateId, safeGetLocalStorage, safeSetLocalStorage } from '../shared/utils';

/**
 * 会话管理器类
 * @description 负责管理用户会话标识和页面上下文信息
 */
export class SessionManager {
  /** 当前会话 ID */
  private sessionId: string;
  /** localStorage 中存储 Session ID 的键名 */
  private readonly SESSION_KEY = 'monitor_session_id';

  /**
   * 创建会话管理器实例
   * @description 自动获取或生成 Session ID
   */
  constructor() {
    this.sessionId = this.getOrGenerateSessionId();
  }

  /**
   * 获取或生成 Session ID
   * @returns Session ID 字符串
   * @description 优先从 localStorage 恢复，不存在则生成新的
   */
  private getOrGenerateSessionId(): string {
    // 尝试从 localStorage 恢复已有的 Session ID（安全读取，隐私模式下不会抛异常）
    const existingId = safeGetLocalStorage<string>(this.SESSION_KEY, '');
    if (existingId) {
      return existingId;
    }

    // 生成新的 Session ID
    const newId = generateId();
    safeSetLocalStorage(this.SESSION_KEY, newId);
    return newId;
  }

  /**
   * 获取当前 Session ID
   * @returns 当前会话 ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 获取页面信息
   * @returns 页面信息对象
   * @description 包含 URL、路由、标题、来源页面等信息
   */
  public getPageInfo(): PageInfo {
    return {
      // 完整 URL
      url: window.location.href,
      // 路由路径
      route: window.location.pathname,
      // 页面标题
      title: document.title,
      // 来源页面
      referrer: document.referrer,
    };
  }

  /**
   * 重置 Session ID
   * @description 生成新的 Session ID，用于用户重新登录等场景
   */
  public resetSession(): void {
    const newId = generateId();
    safeSetLocalStorage(this.SESSION_KEY, newId);
    this.sessionId = newId;
  }
}
