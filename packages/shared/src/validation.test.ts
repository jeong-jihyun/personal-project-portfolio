import { describe, expect, it } from 'vitest';
import {
  careerSchema,
  careerUpdateSchema,
  isRepositoryUrl,
  isWebUrl,
  keywordsSchema,
  normalizeKeyword,
  projectCreateSchema,
  projectUpdateSchema,
  repositoryCreateSchema,
  repositoryUpdateSchema,
  slugify,
} from './index.js';

describe('projectCreateSchema', () => {
  it('requires a title and applies defaults', () => {
    expect(projectCreateSchema.safeParse({ title: '' }).success).toBe(false);
    const parsed = projectCreateSchema.parse({ title: '  포트폴리오  ' });
    expect(parsed.title).toBe('포트폴리오');
    expect(parsed.status).toBe('PLANNED');
    expect(parsed.visibility).toBe('PRIVATE');
  });

  it('rejects end date before start date', () => {
    const r = projectCreateSchema.safeParse({ title: 'a', startDate: '2026-05-01', endDate: '2026-04-30' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['endDate']);
  });

  it('rejects invalid calendar dates and bad slugs', () => {
    expect(projectCreateSchema.safeParse({ title: 'a', startDate: '2026-02-30' }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ title: 'a', slug: 'Bad Slug' }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ title: 'a', slug: 'good-slug-2' }).success).toBe(true);
  });
});

describe('update schemas keep PATCH semantics', () => {
  it('leaves omitted fields undefined and turns empty strings into null', () => {
    const parsed = projectUpdateSchema.parse({ summary: '' });
    expect(parsed.summary).toBeNull();
    expect(parsed.role).toBeUndefined();
    expect(parsed.visibility).toBeUndefined();
    expect(parsed.status).toBeUndefined();
  });

  it('applies no defaults on repository and career updates', () => {
    const repo = repositoryUpdateSchema.parse({ name: 'web' });
    expect(repo.visibility).toBeUndefined();
    expect(repo.isPrimary).toBeUndefined();
    const career = careerUpdateSchema.parse({ company: 'B' });
    expect(career.visibility).toBeUndefined();
    expect(career.endDate).toBeUndefined();
  });
});

describe('URL rules', () => {
  it('accepts only http(s) web URLs', () => {
    expect(isWebUrl('https://example.com')).toBe(true);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('data:text/html,hi')).toBe(false);
  });

  it('accepts https, ssh and scp-style repository URLs', () => {
    expect(isRepositoryUrl('https://github.com/owner/repo')).toBe(true);
    expect(isRepositoryUrl('git@github.com:owner/repo.git')).toBe(true);
    expect(isRepositoryUrl('ssh://git@github.com/owner/repo.git')).toBe(true);
    expect(isRepositoryUrl('http://github.com/owner/repo')).toBe(false);
    expect(isRepositoryUrl('javascript:alert(1)')).toBe(false);
  });

  it('validates repository payloads', () => {
    expect(repositoryCreateSchema.safeParse({ name: 'web', url: 'ftp://x' }).success).toBe(false);
    const ok = repositoryCreateSchema.parse({ name: 'web', url: 'https://github.com/o/web' });
    expect(ok.isPrimary).toBe(false);
    expect(ok.visibility).toBe('PRIVATE');
  });
});

describe('careerSchema', () => {
  it('allows an open-ended (current) career', () => {
    expect(careerSchema.safeParse({ company: 'A', position: 'Dev', startDate: '2020-01-01' }).success).toBe(true);
  });
});

describe('keywords', () => {
  it('strips #, trims, dedupes case-insensitively and keeps first spelling', () => {
    expect(keywordsSchema.parse(['#TypeScript', ' react ', 'React', '##NestJS', 'Spring   Boot'])).toEqual([
      'TypeScript',
      'react',
      'NestJS',
      'Spring Boot',
    ]);
    expect(normalizeKeyword('  #  GraphQL ')).toBe('GraphQL');
  });

  it('rejects empty, too long, comma or angle-bracket keywords and more than 20', () => {
    expect(keywordsSchema.safeParse(['#']).success).toBe(false);
    expect(keywordsSchema.safeParse(['x'.repeat(41)]).success).toBe(false);
    expect(keywordsSchema.safeParse(['a,b']).success).toBe(false);
    expect(keywordsSchema.safeParse(['<script>']).success).toBe(false);
    expect(keywordsSchema.safeParse(Array.from({ length: 21 }, (_, i) => `k${i}`)).success).toBe(false);
  });
});

describe('slugify', () => {
  it('creates url-safe slugs', () => {
    expect(slugify('Portfolio Platform v2!')).toBe('portfolio-platform-v2');
    expect(slugify('한글 제목')).toBe('');
  });
});
