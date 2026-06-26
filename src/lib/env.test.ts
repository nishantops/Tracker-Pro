/**
 * Tests for src/lib/env.ts
 * Tests application configuration constants
 */
import { describe, it, expect } from 'vitest';
import { ENV } from './env';

describe('ENV config', () => {
  describe('App metadata', () => {
    it('APP_NAME is "UPSC Command Centre"', () => {
      expect(ENV.APP_NAME).toBe('UPSC Command Centre');
    });

    it('APP_VERSION starts with "3."', () => {
      expect(ENV.APP_VERSION).toMatch(/^3\./);
    });

    it('APP_TAGLINE contains UPSC CSE 2027', () => {
      expect(ENV.APP_TAGLINE).toContain('2027');
    });

    it('DEVELOPER_NAME is "SAN Labs"', () => {
      expect(ENV.DEVELOPER_NAME).toBe('SAN Labs');
    });

    it('HEADER_AVATAR is "SAN"', () => {
      expect(ENV.HEADER_AVATAR).toBe('SAN');
    });
  });

  describe('Supabase config', () => {
    it('SUPABASE_URL is set', () => {
      expect(ENV.SUPABASE_URL).toBeTruthy();
    });

    it('SUPABASE_URL starts with https://', () => {
      expect(ENV.SUPABASE_URL).toMatch(/^https:\/\//);
    });

    it('SUPABASE_URL points to correct project', () => {
      expect(ENV.SUPABASE_URL).toContain('wdbwnutkomemrciybezz');
    });

    it('SUPABASE_ANON_KEY is set', () => {
      expect(ENV.SUPABASE_ANON_KEY).toBeTruthy();
    });
  });

  describe('Auth config', () => {
    it('ADMIN_EMAIL is valid email', () => {
      expect(ENV.ADMIN_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('SUPERUSER_EMAIL is valid email', () => {
      expect(ENV.SUPERUSER_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('SUPERUSER_ALIAS is non-empty', () => {
      expect(ENV.SUPERUSER_ALIAS.trim().length).toBeGreaterThan(0);
    });

    it('AUTO_LOGOUT_MS is 15 minutes (900000 ms)', () => {
      expect(ENV.AUTO_LOGOUT_MS).toBe(15 * 60 * 1000);
    });
  });

  describe('Chat/messaging config', () => {
    it('DEFAULT_DAILY_MSG_LIMIT is 3', () => {
      expect(ENV.DEFAULT_DAILY_MSG_LIMIT).toBe(3);
    });

    it('MSG_UNREAD_POLL_MS is 2 minutes (120000 ms)', () => {
      expect(ENV.MSG_UNREAD_POLL_MS).toBe(120_000);
    });

    it('WEEKLY_FEEDBACK_DAYS is 7', () => {
      expect(ENV.WEEKLY_FEEDBACK_DAYS).toBe(7);
    });
  });

  describe('Performance config', () => {
    it('PT_DEBOUNCE_MS is 500', () => {
      expect(ENV.PT_DEBOUNCE_MS).toBe(500);
    });

    it('PT_MAX_ZOOM is 2.0', () => {
      expect(ENV.PT_MAX_ZOOM).toBe(2.0);
    });

    it('PT_MIN_ZOOM is 0.4', () => {
      expect(ENV.PT_MIN_ZOOM).toBe(0.4);
    });

    it('max zoom is greater than min zoom', () => {
      expect(ENV.PT_MAX_ZOOM).toBeGreaterThan(ENV.PT_MIN_ZOOM);
    });
  });

  describe('AI config', () => {
    it('GEMINI_MODEL is gemini-2.5-flash', () => {
      expect(ENV.GEMINI_MODEL).toBe('gemini-2.5-flash');
    });

    it('GEMINI_API_KEY is non-empty string', () => {
      expect(typeof ENV.GEMINI_API_KEY).toBe('string');
      expect(ENV.GEMINI_API_KEY.length).toBeGreaterThan(10);
    });
  });

  describe('Exam dates', () => {
    it('PRELIMS_DATE contains 2027', () => {
      expect(ENV.PRELIMS_DATE).toContain('2027');
    });

    it('MAINS_DATE contains 2027', () => {
      expect(ENV.MAINS_DATE).toContain('2027');
    });

    it('PRELIMS_DATE is in May 2027', () => {
      expect(ENV.PRELIMS_DATE).toContain('May');
      expect(ENV.PRELIMS_DATE).toContain('2027');
    });

    it('MAINS_DATE is in August 2027', () => {
      expect(ENV.MAINS_DATE).toContain('August');
      expect(ENV.MAINS_DATE).toContain('2027');
    });

    it('Prelims date is before Mains date', () => {
      const prelims = new Date(ENV.PRELIMS_DATE);
      const mains = new Date(ENV.MAINS_DATE);
      expect(prelims.getTime()).toBeLessThan(mains.getTime());
    });
  });

  describe('Metrics config', () => {
    it('METRICS_FLUSH_MS is 10 seconds (10000 ms)', () => {
      expect(ENV.METRICS_FLUSH_MS).toBe(10_000);
    });
  });
});
