/**
 * 안녕 로씨 — the 안녕 '하영' page: 소개 keeps the portrait card, 취미생활 and 건강습관 stack text and
 * photo in turn, and the hashtags close all three.
 *
 * Every line is the 롯데 sheet's `Greeting_*` row (Localization_Lotte, 2026-11-24 — the same keys
 * 제주's 안녕 page reads): the page intro, the three tab names, the profile (label row + its
 * `…Content` row), each hobby and habit as name · headline (`_Desc_1`) · body (`_Desc_2`), and
 * `Greeting_Tag1..3`. The pictures are slots until the character team's material arrives; a row
 * the sheet has not filled shows the slot line instead.
 */
import { belowModeBar } from './lowReach';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { LottePageFrame } from './LottePageFrame';
import { LotteTabRow } from './LotteTabRow';
import { lt } from './lotteText';
import { slot, tc, type CopyKey } from './lotteCopy';
import { useVoiceIntro } from '../jeju/voice/intro';
import c from './lotteContent.module.css';

type Tab = 'intro' | 'hobby' | 'health';
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'intro', label: '소개' },
  { id: 'hobby', label: '취미생활' },
  { id: 'health', label: '건강습관' },
];
const SLOT = '자료를 받으면 표시합니다';
/** Tab name rows (Greeting_Category1..3), with the copy table's names as the fallback. */
const TAB_KEYS: Record<Tab, readonly [string, CopyKey]> = {
  intro: ['Greeting_Category1', 'Hello_Tab_Intro'],
  hobby: ['Greeting_Category2', 'Hello_Tab_Hobby'],
  health: ['Greeting_Category3', 'Hello_Tab_Health'],
};
/** Profile rows in the sheet's order: [label row, authored label]; the value is `<row>Content`. */
const PROFILE: ReadonlyArray<readonly [string, string]> = [
  ['Greeting_BirthDay', '생일'],
  ['Greeting_HomeTown', '출신'],
  ['Greeting_Nationality', '국적'],
  ['Greeting_BloodType', '혈액형'],
  ['Greeting_MBTI', 'MBTI'],
  ['Greeting_Hobby', '취미'],
  ['Greeting_Specialty', '특기'],
  ['Greeting_FutureHope', '장래희망'],
  ['Greeting_Introdution', '자기소개'], // the sheet's own spelling
];
/** [name row, authored name]; the headline and body are `<row>_Desc_1` / `<row>_Desc_2`. */
const STORIES: Record<Exclude<Tab, 'intro'>, ReadonlyArray<readonly [string, string]>> = {
  hobby: [
    ['Greeting_Hobby_First', 'K-POP'],
    ['Greeting_Hobby_Second', '골프'],
    ['Greeting_Hobby_Third', '테니스'],
  ],
  health: [
    ['Greeting_Healthy_Habit_First', '목 · 어깨'],
    ['Greeting_Healthy_Habit_Second', '허리'],
    ['Greeting_Healthy_Habit_Third', '기분전환'],
  ],
};
const TAG_KEYS = ['Greeting_Tag1', 'Greeting_Tag2', 'Greeting_Tag3'] as const;

/** 음성 안내 per tab (the 롯데 sheet's Text-to-speech_Script). */
const VOICE_INTROS: Record<Tab, readonly string[]> = {
  intro: ['lotte.hello'],
  hobby: ['lotte.hello.hobby'],
  health: ['lotte.hello.health'],
};

export function LotteHello({ controller }: { controller: KioskController }): JSX.Element {
  const [tab, setTab] = useState<Tab>('intro');
  useVoiceIntro(VOICE_INTROS[tab]);
  const lang = useLanguageStore((s) => s.currentLanguage);
  const tags = TAG_KEYS.map((k) => lt(k, lang, '')).filter(Boolean);
  /** A row's cell in this language, or the 준비 중 line while the sheet has none. */
  const value = (key: string): string => lt(key, lang, { ko: SLOT, [lang]: tc('Data_Soon', lang) });
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  return (
    <LottePageFrame
      controller={controller}
      title={lt('MainButton_Greeting', lang, '안녕 롯데')}
      subtitle={lt('Greeting_Introduce', lang, lt('MainButton_Greeting_Subtext', lang, '캐릭터를 소개합니다'))}
      showBanner={false}
      /* ♿: header under the bar, the tab row at the foot (LotteTabRow .tabsLow). */
      lowReachModeBar
      lowReachShift={belowModeBar()}
    >
      <LotteTabRow
        tabs={TABS.map((x) => ({
          ...x,
          label: lt(TAB_KEYS[x.id][0], lang, { [lang]: tc(TAB_KEYS[x.id][1], lang) }),
        }))}
        value={tab}
        onChange={setTab}
      />
      <div className={`${c.body} ${lowReach ? c.bodyAboveTabs : c.bodyBelowTabs}`}>
        <div className={c.scroll}>
          {tab === 'intro' ? (
            <div className={c.panel}>
              <div className={c.profile}>
                <div className={c.portrait}>{slot('캐릭터 이미지 자리', lang)}</div>
                <div className={c.profileRows}>
                  <span className={c.helloName}>{lt('Greeting_NameContent', lang, '캐릭터 이름 자리')}</span>
                  <div className={c.profileRow}>
                    <span className={c.profileKey}>{tc('Hello_Label_Role', lang)}</span>
                    <span>{value('Greeting_Role')}</span>
                  </div>
                  {PROFILE.map(([label, authored]) => (
                    <div key={label} className={c.profileRow}>
                      <span className={c.profileKey}>{lt(label, lang, authored)}</span>
                      <span>{value(`${label}Content`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            STORIES[tab].map(([key, authored], i) => {
              const head = lt(`${key}_Desc_1`, lang, '');
              return (
                <div key={key} className={c.panel}>
                  <div className={`${c.storyRow} ${i % 2 ? c.storyRowRev : ''}`}>
                    <div className={c.storyPhoto}>{slot('사진 자리', lang)}</div>
                    <div className={c.storyText}>
                      <b>{lt(key, lang, authored)}</b>
                      {head && <strong className={c.storyHead}>{head}</strong>}
                      <span>{value(`${key}_Desc_2`)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div className={c.tags}>
            {(tags.length > 0 ? tags : ['#해시태그 자리', '#해시태그 자리']).map((h, i) => (
              <span key={`${h}-${i}`} className={c.hash}>
                {h}
              </span>
            ))}
          </div>
        </div>
      </div>
    </LottePageFrame>
  );
}
