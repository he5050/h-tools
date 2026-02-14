import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SnapshotManager } from './snapshot';

// Mock全局对象
const mockLocation = {
  href: 'https://example.com/test',
};

const mockDocument = {
  title: 'Test Page',
  documentElement: {
    tagName: 'HTML',
    cloneNode: vi.fn(() => ({
      tagName: 'HTML',
      attributes: [],
      appendChild: vi.fn(),
      outerHTML: '<html></html>',
      children: [],
    })),
    children: [],
  },
};

const mockWindow = {
  innerWidth: 1920,
  innerHeight: 1080,
};

const mockDOMParser = {
  parseFromString: vi.fn(() => ({
    body: {
      firstElementChild: null,
    },
  })),
};

vi.spyOn(global, 'location', 'get').mockReturnValue(mockLocation as any);
vi.spyOn(global, 'document', 'get').mockReturnValue(mockDocument as any);
vi.spyOn(global, 'window', 'get').mockReturnValue(mockWindow as any);
vi.spyOn(global, 'DOMParser', 'get').mockImplementation(() => mockDOMParser as any);
vi.mock('../shared/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

describe('SnapshotManager', () => {
  let snapshotManager: SnapshotManager;

  beforeEach(() => {
    vi.clearAllMocks();
    snapshotManager = new SnapshotManager();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const defaultManager = new SnapshotManager();
      expect(defaultManager).toBeDefined();
    });

    it('应该使用自定义配置创建实例', () => {
      const customConfig = {
        includeInputValues: false,
        maskSensitiveFields: false,
        maxDepth: 5,
      };
      const customManager = new SnapshotManager(customConfig);
      expect(customManager).toBeDefined();
    });
  });

  describe('capture方法', () => {
    it('应该返回完整的快照数据', () => {
      const snapshot = snapshotManager.capture();
      expect(snapshot).toEqual({
        url: mockLocation.href,
        title: mockDocument.title,
        viewport: {
          width: mockWindow.innerWidth,
          height: mockWindow.innerHeight,
        },
        dom: expect.any(String),
        timestamp: expect.any(Number),
      });
    });

    it('应该调用logger.debug', () => {
      const { logger } = require('../shared/logger');
      snapshotManager.capture();
      expect(logger.debug).toHaveBeenCalledWith('页面快照已捕获');
    });
  });

  describe('captureLite方法', () => {
    it('应该返回简化的快照数据', () => {
      const liteSnapshot = snapshotManager.captureLite();
      expect(liteSnapshot).toEqual({
        url: mockLocation.href,
        title: mockDocument.title,
        viewport: {
          width: mockWindow.innerWidth,
          height: mockWindow.innerHeight,
        },
        timestamp: expect.any(Number),
      });
    });
  });

  describe('DOM序列化', () => {
    it('应该处理最大深度限制', () => {
      const deepManager = new SnapshotManager({ maxDepth: 2 });
      const mockDeepElement = {
        tagName: 'DIV',
        cloneNode: vi.fn(() => ({
          tagName: 'DIV',
          attributes: [],
          appendChild: vi.fn(),
          outerHTML: '<div></div>',
          children: [],
        })),
        children: [],
      };

      const result = (deepManager as any).serializeDOM(mockDeepElement, 3);
      expect(result).toBe('');
    });

    it('应该跳过脚本标签', () => {
      const scriptElement = {
        tagName: 'SCRIPT',
        cloneNode: vi.fn(),
        children: [],
      };

      const result = (snapshotManager as any).serializeDOM(scriptElement, 0);
      expect(result).toBe('');
    });

    it('应该处理输入框值', () => {
      const inputElement = {
        tagName: 'INPUT',
        cloneNode: vi.fn(() => ({
          tagName: 'INPUT',
          attributes: [],
          appendChild: vi.fn(),
          outerHTML: '<input>',
          children: [],
          value: '',
          setAttribute: vi.fn(),
        })),
        children: [],
        value: 'test value',
        type: 'text',
        name: 'username',
        getAttribute: vi.fn(),
      };

      const result = (snapshotManager as any).serializeDOM(inputElement, 0);
      expect(result).toContain('<input');
    });

    it('应该处理敏感字段', () => {
      const passwordElement = {
        tagName: 'INPUT',
        cloneNode: vi.fn(() => ({
          tagName: 'INPUT',
          attributes: [],
          appendChild: vi.fn(),
          outerHTML: '<input>',
          children: [],
          value: '',
          setAttribute: vi.fn(),
        })),
        children: [],
        value: 'secret123',
        type: 'password',
        name: 'password',
        getAttribute: vi.fn(),
      };

      const result = (snapshotManager as any).serializeDOM(passwordElement, 0);
      expect(result).toContain('<input');
    });

    it('应该处理textarea元素', () => {
      const textareaElement = {
        tagName: 'TEXTAREA',
        cloneNode: vi.fn(() => ({
          tagName: 'TEXTAREA',
          attributes: [],
          appendChild: vi.fn(),
          outerHTML: '<textarea></textarea>',
          children: [],
          value: '',
        })),
        children: [],
        value: 'textarea value',
        name: 'description',
        getAttribute: vi.fn(),
      };

      const result = (snapshotManager as any).serializeDOM(textareaElement, 0);
      expect(result).toContain('<textarea');
    });

    it('应该处理select元素', () => {
      const selectElement = {
        tagName: 'SELECT',
        cloneNode: vi.fn(() => ({
          tagName: 'SELECT',
          attributes: [],
          appendChild: vi.fn(),
          outerHTML: '<select></select>',
          children: [],
          value: '',
        })),
        children: [],
        value: 'option1',
      };

      const result = (snapshotManager as any).serializeDOM(selectElement, 0);
      expect(result).toContain('<select');
    });

    it('应该处理子元素', () => {
      const parentElement = {
        tagName: 'DIV',
        cloneNode: vi.fn(() => ({
          tagName: 'DIV',
          attributes: [],
          appendChild: vi.fn(),
          outerHTML: '<div></div>',
          children: [],
        })),
        children: [
          {
            tagName: 'SPAN',
            cloneNode: vi.fn(() => ({
              tagName: 'SPAN',
              attributes: [],
              appendChild: vi.fn(),
              outerHTML: '<span></span>',
              children: [],
            })),
            children: [],
          },
        ],
      };

      const result = (snapshotManager as any).serializeDOM(parentElement, 0);
      expect(result).toContain('<div');
    });
  });

  describe('事件属性处理', () => {
    it('应该移除事件属性', () => {
      const elementWithEvents = {
        tagName: 'BUTTON',
        cloneNode: vi.fn(() => ({
          tagName: 'BUTTON',
          attributes: [
            { name: 'onclick', value: 'alert(1)' },
            { name: 'id', value: 'btn' },
          ],
          appendChild: vi.fn(),
          outerHTML: '<button onclick="alert(1)" id="btn"></button>',
          children: [],
          removeAttribute: vi.fn(),
        })),
        children: [],
      };

      const result = (snapshotManager as any).serializeDOM(elementWithEvents, 0);
      expect(result).toContain('<button');
    });
  });

  describe('敏感字段检测', () => {
    it('应该检测密码类型输入框', () => {
      const passwordInput = {
        tagName: 'INPUT',
        type: 'password',
        name: '',
        getAttribute: vi.fn(),
      };

      const result = (snapshotManager as any).isSensitiveField(passwordInput);
      expect(result).toBe(true);
    });

    it('应该检测敏感名称的输入框', () => {
      const sensitiveInput = {
        tagName: 'INPUT',
        type: 'text',
        name: 'credit-card',
        getAttribute: vi.fn(),
      };

      const result = (snapshotManager as any).isSensitiveField(sensitiveInput);
      expect(result).toBe(true);
    });

    it('应该检测非敏感字段', () => {
      const normalInput = {
        tagName: 'INPUT',
        type: 'text',
        name: 'username',
        getAttribute: vi.fn(),
      };

      const result = (snapshotManager as any).isSensitiveField(normalInput);
      expect(result).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理空DOM', () => {
      const result = snapshotManager.capture();
      expect(result.dom).toBeDefined();
    });

    it('应该处理无子元素的情况', () => {
      const emptyElement = {
        tagName: 'DIV',
        cloneNode: vi.fn(() => ({
          tagName: 'DIV',
          attributes: [],
          appendChild: vi.fn(),
          outerHTML: '<div></div>',
          children: [],
        })),
        children: [],
      };

      const result = (snapshotManager as any).serializeDOM(emptyElement, 0);
      expect(result).toBe('<div></div>');
    });

    it('应该处理DOMParser解析失败的情况', () => {
      mockDOMParser.parseFromString.mockImplementation(() => {
        throw new Error('Parse failed');
      });

      const elementWithChildren = {
        tagName: 'DIV',
        cloneNode: vi.fn(() => ({
          tagName: 'DIV',
          attributes: [],
          appendChild: vi.fn(),
          outerHTML: '<div></div>',
          children: [],
        })),
        children: [
          {
            tagName: 'SPAN',
            cloneNode: vi.fn(() => ({
              tagName: 'SPAN',
              attributes: [],
              appendChild: vi.fn(),
              outerHTML: '<span></span>',
              children: [],
            })),
            children: [],
          },
        ],
      };

      const result = (snapshotManager as any).serializeDOM(elementWithChildren, 0);
      expect(result).toBe('<div></div>');
    });
  });
});
