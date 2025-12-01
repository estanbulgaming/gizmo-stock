import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, fetchWithRetry, createRetryFetch } from './retry';

describe('withRetry', () => {
  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP error! status: 500'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { baseDelay: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('HTTP error! status: 500'));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow('HTTP error! status: 500');

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should not retry non-retryable errors (4xx)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('HTTP error! status: 400'));

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('status: 400');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on network errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { baseDelay: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP error! status: 503'))
      .mockResolvedValueOnce('success');

    await withRetry(fn, { baseDelay: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      1,
      expect.any(Error),
      expect.any(Number)
    );
  });

  it('should respect abort signal', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      throw new Error('HTTP error! status: 500');
    });

    // Abort immediately
    controller.abort();

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelay: 10, signal: controller.signal })
    ).rejects.toThrow('Aborted');
  });

  it('should use exponential backoff', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP error! status: 500'))
      .mockRejectedValueOnce(new Error('HTTP error! status: 500'))
      .mockRejectedValueOnce(new Error('HTTP error! status: 500'))
      .mockResolvedValueOnce('success');

    await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 100,
      backoffMultiplier: 2,
      onRetry,
    });

    // Check that delays increase (with jitter, they should be roughly 100, 200, 400)
    const delays = onRetry.mock.calls.map(call => call[2]);
    expect(delays[0]).toBeGreaterThan(80);
    expect(delays[0]).toBeLessThan(120);
    expect(delays[1]).toBeGreaterThan(160);
    expect(delays[1]).toBeLessThan(240);
    expect(delays[2]).toBeGreaterThan(320);
    expect(delays[2]).toBeLessThan(480);
  });

  it('should cap delay at maxDelay', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP error! status: 500'))
      .mockRejectedValueOnce(new Error('HTTP error! status: 500'))
      .mockResolvedValueOnce('success');

    await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 500,
      maxDelay: 100,
      backoffMultiplier: 2,
      onRetry,
    });

    // All delays should be capped around maxDelay (with jitter)
    const delays = onRetry.mock.calls.map(call => call[2]);
    delays.forEach(delay => {
      expect(delay).toBeLessThanOrEqual(120); // maxDelay * 1.2 (jitter)
    });
  });

  it('should retry on custom status codes', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('HTTP error! status: 418'))
      .mockResolvedValueOnce('teapot');

    const result = await withRetry(fn, {
      baseDelay: 10,
      retryableStatuses: [418],
    });

    expect(result).toBe('teapot');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return response on success', async () => {
    const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'test' }) };
    vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

    const response = await fetchWithRetry('/api/test');

    expect(response).toBe(mockResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on 500 error', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    const response = await fetchWithRetry('/api/test', undefined, { baseDelay: 10 });

    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should pass init options to fetch', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    await fetchWithRetry('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(fetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

describe('createRetryFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create a fetch function with retry', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    const retryFetch = createRetryFetch({ baseDelay: 10, maxRetries: 2 });
    const response = await retryFetch('/api/test');

    expect(response.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
