# 키오스크 앱 구조 (Electron 입문자용)

이 문서는 **TypeScript·React 는 알지만 Electron 은 처음인 사람**이 이 저장소의 코드를 읽고 고칠 수 있게 쓴 안내서다.
Electron 개념을 먼저 짧게 설명하고, 그것이 이 코드의 어디에 해당하는지 바로 짚는다.
세부 동작은 코드가 정본이다. 문서와 코드가 다르면 코드를 믿고 이 문서를 고친다.

- 관련 문서: [AUTO_UPDATE.md](AUTO_UPDATE.md)(자동 업데이트·릴리스) · [UPDATE_COMMAND_API.md](UPDATE_COMMAND_API.md)(원격 "지금 업데이트") · [FOOTFALL.md](FOOTFALL.md)(유동인구 계수)

---

## 1. Electron 의 네 가지 핵심

### 1-1. 프로세스가 셋이다 — main · preload · renderer

Electron 앱은 **Node.js 프로그램(main)** 이 **크롬 창(renderer)** 을 띄우는 구조다.

| 프로세스 | 무엇인가 | 할 수 있는 것 | 이 저장소 |
|---|---|---|---|
| **main** | 앱 전체에 하나. Node.js 그대로 | 파일·DB·네트워크·하드웨어·창 만들기·OS 작업 | `src/main/` |
| **renderer** | 창마다 하나. 브라우저 탭과 같다 | React 화면. **Node·파일·DB 에 직접 접근 불가** | `src/renderer/`, `src/layouts/` |
| **preload** | renderer 가 뜨기 직전에 도는 다리 | main 의 기능 중 **허락한 것만** `window.api` 로 열어 준다 | `src/preload/index.ts` |

왜 나눠 두나: 화면(웹 기술)이 해킹되거나 버그가 나도 PC 전체를 건드리지 못하게 하기 위해서다.
이 앱은 `contextIsolation: true`, `nodeIntegration: false` 로 이 경계를 지킨다(`src/main/windows/windowConfig.ts`).

> 판단 기준: **"이 코드가 파일·DB·하드웨어·서버 비밀키를 쓰나?" → main.** 화면에 그리는 것만이면 renderer.
> 서버 API 호출도 거의 전부 main 에서 한다(캐시·오프라인·재시도가 main 에 있기 때문).

### 1-2. IPC — 프로세스끼리 말하는 방법

renderer 는 main 의 함수를 직접 부를 수 없다. 대신 **채널 이름으로 메시지**를 보낸다.

```
renderer: await window.api.shops.list()          ← preload 가 열어 준 함수
   → preload: ipcRenderer.invoke('shops:list')
      → main: handle('shops:list', () => shopService.list())   ← 결과를 Result 로 감싸 돌려줌
```

- 채널 이름: `src/shared/ipc/channels.ts` (`IpcChannels` = 요청/응답, `IpcEvents` = main → 화면 알림)
- 요청·응답 타입: `src/shared/ipc/contracts.ts`
- `window.api` 의 모양(타입): `src/shared/ipc/bridge.ts`
- main 쪽 처리기: `src/main/ipc/handlers/*.handlers.ts` (등록은 `src/main/ipc/registry.ts` 의 `handle()` 로만)

**새 기능을 화면에서 쓰게 하려면 다섯 곳을 같이 고친다:** 채널 이름 → 계약 타입 → bridge 타입 → preload 래퍼 → main 처리기.
main 이 화면에 알려야 할 때(예: 상점 목록이 새로 왔다)는 `IpcEvents` 로 방송하고 화면은 `window.api.events.on…()` 으로 받는다.

### 1-3. 네이티브 모듈 — C++ 로 된 npm 패키지

`better-sqlite3`(로컬 DB)·`serialport`(카드 단말기 통신)는 C++ 로 만들어져 **Electron 버전에 맞춰 다시 컴파일**해야 한다.
`npm ci` 의 `postinstall`(`electron-builder install-app-deps`)이 자동으로 해 준다.
Electron 버전을 올리거나 이 패키지를 올릴 때 가장 잘 깨지는 곳이다.

### 1-4. 패키징·자동 업데이트

- `electron-vite build` → `out/` 에 main·preload·renderer 번들
- `electron-builder` → Windows 설치 파일(NSIS)을 만들고 GitHub Release 에 올린다
- 키오스크의 앱은 `electron-updater` 로 GitHub Release 를 보고 스스로 업데이트한다
- 자세한 것은 §6.

---

## 2. 폴더 지도

```
src/
  main/            Node 쪽. index.ts(시작) · container.ts(서비스 조립) · windows/ · ipc/ · services/ · core/ · updater/ · database/
  preload/         window.api 를 여는 다리
  renderer/        화면 진입점 2개 — index.html(터치 화면, 1번 모니터) · display.html(손님용 화면, 2번 모니터)
    src/           store/(zustand) · hooks/ · lib/ · features/display/(2번 모니터) · data/(시트에서 생성된 기본값)
  layouts/         지점별 화면 — insadong · osan · hwaseong · jeju · kada · photo(공통 촬영 흐름) · components
  shared/          main·renderer 가 같이 쓰는 타입·설정·IPC 계약 — config/kioskLocations.ts 가 지점표
payment-agent/     카드 단말기용 로컬 서버(별도 저장소에서 빌드해 넣은 결과물)
zed-height/        제주 키·체형 측정(Python, ZED 카메라)
resources/         mediapipe 모델·도움말 이미지(설치 파일에 포함)
themes/            지점별 색·글꼴
scripts/           빌드·시트 동기화·현장 점검 스크립트
tests/unit/        단위 테스트(Vitest)
```

경로 별칭: `@main` · `@shared` · `@renderer`(=`src/renderer/src`) · `@layouts`(=`src/layouts`). `electron.vite.config.ts`·tsconfig·`vitest.config.ts` 에 똑같이 적혀 있다.

---

## 3. 앱이 켜지는 순서 (`src/main/index.ts`)

1. `.env` 읽기(`core/env.ts`) — 개발은 저장소 루트, 설치본은 `resources/.env`. OS 환경변수가 이긴다.
2. 베타/운영 구분(`core/appIdentity.ts`) — 베타는 데이터 폴더가 따로다(`%APPDATA%\kiosk-app-beta`).
3. 로그 시작(`core/logger.ts`, electron-log, 10MB 회전) · **중복 실행 차단**(이미 떠 있으면 새 실행은 바로 끝난다).
4. 사용자 정의 주소 등록 — `media://`(영상·사진 파일), `appres://`(mediapipe·도움말).
5. 로컬 DB(SQLite) 열기 → 서비스 조립(`container.ts`) → 전원 일정 등록(`core/PowerManager.ts`).
6. 창 만들기(`windows/WindowManager.ts`) — 모니터가 2개 이상이면 손님용 화면 창을 2번 모니터에 띄운다.
7. 주기 작업 시작 — 날씨·환율·항공·선박·자막, 밤 동기화(00:00), 업데이트 확인, 카드 단말기 에이전트(단말기 있는 지점만).
8. 서버 콘텐츠 새로 받기 — 상점·버튼·배너·배경·의상·틀린그림찾기. 받으면 화면에 `IpcEvents` 로 알린다.

---

## 4. 지점(키오스크)마다 다른 것

한 빌드로 모든 지점을 돌린다. **어느 지점인지는 PC 마다 저장된 `kioskId`** 로 정한다(`%APPDATA%\kiosk-app\kiosk-config.json`, `provision-kiosk.ps1` 로 기록). 환경변수로는 바꿀 수 없다.

`src/shared/config/kioskLocations.ts` 의 표 하나가 모든 지점 차이의 출발점이다 — 화면 묶음(layout), 서버에 보낼 지역(region), 카드 단말기 유무, 좌표 등.
지점별 값을 화면 코드에 직접 적지 말고 이 표에서 꺼내 쓴다. 이 표는 `tests/unit/shared/kioskLocations.test.ts` 가 고정해 두었다.

| 코드 | 화면 묶음 | 서버 지역(region) |
|---|---|---|
| W001·W002·W003 | 인사동(`layouts/insadong`) | INSADONG_NORTH · _CENTER · _SOUTH |
| W004 | 오산 오색시장(`layouts/osan`) | OSAEK |
| W005 | 화성휴게소(`layouts/hwaseong`) | HWASEONG |
| W006·W007·W008 | 제주(`layouts/jeju`) | JEJU_AIRPORT · JEJU_PORT · JEJU_HERITAGE |
| W202 | KADA(`layouts/kada`) | 없음(서버 콘텐츠 안 받음) |

화면 이동은 라우터 라이브러리 없이 `useKioskStore.screen` 값과 `useKioskController().navigate()` 로 한다. 3분 동안 손대지 않으면 처음 화면·한국어로 돌아간다.

---

## 5. 서버·외부와 주고받는 것

- **우리 서버**: 기본 주소 `WITTERIA_API_BASE`(기본값 `https://api-v3.witteria.com`). 거의 모든 요청이 `/v2` + `region` 방식이다(상점·버튼·배너·배경·자막·틀린그림찾기·의상·코스).
  통계(메뉴 터치·촬영)는 바로 보내고, 실패하면 로컬 DB 에 쌓아 밤에 다시 보낸다(`FailedRequestService`).
- **오프라인 우선**: 받은 콘텐츠는 SQLite `local_cache` 에 저장하고, 켜질 때 그것부터 보여 준 뒤 서버에서 새로 받는다. 서버가 죽어도 마지막 내용으로 돈다.
- **외부 API**: 날씨·환율·항공·선박·AI 사진 합성·구글 시트(번역·자막)·FillMe. 키는 `.env`(설치본에 포함, 저장소에는 없음)에 있다.
- **카드 결제**: 화면이 직접 하지 않는다. 결제 웹페이지(webview)가 PC 안의 `payment-agent`(127.0.0.1)를 부르고, 그것이 시리얼로 단말기와 통신한다. main 의 `core/PaymentAgentManager.ts` 가 이 프로세스를 띄우고 죽으면 다시 띄운다.

서버 API 의 정본은 서버 Swagger 다. 서버 쪽 변경은 옛 버전 앱이 깨지지 않게(하위 호환) 먼저 하고, 앱은 그다음에 바꾼다 — 키오스크마다 업데이트 시점이 달라 옛 버전이 오래 남는다.

---

## 6. 빌드·릴리스·업데이트

| 단계 | 무엇이 일어나나 |
|---|---|
| PR(→ `dev`·`main`) / `dev_kdh` push | `ci.yml` — Windows 에서 설치·타입 검사·lint·단위 테스트·빌드. 배포는 안 한다 |
| `dev` push | `release-beta.yml` — 베타 설치 파일을 GitHub Release(prerelease)로. 베타 키오스크(`UPDATE_CHANNEL=beta`)가 15분마다 확인해 설치 |
| `main` push | `release-production.yml` — `package.json` 버전이 새것일 때만 운영 릴리스. 운영 키오스크는 매주 정해진 시각(기본 금요일 17:00)에 확인 |
| 서버의 "지금 업데이트" | 앱이 5분마다 `/api/kiosks/{번호}/update-command` 를 확인해 즉시 업데이트 확인을 돈다 |

- 업데이트는 촬영 중에는 미루고, 설치에 두 번 실패한 버전은 다시 시도하지 않는다(`src/main/updater/`).
- 설치본의 실행 설정(`.env`)은 저장소가 아니라 GitHub Environment 비밀값에서 빌드할 때 만든다.

---

## 7. 테스트·검증

| 명령 | 내용 |
|---|---|
| `npm run verify` | 타입 검사 + lint + 단위 테스트 + 빌드 — 커밋 전에 이것 하나 |
| `npm run test` / `test:watch` | Vitest 단위 테스트(`tests/unit`, Electron·화면 없이 도는 순수 로직) |
| `npm run test:e2e` | 실제 앱을 가짜 서버에 붙여 띄우는 검사(Playwright) — 지점 9곳 부팅·지역 요청·녹화에 없는 요청 0건, 인사동·오색·제주 '뭐먹지 → 상세 → 홈' |
| `npm run test:e2e:record` | 가짜 서버의 응답(`tests/e2e/fixtures/api`)을 stage 에서 다시 녹화. 쓰기 요청은 stage 로 보내지 않는다. 공개 저장소이니 커밋 전 내용 확인 |
| `npm run test:soak` | 장시간 메모리 시험(기본 30분, ffmpeg 필요) — 2번 모니터 창에서 영상을 돌리며 메인 프로세스 메모리 증가 속도를 잰다. CI 에는 없다 |
| `npm run dev` | 개발 모드로 앱 실행(창 2개, DevTools) |
| `footfall:selftest` · `camera:selftest` · `height:selftest` · `height:test` | 기존 점검 스크립트(유동인구·카메라 선택·키 측정) |

e2e 는 `src/main/core/e2e.ts` 의 시험용 스위치를 쓴다(포장되지 않은 빌드 + `KIOSK_E2E=1` 일 때만 작동 — 실행마다 새 데이터 폴더, 모니터 하나여도 2번 모니터 창, 실제 결제 에이전트 대신 건너뜀). 서버 API 가 바뀌어 앱이 새 경로를 부르면 '녹화에 없는 요청'으로 실패한다 — 그때 `test:e2e:record` 로 다시 녹화한다.

단위 테스트를 쓸 때 main 쪽 모듈이 `@main/core/logger`(Electron 의존)를 불러오면 `vi.mock` 으로 바꿔 끼운다 — `tests/unit/main/normalizeShop.test.ts` 참고.

---

## 8. 알아 두면 덜 헤매는 것

- **화면이 하얗게 되는 흔한 원인**: 서버가 타입과 다른 값(null)을 보낼 때. 상점 데이터는 `normalizeShop.ts` 가 들어오는 입구에서 막는다. 새 데이터도 같은 방식으로 입구에서 정리한다.
- **영상은 PC 의 폴더에서 읽는다**(`C:\KioskVideos\<세트>`). 자막 행의 파일 이름과 맞는 영상이 없으면 그 행은 조용히 빠진다(`renderer/src/lib/videoMap.ts`).
- **메인 프로세스가 오래 켜져 있으면 메모리가 쌓일 수 있다** — 영상 바이트가 `media://` 처리기를 지나기 때문이다. 메인 프로세스 쪽에 큰 데이터를 흘리는 코드를 추가할 때 특히 주의한다.
- **상태 보고(`src/main/core/HealthReporter.ts`)**: 실행 중 1분마다 `userData/health/run-state.json` 에 심장박동(메인 메모리 포함)을 쓰고, 정상 종료 때 "정상"으로 표시한다. 다음에 켜질 때 표시가 없으면 비정상 종료로 서버(`POST /api/kiosks/{번호}/crash-reports`)에 보고한다 — 마지막 박동 직후 PC 가 다시 켜졌으면 `SYSTEM_RESTART`, PC 는 켜져 있었으면 `APP_CRASH`, 그 사이가 10분을 넘으면 `UNKNOWN`. 화면·자식 프로세스 사망과 처리 안 된 예외도 바로 보고한다. 5분 신호(update-command)에는 버전·채널·가동 시간·메인 메모리를 `X-Kiosk-*` 헤더로 싣는다 — 서버 관리자 현황판에서 지점별로 보인다.
