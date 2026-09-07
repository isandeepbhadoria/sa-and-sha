import { describe, it, expect } from 'vitest';
import {
  sanitizeEmailHtml,
  validateEmailTemplateInput,
  VersionConflictError
} from '../emailTemplateHelpers';

describe('Email Template Security & Hardening Tests (Phase 9B.2.1)', () => {
  describe('HTML Sanitization', () => {
    it('strips dangerous script tags and inline execution code', () => {
      const maliciousHtml = '<div>Hello</div><script>alert("xss")</script><p>World</p>';
      const sanitized = sanitizeEmailHtml(maliciousHtml);
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('<div>Hello</div>');
      expect(sanitized).toContain('<p>World</p>');
    });

    it('strips dangerous iframe, object, embed, and form tags', () => {
      const maliciousHtml = `
        <iframe src="https://malicious.com"></iframe>
        <object data="test.swf"></object>
        <embed src="test.swf" />
        <form action="https://phishing.com"><input type="text"/></form>
      `;
      const sanitized = sanitizeEmailHtml(maliciousHtml);
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('<object');
      expect(sanitized).not.toContain('<embed');
      expect(sanitized).not.toContain('<form');
    });

    it('removes inline event handlers like onerror and onclick', () => {
      const maliciousHtml = '<img src="x" onerror="alert(1)" /><a href="#" onclick="doBadThing()">Click</a>';
      const sanitized = sanitizeEmailHtml(maliciousHtml);
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).toContain('<img src="x" />');
    });

    it('strips javascript: and vbscript: URIs in href and src', () => {
      const maliciousHtml = '<a href="javascript:alert(1)">Link</a><img src="vbscript:msgbox(1)" />';
      const sanitized = sanitizeEmailHtml(maliciousHtml);
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('vbscript:');
    });

    it('discards meta refresh tags', () => {
      const maliciousHtml = '<meta http-equiv="refresh" content="0;url=https://phishing.com" />';
      const sanitized = sanitizeEmailHtml(maliciousHtml);
      expect(sanitized).not.toContain('refresh');
      expect(sanitized).not.toContain('phishing');
    });

    it('preserves valid email markup, inline styles, and tables', () => {
      const validEmailHtml = `
        <div style="background-color: #f8f8f8; padding: 20px;">
          <h1 style="color: #b85c38;">Order Confirmation</h1>
          <table width="100%" border="0" cellpadding="10" cellspacing="0">
            <tr>
              <td align="left" style="font-family: sans-serif;">Item: Sa and Sha Sheet</td>
              <td align="right">₹4,999</td>
            </tr>
          </table>
          <a href="https://saandsha.com/orders/123" style="color: #b85c38;">View Order</a>
        </div>
      `;
      const sanitized = sanitizeEmailHtml(validEmailHtml);
      expect(sanitized).toContain('Order Confirmation');
      expect(sanitized).toContain('background-color:#f8f8f8');
      expect(sanitized).toContain('<table');
      expect(sanitized).toContain('href="https://saandsha.com/orders/123"');
    });
  });

  describe('Input Bounds & Validation', () => {
    it('validates template ID format strictly', () => {
      expect(validateEmailTemplateInput({ templateId: 'order_confirmed' }).valid).toBe(true);
      expect(validateEmailTemplateInput({ templateId: 'welcome-email' }).valid).toBe(true);
      expect(validateEmailTemplateInput({ templateId: '../invalid/path' }).valid).toBe(false);
      expect(validateEmailTemplateInput({ templateId: '<script>' }).valid).toBe(false);
      expect(validateEmailTemplateInput({ templateId: 'a'.repeat(65) }).valid).toBe(false);
    });

    it('rejects oversized subjects (> 300 chars)', () => {
      const validSub = 'a'.repeat(300);
      const invalidSub = 'a'.repeat(301);
      expect(validateEmailTemplateInput({ subject: validSub }).valid).toBe(true);
      expect(validateEmailTemplateInput({ subject: invalidSub }).valid).toBe(false);
    });

    it('rejects oversized HTML content (> 500 KB)', () => {
      const normalHtml = '<p>Normal</p>';
      const hugeHtml = 'a'.repeat(501 * 1024);
      expect(validateEmailTemplateInput({ html: normalHtml }).valid).toBe(true);
      expect(validateEmailTemplateInput({ html: hugeHtml }).valid).toBe(false);
    });

    it('validates recipient email address for test emails', () => {
      expect(validateEmailTemplateInput({ recipientEmail: 'admin@saandsha.com' }).valid).toBe(true);
      expect(validateEmailTemplateInput({ recipientEmail: 'invalid-email' }).valid).toBe(false);
      expect(validateEmailTemplateInput({ recipientEmail: '' }).valid).toBe(false);
    });
  });

  describe('Optimistic Lock Conflict Error', () => {
    it('constructs VersionConflictError with currentVersion and VERSION_CONFLICT code', () => {
      const err = new VersionConflictError('Conflict message', 5);
      expect(err.code).toBe('VERSION_CONFLICT');
      expect(err.currentVersion).toBe(5);
      expect(err.message).toBe('Conflict message');
    });
  });
});
