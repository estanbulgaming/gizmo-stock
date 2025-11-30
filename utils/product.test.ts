import { describe, it, expect } from 'vitest';
import {
  normalizeImageSrc,
  getImageSrcFromRecord,
  extractPrice,
  extractCost,
  formatPrice,
} from './product';

describe('product utils', () => {
  describe('normalizeImageSrc', () => {
    const serverIP = '192.168.1.100';

    it('should return undefined for falsy values', () => {
      expect(normalizeImageSrc(null, serverIP)).toBeUndefined();
      expect(normalizeImageSrc(undefined, serverIP)).toBeUndefined();
      expect(normalizeImageSrc('', serverIP)).toBeUndefined();
    });

    it('should return http URLs as-is', () => {
      const url = 'http://example.com/image.jpg';
      expect(normalizeImageSrc(url, serverIP)).toBe(url);
    });

    it('should return https URLs as-is', () => {
      const url = 'https://example.com/image.jpg';
      expect(normalizeImageSrc(url, serverIP)).toBe(url);
    });

    it('should return data URLs as-is', () => {
      const dataUrl = 'data:image/png;base64,abc123';
      expect(normalizeImageSrc(dataUrl, serverIP)).toBe(dataUrl);
    });

    it('should prepend server IP to paths starting with /', () => {
      const path = '/images/product.jpg';
      expect(normalizeImageSrc(path, serverIP)).toBe('http://192.168.1.100/images/product.jpg');
    });

    it('should detect PNG base64 and add correct data URI prefix', () => {
      const pngBase64 = 'iVBORw0' + 'A'.repeat(100);
      const result = normalizeImageSrc(pngBase64, serverIP);
      expect(result).toContain('data:image/png;base64,');
    });

    it('should detect JPEG base64 and add correct data URI prefix', () => {
      const jpegBase64 = '/9j/' + 'A'.repeat(100);
      const result = normalizeImageSrc(jpegBase64, serverIP);
      expect(result).toContain('data:image/jpeg;base64,');
    });
  });

  describe('getImageSrcFromRecord', () => {
    const serverIP = '192.168.1.100';

    it('should return undefined for non-object values', () => {
      expect(getImageSrcFromRecord(null, serverIP)).toBeUndefined();
      expect(getImageSrcFromRecord('string', serverIP)).toBeUndefined();
      expect(getImageSrcFromRecord(123, serverIP)).toBeUndefined();
    });

    it('should extract imageUrl from record', () => {
      const record = { imageUrl: 'https://example.com/image.jpg' };
      expect(getImageSrcFromRecord(record, serverIP)).toBe('https://example.com/image.jpg');
    });

    it('should extract url from record', () => {
      const record = { url: 'https://example.com/image.jpg' };
      expect(getImageSrcFromRecord(record, serverIP)).toBe('https://example.com/image.jpg');
    });

    it('should extract imagePath from record', () => {
      const record = { imagePath: '/images/product.jpg' };
      expect(getImageSrcFromRecord(record, serverIP)).toBe('http://192.168.1.100/images/product.jpg');
    });

    it('should prioritize imageUrl over other fields', () => {
      const record = {
        imageUrl: 'https://primary.com/image.jpg',
        url: 'https://secondary.com/image.jpg',
      };
      expect(getImageSrcFromRecord(record, serverIP)).toBe('https://primary.com/image.jpg');
    });
  });

  describe('extractPrice', () => {
    it('should return undefined for non-object values', () => {
      expect(extractPrice(null)).toBeUndefined();
      expect(extractPrice('string')).toBeUndefined();
    });

    it('should extract salePrice', () => {
      expect(extractPrice({ salePrice: 99.99 })).toBe(99.99);
    });

    it('should extract price', () => {
      expect(extractPrice({ price: 49.99 })).toBe(49.99);
    });

    it('should handle string prices with comma', () => {
      expect(extractPrice({ price: '10,50' })).toBe(10.5);
    });

    it('should handle nested price objects', () => {
      expect(extractPrice({ price: { value: 25.00 } })).toBe(25.00);
    });

    it('should extract from productPrices array', () => {
      const record = {
        productPrices: [{ value: 15.00 }],
      };
      expect(extractPrice(record)).toBe(15.00);
    });

    it('should prioritize salePrice over price', () => {
      expect(extractPrice({ salePrice: 80, price: 100 })).toBe(80);
    });
  });

  describe('extractCost', () => {
    it('should return undefined for non-object values', () => {
      expect(extractCost(null)).toBeUndefined();
    });

    it('should extract cost', () => {
      expect(extractCost({ cost: 50.00 })).toBe(50.00);
    });

    it('should extract costPrice', () => {
      expect(extractCost({ costPrice: 30.00 })).toBe(30.00);
    });

    it('should extract purchasePrice', () => {
      expect(extractCost({ purchasePrice: 25.00 })).toBe(25.00);
    });

    it('should handle string costs', () => {
      expect(extractCost({ cost: '45,50' })).toBe(45.5);
    });
  });

  describe('formatPrice', () => {
    it('should format number with 2 decimal places', () => {
      expect(formatPrice(10)).toBe('10.00');
      expect(formatPrice(99.9)).toBe('99.90');
      expect(formatPrice(0.5)).toBe('0.50');
    });

    it('should return dash for undefined', () => {
      expect(formatPrice(undefined)).toBe('-');
    });

    it('should return dash for null', () => {
      expect(formatPrice(null)).toBe('-');
    });

    it('should return dash for NaN', () => {
      expect(formatPrice(NaN)).toBe('-');
    });

    it('should return dash for Infinity', () => {
      expect(formatPrice(Infinity)).toBe('-');
    });
  });
});
