/**
 * LRU cache for resolved audio URLs.
 *
 * Key:   videoId (string)
 * Value: audio URL (string)
 * TTL:   10 minutes
 * Max:   1000 entries
 */

const { LRUCache } = require('lru-cache');

const cache = new LRUCache({
  max: 1000,
  ttl: 10 * 60 * 1000, // 10 minutes
});

module.exports = {
  get:  (key) => cache.get(key),
  set:  (key, value) => cache.set(key, value),
  size: () => cache.size,
};
