/**
 * 제주 AI 손톱 건강분석 (screen `fillme`) — FillMe(주식회사 링커버스) 손톱분석을
 * 제주 키오스크 안에서 직접 그린다. 웹뷰가 아니라 앱이 그리는 화면이다.
 *
 * 흐름(샘플 앱 kiosk.js 와 같은 순서·규칙, fillme-jeju-prototype 을 거쳐 옮겼다):
 *   시작 → 손톱 촬영(왼손·오른손 자동) → 정보 입력 → AI 분석 중 → 결과
 * 촬영 사진은 정보 입력 화면에서 동의하고 '다음으로' 를 누르기 전까지 기기 메모리에만
 * 있고 서버로 보내지 않는다.
 *
 * 2026-09-17: 샘플 앱에 있던 별도의 '개인정보 이용 동의' 화면(개인정보 · 민감정보
 * 두 체크박스)을 뺐다 — 요청에 따라. 동의는 정보 입력 화면의 한 줄
 * ("서비스 제공을 위해 이용자의 정보 수집을 동의합니다")로만 받는다.
 *
 * ── 시안과 달라진 곳 ───────────────────────────────────────────────────────
 *  · 틀: 시안의 JejuFrame(복제본) 대신 실제 JejuPageFrame 을 쓴다. 좌표계가 같아
 *    (2160×3840, 헤더 700, 레일 x50/y2043, 배너 y3267) 화면 본문은 손대지 않았다.
 *  · 홈/뒤로: 헤더와 레일의 홈은 키오스크 홈으로 나간다(다른 제주 화면과 같다).
 *    화면 안의 '처음으로'만 이 기능의 첫 화면으로 돌아간다.
 *  · 무입력: 키오스크 전체 타이머(3분, useKioskController)와 별개로 이 화면이
 *    자기 타이머를 돌린다. 이 화면만 손 사진과 신체 정보를 들고 있어서, 전체
 *    타이머가 홈으로 돌리기 전에 먼저 그것들을 버려야 한다. 끝나면 홈으로 나간다.
 *  · 시안 도구(툴바·화면 바로가기·가짜 분석 응답 mock.ts)는 옮기지 않았다. 카메라
 *    데모 피드는 남겼다 — 손톱 카메라가 아직 안 달린 기기에서 화면을 확인할 때
 *    쓰고, config.ts 의 VITE_FILLME_CAMERA_MODE 로 켠다. 분석은 언제나 진짜다.
 *
 * ── 아직 남은 것 ─────────────────────────────────────────────────────────
 *  · 문구가 한국어뿐이다. 제주는 8개 언어를 쓰지만 동의·개인정보처리방침은 법적
 *    문구라 임의로 번역하지 않는다 — 번역본을 받아 Localization_Jeju 에 올리는
 *    것이 다음 단계다. copy.ts 머리말 참고.
 *  · 손톱 카메라 모델과 설치 방향은 [확인 필요]. config.ts 의 VITE_FILLME_CAMERA_*
 *    로 조정한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { JejuPageFrame } from '../JejuPageFrame';
import { FILLME_CONFIG, FILLME_CAMERA_MODE } from './config';
import { ApiError, analyzeGuest, needsRecapture, type AnalysisResult, type Hand, type Sex } from './api';
import { NailCamera } from './camera';
import { FIELD_ORDER, type ConsentKey, type FieldKey } from './copy';
import { useLang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { tx, tLines } from './text';
import { createShare, type ShareState } from './share';
import { renderResultImage } from './shareImage';
import { FillmeIntro } from './FillmeIntro';
import { FillmeCapture, type CapturePhase } from './FillmeCapture';
import { FillmeInfo, infoValid, type InfoValues } from './FillmeInfo';
import { FillmeAnalyzing } from './FillmeAnalyzing';
import { FillmeResult } from './FillmeResult';
import { Keypad } from './Keypad';
import { PolicySheet } from './PolicySheet';
import { IdleModal, Modal, type ModalAction } from './Modal';
import styles from './JejuFillme.module.css';

type Screen = 'intro' | 'capture' | 'info' | 'analyzing' | 'result';
/** 촬영이 끝난 뒤 어디로 — 처음 촬영이면 정보 입력, 재촬영이면 곧바로 재분석. */
type After = 'info' | 'analyze';

interface Shot {
  blob: Blob;
  url: string;
}

type ModalState =
  | { kind: 'recapture'; hands: Hand[] }
  | { kind: 'error'; error: ApiError }
  | null;

interface Props {
  controller: KioskController;
}

const HANDS: Hand[] = ['left', 'right'];
const EMPTY_NUMS: Record<FieldKey, string> = { age: '', height: '', weight: '' };
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * 헤더 제목·설명. 제주의 다른 화면과 같은 자리(JejuHeader)에 그려진다.
 *
 * 한국어 그대로인 이유는 파일 머리말과 같다 — 이 기능의 문구는 아직 시트에 없다.
 * 시트에 올릴 때는 다른 화면처럼 여기 제목이 `screenTitle` 의 키가 된다.
 */
/*
 * 화면 머리말 — [기능 이름, 그 화면의 설명 한 줄]. 둘 다 시트 KEY 다.
 *
 * 설명 줄은 시트의 Fillme_subtitle1·2·3·5 가 다섯 화면에 하나씩 대응한다.
 * subtitle4 가 없는 것은 실수다: 시트가 Fillme_subtitle3 을 두 번 쓰는 바람에
 * (정보 입력 "정확한 분석을 위해…" 와 분석 중 "잠시만 기다려 주세요") 뒤엣것이
 * 앞엣것을 덮어 정보 입력 줄이 통째로 사라졌다. 그래서 정보 화면만 아직 없는
 * Fillme_subtitle4 를 읽고, 시트가 그 줄을 만들기 전까지는 authored 한국어로
 * 버틴다 — sheetText 가 키가 생기는 순간 저절로 시트를 따른다.
 */
const TITLE_KEY = 'Fillme_title';
const SUBTITLE_KEY: Record<Screen, string> = {
  intro: 'Fillme_subtitle1',
  capture: 'Fillme_subtitle2',
  info: 'Fillme_subtitle4',
  analyzing: 'Fillme_subtitle3',
  result: 'Fillme_subtitle5',
};
/** 시트에 Fillme_subtitle4 가 생기면 쓰이지 않는다. */
const INFO_SUB_FALLBACK = { ko: '정확한 분석을 위해 기본 정보를 입력해 주세요' };
/* 아래 셋도 같다 — 시트에 아직 줄이 없는 모달 문구. 키 이름은 시트가 이어 쓰던
   번호를 그대로 이었다(text055 다음). */
const TIMEOUT_BODY = { ko: '분석 시간이 너무 오래 걸리고 있어요.\n잠시 후 다시 시도해 주세요.' };
const NETWORK_BODY = { ko: '인터넷 연결이 원활하지 않아요.\n잠시 후 다시 시도해 주세요.' };
const RETRY_LABEL = { ko: '다시 시도' };

export function JejuFillme({ controller }: Props): JSX.Element {
  const lang = useLang();
  const [screen, setScreen] = useState<Screen>('intro');
  const [phase, setPhase] = useState<CapturePhase>('loading');
  const [captureHands, setCaptureHands] = useState<Hand[]>(HANDS);
  const [currentHand, setCurrentHand] = useState<Hand>('left');
  const [count, setCount] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [shots, setShots] = useState<Record<Hand, Shot | null>>({ left: null, right: null });
  const [info, setInfo] = useState<InfoValues>({ nums: EMPTY_NUMS, sex: null, pregnant: null });
  /**
   * 정보 입력 화면 안의 동의 한 줄 (Figma 7212:66381 / 7334:54219). 이 흐름의 유일한
   * 동의다 — 체크해야 '다음으로' 가 열리고, 누르면 곧바로 분석을 시작한다.
   */
  const [infoAgreed, setInfoAgreed] = useState(false);
  const [keypad, setKeypad] = useState<FieldKey | null>(null);
  const [policy, setPolicy] = useState<ConsentKey | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [share, setShare] = useState<ShareState>({ status: 'off' });
  const [idleLeft, setIdleLeft] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraRef = useRef(new NailCamera(FILLME_CAMERA_MODE));
  /** 촬영 루프 세대 — 값이 바뀌면 진행 중이던 루프가 스스로 멈춘다. */
  const runRef = useRef(0);
  /** 분석 세대 — 늦게 도착한 응답이 새 세션의 화면을 덮어쓰지 못하게 한다. */
  const sessionRef = useRef(0);
  const shareRunRef = useRef(0);
  const shotsRef = useRef(shots);
  const infoRef = useRef(info);
  const afterRef = useRef<After>('info');
  const progressTimer = useRef<number | undefined>(undefined);
  const [pendingRun, setPendingRun] = useState(0);

  shotsRef.current = shots;
  infoRef.current = info;

  const goHome = useCallback((): void => controller.navigate('home', '홈'), [controller]);

  const stopProgress = useCallback(() => {
    window.clearInterval(progressTimer.current);
    progressTimer.current = undefined;
  }, []);

  const replaceShots = useCallback((next: Record<Hand, Shot | null>) => {
    for (const hand of HANDS) {
      const old = shotsRef.current[hand];
      if (old && old !== next[hand]) URL.revokeObjectURL(old.url);
    }
    shotsRef.current = next;
    setShots(next);
  }, []);

  const resetAll = useCallback(() => {
    runRef.current += 1;
    sessionRef.current += 1;
    cameraRef.current.stop();
    stopProgress();
    replaceShots({ left: null, right: null });
    setInfo({ nums: EMPTY_NUMS, sex: null, pregnant: null });
    setInfoAgreed(false);
    setKeypad(null);
    setPolicy(null);
    setProgress(0);
    setResult(null);
    setModal(null);
    shareRunRef.current += 1;
    setShare({ status: 'off' });
    setIdleLeft(null);
    setScreen('intro');
  }, [replaceShots, stopProgress]);

  // ───────────────────────────────── 촬영
  const startCapture = useCallback(
    (hands: Hand[], after: After) => {
      const next = { ...shotsRef.current };
      hands.forEach((h) => {
        next[h] = null;
      });
      replaceShots(next);
      afterRef.current = after;
      setCaptureHands(HANDS.filter((h) => hands.includes(h)));
      setCurrentHand(hands[0] ?? 'left');
      setModal(null);
      setKeypad(null);
      setPhase('loading');
      setScreen('capture');
      runRef.current += 1;
      setPendingRun(runRef.current);
    },
    [replaceShots],
  );

  const analyze = useCallback(async () => {
    const session = sessionRef.current;
    cameraRef.current.stop();
    setModal(null);
    setScreen('analyzing');
    stopProgress();
    setProgress(0);
    const started = performance.now();
    // 서버가 진행률을 주지 않는다 — 92%까지 점점 느리게 채우고, 응답이 오면 100으로.
    progressTimer.current = window.setInterval(() => {
      setProgress(92 * (1 - Math.exp(-(performance.now() - started) / 9000)));
    }, 120);

    const { nums, sex, pregnant } = infoRef.current;
    const m = Number(nums.height) / 100;
    try {
      const left = shotsRef.current.left?.blob;
      const right = shotsRef.current.right?.blob;
      // 시안은 두 장이 늘 있다고 보고 `as Blob` 으로 넘겼다. 재촬영 흐름에서 한 손만
      // 다시 찍다가 취소되면 실제로 빈 칸이 생길 수 있어, 여기서 오류로 돌린다.
      if (!left || !right) throw new ApiError('server', 'missing-shot');
      const results = await analyzeGuest(
        {
          age: Number(nums.age),
          sex: sex as Sex,
          bmi: Math.round((Number(nums.weight) / (m * m)) * 10) / 10,
          pregnant: sex === 'female' ? pregnant : null,
        },
        left,
        right,
      );
      if (session !== sessionRef.current) return;
      stopProgress();
      if (needsRecapture(results)) {
        const hands = HANDS.filter((h) => results.recapture.some((r) => String(r).startsWith(h)));
        const targets = hands.length ? hands : HANDS;
        // 모달(7334:84658)은 인식한 손톱 수를 그리지 않는다 — 운영에서 볼 수 있게 남긴다.
        console.warn('[fillme] recapture needed', { hands: targets, detected: results.detectedFingers });
        setModal({ kind: 'recapture', hands: targets });
        return;
      }
      setProgress(100);
      await sleep(700);
      if (session !== sessionRef.current) return;
      setResult({ ...results, checkDate: results.checkDate ?? new Date().toISOString() });
      setScreen('result');
    } catch (e) {
      stopProgress();
      if (session !== sessionRef.current) return;
      const error = e instanceof ApiError ? e : new ApiError('server', String(e));
      // 모달(7334:84538)은 상태·코드 줄을 그리지 않는다 — 원인은 로그에 남긴다.
      console.error('[fillme] analysis failed', { kind: error.kind, status: error.status, code: error.code, error });
      setModal({ kind: 'error', error });
    }
  }, [stopProgress]);

  // ───────────────────────────────── 결과 QR(휴대폰으로 받기)
  // 결과가 나오면 결과 이미지를 그려 admin-be 에 올리고, 돌려받은 주소를 QR 로 띄운다.
  const makeShare = useCallback(async (target: AnalysisResult) => {
    if (!FILLME_CONFIG.share.enabled) return;
    const run = ++shareRunRef.current;
    setShare({ status: 'loading' });
    try {
      const link = await createShare(await renderResultImage(target, lang));
      if (run === shareRunRef.current) setShare({ status: 'ready', link });
    } catch (e) {
      console.error('[fillme] share failed', e);
      if (run === shareRunRef.current) setShare({ status: 'error' });
    }
  }, [lang]);

  useEffect(() => {
    if (result) void makeShare(result);
  }, [result, makeShare]);

  /** 준비 → 카운트다운 → 촬영 → 완료 표시를 손마다 반복한다(버튼 없음). */
  const runCapture = useCallback(
    async (run: number, hands: Hand[]) => {
      const cancelled = (): boolean => run !== runRef.current;
      const camera = cameraRef.current;
      for (const hand of hands) {
        if (shotsRef.current[hand]) continue;
        setCurrentHand(hand);
        camera.setDemoHand(hand);
        setPhase('prepare');
        await sleep(FILLME_CONFIG.prepareSeconds * 1000);
        if (cancelled()) return;

        for (let n = FILLME_CONFIG.countdownSeconds; n > 0; n--) {
          setCount(n);
          setPhase('countdown');
          await sleep(1000);
          if (cancelled()) return;
        }

        setFlashKey((k) => k + 1);
        let blob: Blob;
        try {
          blob = await camera.capture(FILLME_CONFIG.maxImageBytes);
        } catch (e) {
          console.error('[fillme] capture failed', e);
          if (!cancelled()) setPhase('error');
          return;
        }
        if (cancelled()) return;
        replaceShots({ ...shotsRef.current, [hand]: { blob, url: URL.createObjectURL(blob) } });
        setPhase('done');
        await sleep(FILLME_CONFIG.shotDoneSeconds * 1000);
        if (cancelled()) return;
      }
      camera.stop();
      if (afterRef.current === 'analyze') void analyze();
      else setScreen('info');
    },
    [analyze, replaceShots],
  );

  const openCamera = useCallback(
    async (run: number, hands: Hand[]) => {
      setPhase('loading');
      try {
        const video = videoRef.current;
        if (!video) throw new Error('video-missing');
        await cameraRef.current.start(video);
        if (run !== runRef.current) return;
        void runCapture(run, hands);
      } catch (e) {
        console.error('[fillme] camera start failed', e);
        if (run === runRef.current) setPhase('error');
      }
    },
    [runCapture],
  );

  // 촬영 화면이 그려진 뒤(video 가 붙은 뒤) 카메라를 연다.
  useEffect(() => {
    if (!pendingRun || screen !== 'capture' || pendingRun !== runRef.current) return;
    void openCamera(pendingRun, captureHands);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRun]);

  // ───────────────────────────────── 입력
  const setNum = (key: FieldKey, raw: string): void => {
    const value = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 3);
    setInfo((prev) => ({ ...prev, nums: { ...prev.nums, [key]: value } }));
  };

  const pressKey = (key: string): void => {
    if (!keypad) return;
    const current = info.nums[keypad];
    setNum(keypad, key === 'back' ? current.slice(0, -1) : current + key);
  };

  const nextField = (): void => {
    if (!keypad) return;
    const next = FIELD_ORDER[FIELD_ORDER.indexOf(keypad) + 1];
    setKeypad(next ?? null);
  };


  // ───────────────────────────────── 무입력
  // 입력을 받는 화면과 결과 화면에서만 센다. 모달을 띄운 채 자리를 떠나도 홈으로
  // 돌아가도록 모달이 있으면 센다.
  const idleLimit =
    screen === 'result'
      ? FILLME_CONFIG.resultIdleSeconds
      : screen === 'capture' || screen === 'info' || modal
        ? FILLME_CONFIG.idleSeconds
        : null;
  const idleActive = idleLimit != null;

  useEffect(() => {
    if (idleLimit == null) {
      setIdleLeft(null);
      return;
    }
    setIdleLeft(idleLimit);
    const timer = window.setInterval(() => {
      setIdleLeft((left) => (left == null ? null : left - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [idleActive, idleLimit, screen]);

  useEffect(() => {
    if (idleLeft == null || idleLeft > 0) return;
    // 사진·입력값을 먼저 버리고 홈으로. 언마운트 정리도 같은 일을 하지만, 버리는
    // 것이 이 타이머의 존재 이유라 순서를 코드에 드러내 둔다.
    resetAll();
    goHome();
  }, [idleLeft, resetAll, goHome]);

  const poke = (): void => setIdleLeft(idleLimit);

  // 화면을 떠날 때(홈·뒤로·전체 무입력 복귀 무엇이든) 카메라를 끄고 사진을 버린다.
  useEffect(
    () => () => {
      cameraRef.current.stop();
      window.clearInterval(progressTimer.current);
      for (const hand of HANDS) {
        const shot = shotsRef.current[hand];
        if (shot) URL.revokeObjectURL(shot.url);
      }
    },
    [],
  );

  // ───────────────────────────────── 화면
  /** 헤더·레일의 뒤로. 첫 화면에서는 키오스크 홈으로 나간다. */
  const back = (): void => {
    if (screen === 'info') startCapture(HANDS, 'info');
    else if (screen === 'intro') goHome();
    else resetAll();
  };

  const title = tx(TITLE_KEY, lang);
  const subtitle =
    screen === 'info'
      ? sheetText(SUBTITLE_KEY.info, lang, INFO_SUB_FALLBACK)
      : tx(SUBTITLE_KEY[screen], lang);
  const shotUrls = { left: shots.left?.url ?? null, right: shots.right?.url ?? null };

  /* 모달의 막대: 이 화면이 처음으로 돌아가기까지 남은 시간 (모달이 떠 있으면 무입력
     타이머가 돈다 — idleLimit). */
  const modalTimeLeft = idleLeft != null && idleLimit ? idleLeft / idleLimit : 1;
  let modalView: JSX.Element | null = null;
  if (modal?.kind === 'recapture') {
    const hands = modal.hands;
    modalView = (
      <Modal
        art="retake"
        secondary="plain"
        timeLeft={modalTimeLeft}
        title={tx('Fillme_text047', lang)}
        /* 어느 손을 다시 찍어야 하는지는 시트 문장이 정한다 — 예전에는 손 이름을
           문장에 끼워 넣었지만 조사가 언어마다 달라 옮길 수가 없다. */
        body={tLines('Fillme_text048', lang).join('\n')}
        actions={[
          { label: tx('Fillme_text049', lang), onClick: resetAll },
          { label: tx('Fillme_text050', lang), primary: true, onClick: () => startCapture(hands, 'analyze') },
        ]}
      />
    );
  } else if (modal?.kind === 'error') {
    const e = modal.error;
    const transient = e.kind === 'network' || e.kind === 'timeout';
    /* 시트가 주는 것은 일반 실패 한 줄(Fillme_text046)뿐이다. 시간 초과·네트워크
       두 경우는 아직 줄이 없어 authored 한국어로 남는다 — 키가 생기면 sheetText 가
       바로 시트를 따른다. */
    const body =
      e.kind === 'timeout'
        ? sheetText('Fillme_text056', lang, TIMEOUT_BODY)
        : e.kind === 'network'
          ? sheetText('Fillme_text057', lang, NETWORK_BODY)
          : tLines('Fillme_text046', lang).join('\n');
    const actions: ModalAction[] = [
      { label: tx('Fillme_text049', lang), onClick: resetAll },
      transient
        ? { label: sheetText('Fillme_text058', lang, RETRY_LABEL), primary: true, onClick: () => void analyze() }
        : { label: tx('Fillme_text050', lang), primary: true, onClick: () => startCapture(HANDS, 'analyze') },
    ];
    modalView = (
      <Modal
        art="alert"
        secondary="solid"
        timeLeft={modalTimeLeft}
        title={tx('Fillme_text045', lang)}
        body={body}
        actions={actions}
      />
    );
  }

  const showIdle = idleLeft != null && idleLeft <= FILLME_CONFIG.idleWarningSeconds && idleLeft > 0;

  return (
    <JejuPageFrame
      controller={controller}
      title={title}
      subtitle={subtitle}
      onBack={back}
      /* 본문이 y3267 을 넘지 않는 화면에만 배너가 들어간다 — 다른 제주 화면과 같은
         규칙. 정보 입력(본문 …2577, 시안 7212:66381) · 분석 중(카드 …2803, 7334:54793)
         · 결과(버튼 줄 …3037, 7334:83586) · 촬영(미리보기 …3135, 7334:84998)은
         2026-09-16 개편으로 배너가 들어왔다 — 이제 모든 화면에 들어간다. */
      showBanner
      /* 분석 중에는 떠날 수 없다: 홈 한 번에 이미 동의하고 보낸 사진 두 장이 버려진다. */
      navDisabled={screen === 'analyzing'}
    >
      <div
        className={styles.root}
        onPointerDownCapture={poke}
        onKeyDownCapture={poke}
        onContextMenu={(e) => e.preventDefault()}
      >
        {screen === 'intro' && <FillmeIntro onStart={() => startCapture(HANDS, 'info')} />}
        {screen === 'capture' && (
          <FillmeCapture
            videoRef={videoRef}
            phase={phase}
            hands={captureHands}
            current={currentHand}
            shots={shotUrls}
            count={count}
            flashKey={flashKey}
            onRetryCamera={() => {
              runRef.current += 1;
              void openCamera(runRef.current, captureHands);
            }}
          />
        )}
        {screen === 'info' && (
          <FillmeInfo
            values={info}
            focused={keypad}
            agreed={infoAgreed}
            onFocusField={setKeypad}
            onSex={(sex) => {
              setKeypad(null);
              setInfo((prev) => ({ ...prev, sex, pregnant: sex === 'female' ? prev.pregnant : null }));
            }}
            onPregnant={(value) => setInfo((prev) => ({ ...prev, pregnant: value }))}
            onToggleAgree={() => {
              setKeypad(null);
              setInfoAgreed((prev) => !prev);
            }}
            /* 줄 안의 [개인보호정책] — 방침 전문을 연다. */
            onOpenPolicy={() => setPolicy('privacy')}
            onRetake={() => startCapture(HANDS, 'info')}
            /* 동의 화면을 거치지 않고 곧바로 분석한다 (2026-09-17, 파일 머리말). */
            onNext={() => {
              if (infoValid(info) && infoAgreed) {
                setKeypad(null);
                void analyze();
              }
            }}
          />
        )}
        {screen === 'analyzing' && <FillmeAnalyzing progress={progress} />}
        {screen === 'result' && result && (
          <FillmeResult
            result={result}
            share={share}
            onRetryShare={() => void makeShare(result)}
            onHome={resetAll}
          />
        )}

        {keypad && screen === 'info' && (
          <Keypad field={keypad} onKey={pressKey} onNext={nextField} onClose={() => setKeypad(null)} />
        )}
        {/* 읽기만 하는 창 (7334:54335) — 동의는 화면의 체크로만 받는다. */}
        {policy && <PolicySheet target={policy} onClose={() => setPolicy(null)} />}
        {modalView}
        {showIdle && (
          <IdleModal
            remaining={idleLeft ?? 0}
            total={FILLME_CONFIG.idleWarningSeconds}
            onContinue={poke}
            onReset={resetAll}
          />
        )}
      </div>
    </JejuPageFrame>
  );
}
