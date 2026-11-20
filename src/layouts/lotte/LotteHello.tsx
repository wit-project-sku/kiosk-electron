/**
 * 안녕 로씨 — the 안녕 '하영' page: 소개 keeps the portrait card, 취미생활 and 건강습관 stack text and
 * photo in turn, and the hashtags close all three.
 *
 * Every line is the 롯데 sheet's `Hello_*` / `Hobby_*` / `Health_*` row (Localization_Lotte); the
 * pictures, and the hobby and habit write-ups, are slots until the character team's material
 * arrives. A row the sheet has not filled shows the slot line instead.
 */
import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { LottePageFrame } from './LottePageFrame';
import { LotteTabRow } from './LotteTabRow';
import { lt } from './lotteText';
import { useVoiceIntro } from '../jeju/voice/intro';
import c from './lotteContent.module.css';

type Tab = 'intro' | 'hobby' | 'health';
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'intro', label: '소개' },
  { id: 'hobby', label: '취미생활' },
  { id: 'health', label: '건강습관' },
];
const SLOT = '자료를 받으면 표시합니다';
/** [label row, value row, authored label]. */
const PROFILE: ReadonlyArray<readonly [string, string, string]> = [
  ['Hello_Label_Birth', 'Hello_Birth', '생일'],
  ['Hello_Label_From', 'Hello_From', '출신'],
  ['Hello_Label_Nationality', 'Hello_Nationality', '국적'],
  ['Hello_Label_MBTI', 'Hello_MBTI', 'MBTI'],
  ['Hello_Label_Skill', 'Hello_Skill', '특기'],
  ['Hello_Label_Hobby', 'Hello_Hobby', '취미'],
];
const STORIES: Record<Exclude<Tab, 'intro'>, ReadonlyArray<readonly [string, string]>> = {
  hobby: [
    ['Hobby_KPOP', 'K-POP'],
    ['Hobby_Golf', '골프'],
    ['Hobby_Tennis', '테니스'],
  ],
  health: [
    ['Health_Neck', '목 · 어깨'],
    ['Health_Back', '허리'],
    ['Health_Refresh', '기분전환'],
  ],
};

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
  const tags = lt('Hello_Hashtag', lang, '').split(/\s+/).filter(Boolean);
  const intro = lt('Hello_Intro', lang, '');
  return (
    <LottePageFrame
      controller={controller}
      title={lt('MainButton_Greeting', lang, '안녕 롯데')}
      subtitle={lt('MainButton_Greeting_Subtext', lang, '캐릭터를 소개합니다')}
      showBanner={false}
    >
      <LotteTabRow tabs={TABS} value={tab} onChange={setTab} />
      <div className={`${c.body} ${c.bodyBelowTabs}`}>
        <div className={c.scroll}>
          {tab === 'intro' ? (
            <div className={c.panel}>
              <div className={c.profile}>
                <div className={c.portrait}>캐릭터 이미지 자리</div>
                <div className={c.profileRows}>
                  <span className={c.helloName}>{lt('Hello_Name', lang, '캐릭터 이름 자리')}</span>
                  <div className={c.profileRow}>
                    <span className={c.profileKey}>{lt('Hello_Label_Role', lang, '역할')}</span>
                    <span>{lt('Hello_Role', lang, SLOT)}</span>
                  </div>
                  {PROFILE.map(([label, value, authored]) => (
                    <div key={value} className={c.profileRow}>
                      <span className={c.profileKey}>{lt(label, lang, authored)}</span>
                      <span>{lt(value, lang, SLOT)}</span>
                    </div>
                  ))}
                  {intro && <span>{intro}</span>}
                </div>
              </div>
            </div>
          ) : (
            STORIES[tab].map(([key, authored], i) => (
              <div key={key} className={c.panel}>
                <div className={`${c.storyRow} ${i % 2 ? c.storyRowRev : ''}`}>
                  <div className={c.storyPhoto}>사진 자리</div>
                  <div className={c.storyText}>
                    <b>{lt(key, lang, authored)}</b>
                    <span>{SLOT}</span>
                  </div>
                </div>
              </div>
            ))
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
