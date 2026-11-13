/**
 * 안녕 롯데 — the 안녕 '하영' page: 소개 keeps the portrait card, 취미생활 and 건강습관 stack text and
 * photo in turn, and the hashtags close all three. The character belongs to the character team,
 * so every value and picture is a slot until its material arrives.
 */
import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { LottePageFrame } from './LottePageFrame';
import { LotteTabRow } from './LotteTabRow';
import c from './lotteContent.module.css';

type Tab = 'intro' | 'hobby' | 'health';
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'intro', label: '소개' },
  { id: 'hobby', label: '취미생활' },
  { id: 'health', label: '건강습관' },
];
const PROFILE: ReadonlyArray<string> = ['이름', '나이', '직업', '성격', '좋아하는 것'];
const STORIES: Record<Exclude<Tab, 'intro'>, readonly string[]> = {
  hobby: ['취미 1', '취미 2', '취미 3'],
  health: ['습관 1', '습관 2', '습관 3'],
};

export function LotteHello({ controller }: { controller: KioskController }): JSX.Element {
  const [tab, setTab] = useState<Tab>('intro');
  return (
    <LottePageFrame
      controller={controller}
      title="안녕 롯데"
      subtitle="캐릭터를 소개합니다"
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
                  <span className={c.helloName}>캐릭터 이름 자리</span>
                  {PROFILE.map((k) => (
                    <div key={k} className={c.profileRow}>
                      <span className={c.profileKey}>{k}</span>
                      <span>자료를 받으면 표시합니다</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            STORIES[tab].map((name, i) => (
              <div key={name} className={c.panel}>
                <div className={`${c.storyRow} ${i % 2 ? c.storyRowRev : ''}`}>
                  <div className={c.storyPhoto}>사진 자리</div>
                  <div className={c.storyText}>
                    <b>{name}</b>
                    <span>자료를 받으면 표시합니다</span>
                  </div>
                </div>
              </div>
            ))
          )}
          <div className={c.tags}>
            <span className={c.hash}>#해시태그 자리</span>
            <span className={c.hash}>#해시태그 자리</span>
          </div>
        </div>
      </div>
    </LottePageFrame>
  );
}
