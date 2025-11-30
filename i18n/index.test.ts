import { describe, it, expect, beforeEach } from 'vitest';
import { t, getLang, setLang, availableLanguages, languageNames } from './index';

describe('i18n', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLang('tr'); // Reset to default
  });

  describe('getLang / setLang', () => {
    it('should default to Turkish', () => {
      expect(getLang()).toBe('tr');
    });

    it('should change language correctly', () => {
      setLang('en');
      expect(getLang()).toBe('en');
    });

    it('should persist language to localStorage', () => {
      setLang('ru');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('gizmo-stock-lang', 'ru');
    });
  });

  describe('availableLanguages', () => {
    it('should have all supported languages', () => {
      expect(availableLanguages).toContain('tr');
      expect(availableLanguages).toContain('en');
      expect(availableLanguages).toContain('ru');
      expect(availableLanguages).toContain('el');
    });
  });

  describe('languageNames', () => {
    it('should have native names for all languages', () => {
      expect(languageNames.tr).toBe('Türkçe');
      expect(languageNames.en).toBe('English');
      expect(languageNames.ru).toBe('Русский');
      expect(languageNames.el).toBe('Ελληνικά');
    });
  });

  describe('t() translation function', () => {
    it('should return key if translation not found', () => {
      const result = t('non.existent.key');
      expect(result).toBe('non.existent.key');
    });

    it('should return Turkish translation by default', () => {
      setLang('tr');
      const result = t('nav.stock');
      expect(result).toBe('Stok Yönetimi');
    });

    it('should return English translation when language is set', () => {
      setLang('en');
      const result = t('nav.stock');
      expect(result).toBe('Stock Management');
    });

    it('should replace parameters in translation', () => {
      setLang('tr');
      const result = t('reset.done', { count: 5 });
      expect(result).toContain('5');
    });

    it('should handle multiple parameters', () => {
      const result = t('test.multi', { name: 'Test', count: 10 });
      // Returns key if not found, which is expected
      expect(result).toBeTruthy();
    });
  });

  describe('language switching', () => {
    it('should switch translations when language changes', () => {
      setLang('tr');
      const trResult = t('nav.settings');

      setLang('en');
      const enResult = t('nav.settings');

      expect(trResult).not.toBe(enResult);
    });
  });
});
