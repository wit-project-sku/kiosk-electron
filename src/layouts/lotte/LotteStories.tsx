/**
 * 오늘의 사연 — Figma C-05 (목록, 8768:910), C-06 (없음, 8768:1120), C-07 (보기, 8768:1280).
 *
 * Opened from the home card; no auto-play. Stories are only read here — sending one happens in the
 * WITS app (QR). The 보기 screen is the frame's full-bleed dark page: its red '오늘의 사연' tag goes
 * back to the list, ‹ 이전 · 다음 › step through, and the kiosk's idle timer returns home.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { LottePageFrame } from './LottePageFrame';
import { LotteQr } from './LotteQr';
import { storySubmitLink } from './lotteLinks';
import { useLotteStories } from './lotteLive';
import { STORY_KIND_LABEL, toStory, type Story } from './lotteStoryData';
import { lt } from './lotteText';
import { tc } from './lotteCopy';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useVoiceIntro } from '../jeju/voice/intro';
import ui from './lotteUi.module.css';
import s from './LotteStories.module.css';

const TITLE = '오늘의 사연';
const SUBTITLE = '방문객이 보낸 사연을 볼 수 있어요';
/** Story_Type_* row per kind. */
const KIND_KEY = { photo: 'Story_Type_Photo', video: 'Story_Type_Video', text: 'Story_Type_Text' } as const;
/** A sheet sentence drawn as a heading drops its closing full stop. */
const plain = (line: string): string => line.replace(/[.。]\s*$/, '');
const useLang = () => useLanguageStore((st) => st.currentLanguage);

function SendCard({ link }: { link: string | null }): JSX.Element {
  const lang = useLang();
  return (
    <div className={ui.qrCard}>
      <LotteQr value={link} />
      <div className={ui.qrText}>
        <span className={ui.qrTitle}>{lt('Story_Send', lang, '내 사연 보내기')}</span>
        <span className={ui.qrSub}>{tc('Story_QR_Sub', lang)}</span>
      </div>
    </div>
  );
}

const VOICE_LIST = ['lotte.story.list'] as const;
const VOICE_EMPTY = ['lotte.story.empty'] as const;
const VOICE_VIEW = ['lotte.story.view'] as const;

export function LotteStories({ controller }: { controller: KioskController }): JSX.Element {
  const lang = useLang();
  const live = useLotteStories();
  const stories = useMemo(() => (live ?? []).map(toStory), [live]);
  /* By id, not position: the list refreshes each minute and a story can be hidden meanwhile. */
  const [openId, setOpenId] = useState<number | null>(null);
  const open = stories.findIndex((st) => st.id === openId);
  useVoiceIntro(open >= 0 ? VOICE_VIEW : stories.length === 0 ? VOICE_EMPTY : VOICE_LIST);
  /* 사연 보내기 — this site's WITS page (the same QR on the list and on 보기). */
  const sendLink = storySubmitLink(controller.kioskId);

  if (open >= 0) {
    return (
      <StoryView
        sendLink={sendLink}
        stories={stories}
        index={open}
        onIndex={(i) => setOpenId(stories[i]?.id ?? null)}
        onClose={() => setOpenId(null)}
      />
    );
  }

  return (
    <LottePageFrame
      controller={controller}
      title={lt('Story_Title', lang, TITLE)}
      subtitle={lt('Story_Subtitle', lang, SUBTITLE)}
      showBanner={false}
    >
      <div className={ui.column}>
        {stories.length === 0 ? (
          <div className={`${ui.card} ${s.empty}`}>
            <span className={s.emptyMark}>…</span>
            <span className={s.emptyTitle}>{plain(lt('Story_Empty', lang, '아직 사연이 없습니다'))}</span>
            <span className={s.emptySub}>{tc('Story_Empty_Sub', lang)}</span>
          </div>
        ) : (
          <div className={s.list}>
            <div className={s.listHead}>
              <h2 className={ui.heading}>{tc('Story_Count', lang, { n: stories.length })}</h2>
              <span className={s.order}>{tc('Story_Order', lang)}</span>
            </div>
            {stories.map((st) => (
              <button key={st.id} type="button" className={s.item} onClick={() => setOpenId(st.id)}>
                <span className={s.thumb}>{lt(KIND_KEY[st.kind], lang, STORY_KIND_LABEL[st.kind])}</span>
                <span className={s.itemText}>
                  <span className={s.itemTitle}>{st.title}</span>
                  <span className={s.itemMeta}>
                    {st.author} · {st.date}
                  </span>
                </span>
                <span className={s.view}>{tc('Story_View', lang)}</span>
              </button>
            ))}
          </div>
        )}
        <SendCard link={sendLink} />
      </div>
    </LottePageFrame>
  );
}

const pad = (n: number): string => String(n).padStart(2, '0');

function StoryView({
  sendLink,
  stories,
  index,
  onIndex,
  onClose,
}: {
  sendLink: string | null;
  stories: readonly Story[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}): JSX.Element {
  const story = stories[index]!;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lang = useLang();
  const [progress, setProgress] = useState(0);
  useEffect(() => setProgress(0), [index]);
  const pin = lotteIconUrl('ico-location');
  const isVideo = story.kind === 'video';

  return (
    <div className={s.view_root}>
      <div className={s.top}>
        <span className={s.brand}>
          {pin && <img src={pin} alt="" draggable={false} />}
          LOTTE
        </span>
        <span className={s.clock}>
          {now.getFullYear()}-{pad(now.getMonth() + 1)}-{pad(now.getDate())} | {pad(now.getHours())}:
          {pad(now.getMinutes())}
        </span>
      </div>

      <div className={s.bar}>
        <button type="button" className={s.tag} onClick={onClose}>
          {TITLE}
        </button>
        <span className={s.count}>
          {index + 1} / {stories.length}
        </span>
      </div>

      <div className={s.media}>
        {story.mediaUrl ? (
          isVideo ? (
            <video
              ref={videoRef}
              src={story.mediaUrl}
              autoPlay
              muted
              playsInline
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                setProgress(v.duration ? v.currentTime / v.duration : 0);
              }}
            />
          ) : (
            <img src={story.mediaUrl} alt="" draggable={false} />
          )
        ) : (
          <span className={s.mediaHold}>{tc('Story_Media', lang)}</span>
        )}
      </div>

      <div className={s.text}>
        <span className={s.title}>{story.title}</span>
        <span className={s.body}>{story.body}</span>
        <span className={s.from}>
          {tc('Story_Author', lang, { name: story.author })}
        </span>
      </div>

      {isVideo && (
        <div className={s.progress}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <div className={s.foot}>
        <LotteQr value={sendLink} className={s.qr} />
        <div className={s.footText}>
          <span className={s.footTitle}>{tc('Story_SendMine', lang)}</span>
          <span className={s.footSub}>{tc('Story_SendSub', lang)}</span>
        </div>
        <span className={s.spacer} />
        <span className={s.nav}>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            ‹ {lt('Story_Prev', lang, '이전')}
          </button>
          {' · '}
          <button
            type="button"
            disabled={index === stories.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            {lt('Story_Next', lang, '다음')} ›
          </button>
        </span>
      </div>
    </div>
  );
}
