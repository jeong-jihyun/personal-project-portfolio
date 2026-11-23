import { describe, expect, it } from 'vitest';
import { careerTextToMarkdown, looksLikeCareerText } from './career-text.js';

const SAMPLE = `2025 |  엔솔 특허시스템 리뉴얼 2차 분석설계(특허)
ㆍ근무기간: \`25.09.24~\`25.12.19
ㆍ기술스택: Devon, React , Oracle, Git
ㆍ주요 업무 및 성과
 ≫ 소송 /분쟁 대응, 매입/ 라이선스 분석 설계
 ≫ 대리인 관리 ,제품 정보 관리등을 분석 설계

2001년 ~ 2004 | 쇼핑몰 구축및 인트라넷 제작(홈페이지)
ㆍ개발환경 : Asp,MSSQL,VB,Windows Server 2000
ㆍ주요 업무 및 성과
 ≫ 사이트 구축 및 운영 업무`;

describe('career text → markdown', () => {
  it('recognizes the resume format', () => {
    expect(looksLikeCareerText(SAMPLE)).toBe(true);
    expect(looksLikeCareerText('## 이미 마크다운\n- 항목')).toBe(false);
  });

  it('converts headings, meta lines and bullets', () => {
    const md = careerTextToMarkdown(SAMPLE);
    expect(md).toContain('### 엔솔 특허시스템 리뉴얼 2차 분석설계(특허)\n\n**2025**');
    expect(md).toContain('- **근무기간**: \\`25.09.24~\\`25.12.19');
    expect(md).toContain('- **기술스택**: Devon, React , Oracle, Git');
    expect(md).toContain('- **주요 업무 및 성과**\n  - 소송 /분쟁 대응');
    expect(md).toContain('### 쇼핑몰 구축및 인트라넷 제작(홈페이지)\n\n**2001년 ~ 2004**');
    expect(md).toContain('- **개발환경**: Asp,MSSQL,VB,Windows Server 2000');
  });

  it('escapes markdown/HTML characters so text shows as written', () => {
    const md = careerTextToMarkdown('2020 | <script>x</script> *bold*\nㆍ항목: a_b\n ≫ c');
    expect(md).toContain('\\<script\\>');
    expect(md).toContain('\\*bold\\*');
    expect(md).toContain('a\\_b');
  });
});
