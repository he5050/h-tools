import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorMonitor } from '../src/core/hook/error';
import { EventType, ErrorEvent, PageInfo } from '../src/shared/types';

describe('Error Monitor', () => {
  const mockHandler = vi.fn();
  const mockSessionId = 'test-session-123';
  const mockPageInfo: PageInfo = {
    url: 'https://test.example.com',
    route: '/test',
    title: 'Test Page',
    referrer: '',
  };

  let errorMonitor: ErrorMonitor;

  beforeEach(() => {
    mockHandler.mockClear();
    errorMonitor = new ErrorMonitor(mockHandler, mockSessionId, mockPageInfo);
    errorMonitor.init();
  });

  afterEach(() => {
    errorMonitor.destroy();
    vi.restoreAllMocks();
  });

  describe('JS Error Capture', () => {
    it('should capture JS errors', () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: new Error('Test error'),
      });

      window.dispatchEvent(errorEvent);

      expect(mockHandler).toHaveBeenCalled();
      const capturedEvent = mockHandler.mock.calls[0][0] as ErrorEvent;
      expect(capturedEvent.type).toBe(EventType.JS_ERROR);
      expect(capturedEvent.message).toBe('Test error');
      expect(capturedEvent.sessionId).toBe(mockSessionId);
    });

    it('should ignore chrome extension errors', () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Extension error',
        filename: 'chrome-extension://abc/test.js',
      });

      window.dispatchEvent(errorEvent);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Promise Error Capture', () => {
    it('should capture unhandled promise rejections', () => {
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('Promise rejected'),
        promise: Promise.reject(new Error('Promise rejected')),
      });

      window.dispatchEvent(rejectionEvent);

      expect(mockHandler).toHaveBeenCalled();
      const capturedEvent = mockHandler.mock.calls[0][0] as ErrorEvent;
      expect(capturedEvent.type).toBe(EventType.PROMISE_ERROR);
    });

    it('should handle string rejections', () => {
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        reason: 'String rejection',
        promise: Promise.reject('String rejection'),
      });

      window.dispatchEvent(rejectionEvent);

      expect(mockHandler).toHaveBeenCalled();
      const capturedEvent = mockHandler.mock.calls[0][0] as ErrorEvent;
      expect(capturedEvent.message).toBe('String rejection');
    });
  });

  describe('Manual Capture', () => {
    it('should capture exceptions manually', () => {
      const error = new Error('Manual error');
      errorMonitor.captureException(error, { extra: 'data' });

      expect(mockHandler).toHaveBeenCalled();
      const capturedEvent = mockHandler.mock.calls[0][0] as ErrorEvent;
      expect(capturedEvent.type).toBe(EventType.JS_ERROR);
      expect(capturedEvent.message).toBe('Manual error');
      expect(capturedEvent.context).toEqual({ extra: 'data' });
    });

    it('should capture messages', () => {
      errorMonitor.captureMessage('Custom message', 'warning');

      expect(mockHandler).toHaveBeenCalled();
      const capturedEvent = mockHandler.mock.calls[0][0] as ErrorEvent;
      expect(capturedEvent.message).toBe('Custom message');
      expect(capturedEvent.errorType).toBe('warning');
    });
  });
});
