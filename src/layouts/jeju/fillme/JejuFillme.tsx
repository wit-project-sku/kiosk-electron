/**
 * 제주 AI 손톱 건강분석 (screen `fillme`) — FillMe(주식회사 링커버스) 손톱분석을
 * 제주 키오스크 안에서 직접 그린다. 웹뷰가 아니라 앱이 그리는 화면이다.
 *
 * 흐름(샘플 앱 kiosk.js 와 같은 순서·규칙, fillme-jeju-prototype 을 거쳐 옮겼다):
 *   시작 → 손톱 촬영(왼손·오른손 자동) → 정보 입력 → 개인정보 동의 → AI 분석 중 → 결과
 * 촬영 사진은 '분석 시작'(동의) 전까지 기기 메모리에만 있고 서버로 보내지 않는다.
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
import { FILLME_CONFIG, FILLME_CAMERA_MODE, CHILD_AGE } from './config';
import { ApiError, analyzeGuest, needsRecapture, type AnalysisResult, type Hand, type Sex } from './api';
import { NailCamera } from './camera';
import { CONSENT_KEYS, FIELD_ORDER, HAND_LABEL, type ConsentKey, type FieldKey } from './copy';
import { createShare, type ShareState } from './share';
import { renderResultImage } from './shareImage';
import { FillmeIntro } from './FillmeIntro';
import { FillmeCapture, type CapturePhase } from './FillmeCapture';
import { FillmeInfo, infoValid, fieldValid, type InfoValues } from './FillmeInfo';
import { FillmeConsent } from './FillmeConsent';
import { FillmeAnalyzing } from './FillmeAnalyzing';
import { FillmeResult } from './FillmeResult';
import { Keypad } from './Keypad';
import { PolicySheet } from './PolicySheet';
import { IdleModal, Modal, type ModalAction } from './Modal';
import styles from './JejuFillme.module.css';

type Screen = 'intro' | 'capture' | 'info' | 'consent' | 'analyzing' | 'result';
/** 촬영이 끝난 뒤 어디로 — 처음 촬영이면 정보 입력, 재촬영이면 곧바로 재분석. */
type After = 'info' | 'analyze';

interface Shot {
  blob: Blob;
  url: string;
}

type ModalState =
  | { kind: 'recapture'; hands: Hand[]; chips: string[] }
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
const TITLES: Record<Screen, [string, string]> = {
  intro: ['AI 손톱 건강분석', 'FillMe와 함께하는 손톱 건강 체크 서비스예요'],
  capture: ['손톱 촬영', '안내에 따라 왼손, 오른손 순서로 올려 주세요'],
  /* 시안 7212:66381 은 이 화면의 제목을 기능 이름으로 적는다(검색창 자리의
     "AI 손톱 건강 분석"). 설명문은 시안이 자리만 잡아 둔 "페이지 설명문" 이라 쓰던
     문장을 그대로 둔다. */
  info: ['AI 손톱 건강 분석', '정확한 분석을 위해 기본 정보를 입력해 주세요'],
  consent: ['개인정보 이용 동의', '동의해야 분석을 시작할 수 있어요'],
  analyzing: ['AI 분석 중', '잠시만 기다려 주세요'],
  result: ['AI 건강분석 결과', '나에게 맞는 영양 관리 방법을 확인해 보세요'],
};

export function JejuFillme({ controller }: Props): JSX.Element {
  const [screen, setScreen] = useState<Screen>('intro');
  const [phase, setPhase] = useState<CapturePhase>('loading');
  const [captureHands, setCaptureHands] = useState<Hand[]>(HANDS);
  const [currentHand, setCurrentHand] = useState<Hand>('left');
  const [count, setCount] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [shots, setShots] = useState<Record<Hand, Shot | null>>({ left: null, right: null });
  const [info, setInfo] = useState<InfoValues>({ nums: EMPTY_NUMS, sex: null, pregnant: null });
  const [agree, setAgree] = useState<Record<ConsentKey, boolean>>({ privacy: false, sensitive: false });
  /**
   * 정보 입력 화면 안의 동의 한 줄 (Figma 7212:66381 / 7334:54219). 다음 화면의
   * 법정 동의 두 가지와 별개다 — 여기서는 '다음으로' 를 여는 문지기일 뿐이고,
   * 개인정보·민감정보 동의는 그대로 동의 화면에서 받는다. FillmeInfo 머리말 참고.
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
    setAgree({ privacy: false, sensitive: false });
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
        const detected = results.detectedFingers ?? {};
        const targets = hands.length ? hands : HANDS;
        setModal({
          kind: 'recapture',
          hands: targets,
          chips: targets.map((h) => `${HAND_LABEL[h]} 손톱 ${Number(detected[`${h}_hand`]) || 0}개 인식`),
        });
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
      setModal({ kind: 'error', error: e instanceof ApiError ? e : new ApiError('server', String(e)) });
    }
  }, [stopProgress]);

  // ───────────────────────────────── 결과 QR(휴대폰으로 받기)
  // 결과가 나오면 결과 이미지를 그려 admin-be 에 올리고, 돌려받은 주소를 QR 로 띄운다.
  const makeShare = useCallback(async (target: AnalysisResult) => {
    if (!FILLME_CONFIG.share.enabled) return;
    const run = ++shareRunRef.current;
    setShare({ status: 'loading' });
    try {
      const link = await createShare(await renderResultImage(target));
      if (run === shareRunRef.current) setShare({ status: 'ready', link });
    } catch (e) {
      console.error('[fillme] share failed', e);
      if (run === shareRunRef.current) setShare({ status: 'error' });
    }
  }, []);

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

  const allAgreed = CONSENT_KEYS.every((k) => agree[k]);

  // ───────────────────────────────── 무입력
  // 입력을 받는 화면과 결과 화면에서만 센다. 모달을 띄운 채 자리를 떠나도 홈으로
  // 돌아가도록 모달이 있으면 센다.
  const idleLimit =
    screen === 'result'
      ? FILLME_CONFIG.resultIdleSeconds
      : screen === 'capture' || screen === 'info' || screen === 'consent' || modal
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
    if (screen === 'consent') setScreen('info');
    else if (screen === 'info') startCapture(HANDS, 'info');
    else if (screen === 'intro') goHome();
    else resetAll();
  };

  const [title, subtitle] = TITLES[screen];
  const shotUrls = { left: shots.left?.url ?? null, right: shots.right?.url ?? null };

  let modalView: JSX.Element | null = null;
  if (modal?.kind === 'recapture') {
    const target = modal.hands.map((h) => HAND_LABEL[h]).join('과 ');
    const hands = modal.hands;
    modalView = (
      <Modal
        icon="retry"
        tone="orange"
        title="손톱이 충분히 보이지 않았어요"
        body={`손가락 3개 이상이 선명하게 보이도록\n${target}을 다시 촬영해 주세요`}
        chips={modal.chips}
        actions={[
          { label: '처음으로', onClick: resetAll },
          { label: '다시 촬영하기', primary: true, onClick: () => startCapture(hands, 'analyze') },
        ]}
      />
    );
  } else if (modal?.kind === 'error') {
    const e = modal.error;
    const transient = e.kind === 'network' || e.kind === 'timeout';
    const body =
      e.kind === 'timeout'
        ? '분석 시간이 너무 오래 걸리고 있어요.\n잠시 후 다시 시도해 주세요.'
        : e.kind === 'network'
          ? '인터넷 연결이 원활하지 않아요.\n잠시 후 다시 시도해 주세요.'
          : '사진을 분석하지 못했어요.\n손톱이 잘 보이도록 다시 촬영해 주세요.';
    const actions: ModalAction[] = [
      { label: '처음으로', onClick: resetAll },
      transient
        ? { label: '다시 시도', primary: true, onClick: () => void analyze() }
        : { label: '다시 촬영하기', primary: true, onClick: () => startCapture(HANDS, 'analyze') },
    ];
    modalView = (
      <Modal
        icon="alert"
        tone="red"
        title="분석을 완료하지 못했어요"
        body={body}
        detail={[e.status, (e.code ?? '').trim() || e.kind].filter(Boolean).join(' · ')}
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
         규칙. 정보 입력은 2026-09-16 개편으로 본문이 2577 에서 끝나 배너가 들어왔다
         (시안 7212:66381 도 그린다). */
      showBanner={screen === 'intro' || screen === 'info'}
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
            /* 줄 안의 [개인보호정책] — 동의 화면과 같은 방침 전문을 연다. */
            onOpenPolicy={() => setPolicy('privacy')}
            onRetake={() => startCapture(HANDS, 'info')}
            onNext={() => {
              if (infoValid(info) && infoAgreed) {
                setKeypad(null);
                setScreen('consent');
              }
            }}
          />
        )}
        {screen === 'consent' && (
          <FillmeConsent
            agree={agree}
            childAlert={fieldValid(info, 'age') && Number(info.nums.age) < CHILD_AGE}
            onToggleAll={() => setAgree({ privacy: !allAgreed, sensitive: !allAgreed })}
            onToggle={(key) => setAgree((prev) => ({ ...prev, [key]: !prev[key] }))}
            onOpenPolicy={setPolicy}
            onAnalyze={() => {
              if (allAgreed && infoValid(info)) void analyze();
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
            onRetake={() => startCapture(HANDS, 'info')}
          />
        )}

        {keypad && screen === 'info' && (
          <Keypad field={keypad} onKey={pressKey} onNext={nextField} onClose={() => setKeypad(null)} />
        )}
        {/* 읽기만 하는 창 (7334:54335) — 동의는 화면의 체크로만 받는다. */}
        {policy && <PolicySheet target={policy} onClose={() => setPolicy(null)} />}
        {modalView}
        {showIdle && <IdleModal remaining={idleLeft ?? 0} onContinue={poke} />}
      </div>
    </JejuPageFrame>
  );
}
