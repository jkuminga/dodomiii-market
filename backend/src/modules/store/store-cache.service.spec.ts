import { describe, expect, it, jest } from '@jest/globals';

import { StoreCacheService } from './store-cache.service';

describe('StoreCacheService', () => {
  it('returns cached values until ttl expires', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);
    const cache = new StoreCacheService();
    const factory = jest.fn<() => Promise<string>>().mockResolvedValue('first');

    await expect(cache.getOrSet('key', 1000, factory)).resolves.toBe('first');
    await expect(cache.getOrSet('key', 1000, factory)).resolves.toBe('first');
    expect(factory).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(2001);
    factory.mockResolvedValue('second');

    await expect(cache.getOrSet('key', 1000, factory)).resolves.toBe('second');
    expect(factory).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it('invalidates one key or every key under a prefix', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const cache = new StoreCacheService();

    cache.set('store:products:1', 'a', 1000);
    cache.set('store:products:2', 'b', 1000);
    cache.set('store:categories:1', 'c', 1000);

    cache.invalidate('store:products:1');
    expect(cache.get('store:products:1')).toBeNull();
    expect(cache.get('store:products:2')).toBe('b');

    cache.invalidateByPrefix('store:products:');
    expect(cache.get('store:products:2')).toBeNull();
    expect(cache.get('store:categories:1')).toBe('c');

    nowSpy.mockRestore();
  });
});
