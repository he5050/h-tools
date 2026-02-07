import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init, destroy, getMonitor } from '../src/core/init';
import { generateId, getTimestamp } from '../src/shared/utils';
import { EventType } from '../src/shared/types';

describe('Monitor SDK Smoke Tests', () => {
  beforeEach(() => {
    // Reset singleton
    destroy();
  });

  afterEach(() => {
    destroy();
    vi.restoreAllMocks();
  });

  describe('SDK Initialization', () => {
    it('should initialize with minimal config', () => {
      const monitor = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      expect(monitor).toBeDefined();
      expect(getMonitor()).toBe(monitor);
    });

    it('should not create multiple instances', () => {
      const monitor1 = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      const monitor2 = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      expect(monitor1).toBe(monitor2);
    });

    it('should destroy and recreate', () => {
      const monitor1 = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      destroy();

      const monitor2 = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      expect(monitor1).not.toBe(monitor2);
    });
  });

  describe('Utility Functions', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should return valid timestamp', () => {
      const ts = getTimestamp();
      expect(ts).toBeGreaterThan(0);
      expect(typeof ts).toBe('number');
    });
  });

  describe('Event Types', () => {
    it('should have all required event types', () => {
      expect(EventType.JS_ERROR).toBe('js_error');
      expect(EventType.PROMISE_ERROR).toBe('promise_error');
      expect(EventType.RESOURCE_ERROR).toBe('resource_error');
      expect(EventType.LCP).toBe('lcp');
      expect(EventType.FID).toBe('fid');
      expect(EventType.CLS).toBe('cls');
      expect(EventType.PV).toBe('pv');
      expect(EventType.UV).toBe('uv');
      expect(EventType.CLICK).toBe('click');
      expect(EventType.XHR).toBe('xhr');
      expect(EventType.FETCH).toBe('fetch');
      expect(EventType.REPLAY).toBe('replay');
      expect(EventType.SNAPSHOT).toBe('snapshot');
    });
  });

  describe('Monitor Methods', () => {
    it('should expose track method', () => {
      const monitor = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      expect(typeof monitor.track).toBe('function');
    });

    it('should expose captureException method', () => {
      const monitor = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      expect(typeof monitor.captureException).toBe('function');
    });

    it('should expose captureMessage method', () => {
      const monitor = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      expect(typeof monitor.captureMessage).toBe('function');
    });

    it('should expose setUser method', () => {
      const monitor = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      expect(typeof monitor.setUser).toBe('function');
    });

    it('should expose flush method', () => {
      const monitor = init({
        dsn: 'https://test.example.com/api/v1/report',
        appId: 'test-app',
      });

      expect(typeof monitor.flush).toBe('function');
    });
  });
});
