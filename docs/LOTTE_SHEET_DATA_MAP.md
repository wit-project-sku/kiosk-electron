# 롯데 content sheet → screen map

Sheet: `1ZKoNbnQAtmLaY8Hx5MT1jS8su0FPXKiu9lO7TnsFNOs` (checked 2026-11-23, all 13 tabs read).
What each 롯데 screen draws today, where that comes from, and which sheet tab could replace the
hard-coded part.

Legend: **sheet** = already read from the sheet · **API** = server · **hard-coded** = in the code ·
**→ tab** = sheet data that could replace it.

## The 13 tabs

| Tab | What it holds | Rows (W011 / W012 / W013) | In the app today |
|---|---|---|---|
| `ShopData_WorldMall` · `_Cheongnyangni` · `_StarCity` | 뭐먹지 · 뭐사지 stores: name, category, floor, hashtag, description, OpenTime, Tel, NaverLink, 8 languages | 616 / 403 / 320 | **Not read.** Shops come from the shops API; the offline fallback is `lotteShops.generated.ts` (a partial copy) |
| `FacilityData_WorldMall` · `_Cheongnyangni` · `_StarCity` | 시설안내 · 화장실: name, group (`1-화장실` …), location, hours, phone, description, 8 languages | 67 / 28 / 29 | **sheet** → `lotteFacilities.ts` (화장실 page, 시설안내 list) |
| `Localization_Lotte` | UI copy **and** per-site content (`Key@W011`) | ~210 keys | **sheet** through `lt()`. About 100 keys are never read (below) |
| `Text-to-speech_Script` | 84 `Voice_*` lines | — | **sheet** → `voice-lotte.generated.ts` |
| `AICategory_Lotte` | 12 즐길 거리 for the old '롯데' 뭐하지 | 12 | Not read. The screen was removed; its last column points to `lotteVisitPlan.ts`, which no longer exists |
| `VideoSubtitle_LOCI` | AI model video subtitles | 64 | Not read. No 롯데 video screen |
| `규칙01)색상규칙` | The sheet's own colour legend | — | Not data |
| `규칙02)메인 아이콘` | Which home icon each site shows (W012/W013: 스마트 헬스케어 → **프로모션**; building icons 14–17 **(미정)**) | 26 | Design rule (see the home row below) |
| `규칙03)카테고리 정리` | Category lists per site and screen, 8 languages | 140 | The same lists ShopData/FacilityData use. Reference only |

## Screen by screen

| Screen (file) | Data on it | Source today | Sheet data to use |
|---|---|---|---|
| **Home** (`LotteHome`) | notice, tile labels, building buttons, cinema strip | **sheet** (`Home_Notice@`, `MainButton_*`, `Building_Btn*@`) · **API** (showtimes) | Weather title is hard-coded → `Weather_Title`. Per `규칙02`, W012/W013 should show **프로모션** where W011 shows 스마트 헬스케어 |
| **뭐먹지 / 뭐사지 list + 상세** (`LotteListScreen`, `LotteDetail`) | stores | **API**; offline → `lotteShops.generated.ts` | → `ShopData_*` as the offline fallback: full list with OpenTime, Tel and (W012/W013) descriptions. Today's fallback is partial. Detail labels `Open&closeTime`, `Tel` are unused |
| **화장실** (`LotteRestroom`) | buildings, floors, facility types, plan | **sheet** (`FacilityData_*`) | Labels `WC_Floor`, `WC_Map_Soon`, `WC_Hours` exist but are not read. No floor-plan data in the sheet |
| **시설안내 list** | facilities | **sheet** (`FacilityData_*`) | — |
| **건물 안내 › 핫스팟** (`LotteBuilding`, `lotteBuildingData.ts`) | facility cards | **hard-coded** (copied from Figma A-07) | → `FacilityData_*`. **W012/W013:** every card (롯데문화센터, 샤롯데가든, 테라스가든, 킨더라운지, Tax Refund, 에비뉴엘 오렌지 라운지, 유아휴게실, 푸드에비뉴, 롯데웨딩센터, 시네마) is a FacilityData row, with location, hours, phone and description in 8 languages. **W011:** 롯데시네마, 롯데월드 아쿠아리움, 서울스카이 are rows (no hours yet); 롯데콘서트홀, 롯데마트, 롯데하이마트, 시그니엘 서울, 롯데월드 어드벤처 are not in the sheet. Tab labels → `Building_Tab_Event` / `_Hotspot`, `Building_Select`, `Hotspot_Location`, `Hotspot_Hours` |
| **건물 안내 › 이벤트** (`lotteBuildingData.ts`) | event cards | **hard-coded**, all 예시 | **No tab.** Needs an events tab or API |
| **롯데 이벤트** (`LotteEvents`) | 6 events | **hard-coded** `LOTTE_SAMPLE_EVENTS`, all 예시 | **No tab.** Filter labels → `Event_Filter_Show/_Exhibit/_Etc`, empty state → `Event_None` |
| **여기는 롯데** (`LotteAbout`) | about, history, sights, nearby | **sheet** (`Here_About@`, `Here_History_n@`, `Here_Sight_n_*@`, `Here_Nearby_n_*@`) | Already wired. The hard-coded `ABOUT` list in `lotteSample.ts` is only a fallback. `Here_Facility_Info@` / `Here_Usage_Info@` are read but **missing from the sheet** |
| **안녕 로씨** (`LotteHello`) | profile, hobbies, health | **sheet** (`Hello_*`, `Hobby_*`, `Health_*`) | — |
| **롯데시네마** (`LotteCinema`) | showtimes | **API** + **sheet** labels | Rating badges are hard-coded → `Cinema_Rating_All/12/15/18`. `Cinema_Hall`, `Cinema_RunTime` unused |
| **영화 전후 코스** (`LotteMovieCourse`, `lotteCoursePlan.ts`) | stops, hours | **API** (shops/showtimes) + some **sheet** labels | Shop hours → `ShopData_* OpenTime` (when the API lacks them). Many labels hard-coded → `Course_PickMovie`, `Course_FreeTime`, `Course_Arrive`, `Course_Stay`, `Course_OpenNow`, `Course_Walk`, `Course_Enter`, `Course_QR`, `Course_None`, `Course_When_Before/After/Both` |
| **영화 나눔** (`LotteMovieShare`) | count, steps | **API** + **sheet** (`FilmShare_*`) | `FilmShare_Frame`, `FilmShare_Certificate` unused. (`Cinema_Donation_*` duplicate `FilmShare_*` — not needed) |
| **오늘의 사연** (`LotteStories`) | stories | **API** + **sheet** (`Story_*`) | `Story_Step1-3`, `Story_Consent`, `Story_From`, `Story_KioskOnly` unused |
| **미션** (`LotteMission`, `lotteMissions.ts`) | missions | **hard-coded** (M-01~04 frames) | **No tab.** Labels → `Mission_Stamp/_Shopping/_Photo`, `Mission_Step1-3`, `Mission_Start`, `Building_Tab_Mission` |
| **Site facts** (`lotteSite` in `lotteSample.ts`) | site title, branch, hours, building names | **hard-coded** | Partly in the sheet: `Cinema_Name@`, `Building_Btn*@`, `Home_Notice@`. Opening hours per site are not in the sheet (FacilityData rows carry `Mon~Sun 10:30-20:00`) |

## What to do with it

1. **핫스팟 from FacilityData** — the biggest win: W012/W013 drop their hard-coded cards and gain
   hours, phone, description and 7 more languages; W011 keeps photos and fills the rest by name.
   The sheet needs W011's missing rows (롯데콘서트홀 · 롯데마트 · 롯데하이마트 · 시그니엘 서울 ·
   롯데월드 어드벤처) and hours for 롯데시네마 / 아쿠아리움 / 서울스카이.
2. **Offline shop fallback from ShopData** — replace the partial `lotteShops.generated.ts` with the
   three ShopData tabs through `npm run sync:sheet -- --only=lotte`.
3. **Unread labels** — wire the ~40 existing keys listed above (cinema ratings, course, events,
   restroom, missions, stories) so the screens translate.
4. **Not in the sheet at all** — 이벤트 (both screens), 미션, floor plans, per-site opening hours. These
   need a tab (or the API) before they can stop being hard-coded.
