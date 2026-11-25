import { describe, expect, it } from 'vitest';
import {
  parseLocalizationSheet,
  rowsWithPrefix,
} from '../../../src/main/services/sync/google/LocalizationSyncParser';

/** Localization_Jeju_v3 as the Sheets API returns it: the title row above the Key header. */
const JEJU_V3 = [
  ['운영팀> 2번 모니터> 앱 콘텐츠 내용'],
  ['Key', 'Korean', 'English', 'Japanese', 'Chinese', 'Vietnamese', 'Thai', 'Russian', 'Indonesian', '설명, 비고'],
  ['Fillme_text035', '[개인보호정책] 동의합니다.', '[Privacy Policy] I agree.', 'ja', 'zh', 'vi', 'th', 'ru', 'id', ''],
  ['Fillme_PrivacyPolicyContent', '개인정보처리방침\n\n머리말', 'Privacy Policy\n\nPreamble', '', '', '', '', '', '', ''],
  ['Home_Title', '제주 홈', 'Jeju home', '', '', '', '', '', '', ''],
];

describe('롯데 borrows the FillMe rows from the 제주 Localization tab', () => {
  it('keeps only the Fillme_ rows, in every language the tab has', () => {
    const rows = rowsWithPrefix(parseLocalizationSheet(JEJU_V3, 'JEJU_AIRPORT'), 'Fillme_');
    expect(rows.ko?.['Fillme_text035']).toBe('[개인보호정책] 동의합니다.');
    expect(rows.en?.['Fillme_PrivacyPolicyContent']).toContain('Privacy Policy');
    expect(rows.id?.['Fillme_text035']).toBe('id');
    expect(rows.ko?.['Home_Title']).toBeUndefined();
  });
});
