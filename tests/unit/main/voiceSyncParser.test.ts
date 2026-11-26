import { describe, expect, it } from 'vitest';
import { parseVoiceSheet } from '../../../src/main/services/sync/google/VoiceSyncParser';

describe('parseVoiceSheet on the 롯데 tab', () => {
  it('finds the header below the legend rows (Sheets API shape)', () => {
    const rows = [
      ['롯데 키오스크 음성 안내 대본 (8개 언어)'],
      ['', '3곳 공통'],
      ['', '롯데월드몰'],
      ['Num', 'Key', '화면 / 언제', '적용', 'Korean', 'English', 'Japanese', 'Chinese', 'Vietnamese', 'Thai', 'Russian', 'Indonesian', '비고'],
      ['1', 'Voice_lotte.home@W011', 'A-01', '롯데월드몰', '안녕', 'Hello', 'こんにちは', '你好', 'Xin chào', 'สวัสดี', 'Привет', 'Halo', 'L1'],
    ];
    const out = parseVoiceSheet(rows);
    expect(out.ko?.['Voice_lotte.home@W011']).toBe('안녕');
    expect(out.id?.['Voice_lotte.home@W011']).toBe('Halo');
  });
});
