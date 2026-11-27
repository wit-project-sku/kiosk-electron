# 롯데 screens in other languages — UI audit (2026-11-23)

Every 롯데 screen was rendered in all 8 languages (ko · en · ja · zh · vi · th · ru · id) on the
2160 × 3840 artboard, with the bundled sheet copy and sample data. Each run was checked two ways:

- **Automatic probe:** text that is clipped or cut with "…", text that runs out of its button or
  card, text past the screen edge, and text overlapping other text.
- **By eye:** screenshots of each screen side by side (ko · en · ja · vi · th · ru).

Zero problems were found on **언어선택, 검색, 롯데시네마 and 필미**. Every other screen below has
at least one issue.

## A. Layout breaks (the design does not survive longer text)

| # | Screen | What breaks | Languages | Where |
|---|---|---|---|---|
| A1 | Home | The 4 building buttons under the skyline overlap ("LOTTE WORLD T│LOTTE WORLD MALL"). They are placed at fixed x positions sized for 3–5 Korean letters | all but ko, zh | `LotteHome` `BUILDING_X` · `.buildingBtn` |
| A2 | Home | "Расписание сеансов" (상영 시간표 board title) runs into the first showtime | ru | `LotteCinemaBoard .title` |
| A3 | Home | The top cards (뭐하지 · 위드마켓 · 이벤트) wrap to 3–4 small lines, e.g. "ロッテイベン/ト", "Sự kiện/LOTTE" | ja, vi, th, ru, id | `LotteHome .cardTitle` |
| A4 | Home | Tile subtitles sit 6px below their tile, and "Рестораны" sits 40px below | all; ru worst | `LotteHome .tileSub` |
| A5 | Home ♿ | The 7-icon row's labels run into each other ("今日のストーリー", "ロッテで何食べる"). Each label is one line in a 260px column with 261px between columns | en, ja, vi, th, ru, id | `.tileTextLow` |
| A6 | 화장실 | Every facility-type chip but the shortest is cut with "…" ("Customer S…", "修理・アフ…"), and some overlap their neighbour | all but ko, zh | `LotteRestroom .kind` (340 wide, one line) |
| A7 | 시설안내 list | Category chips overflow or overlap ("Culture·Convenience" +141px over "Medical"); in th they wrap to 3 lines | en, ja, th, ru, id | `lotteContent .cat` |
| A8 | 여기는 롯데 | Sight/nearby descriptions are cut after 2 lines with "…" | en, ja, vi, th, ru, id | `.placeTag` line clamp |
| A9 | 안녕 로씨 | The profile label column is too narrow: "Специальность", "สถานที่เกิด" wrap to 2–3 lines and push the rows apart | th, ru | `LotteHello` label column |

### Status (2026-11-23)

A1, A2, A5, A6 and A7 are fixed and re-checked in all 8 languages: the probe reports no clipping,
escaping text or overlap on 화장실, 시설안내, 뭐먹지, 뭐사지, and no overlap on the home screens.
Korean renders pixel-identical to before. How:
- **A1:** in other languages the 건물 단추 are centred on Korean's centres, capped to the space
  between neighbours, wrap to two lines, then shrink as one group.
- **A2:** in other languages the board title gets a 265 × 150 slot that wraps, then shrinks.
- **A5:** the ♿ labels are 244 wide (an 18px gutter) and two lines tall, then shrink.
- **A6, A7:** the chips wrap between words, never inside one; Japanese and Chinese stay whole and
  the row shrinks instead.

A3 now breaks Japanese at phrases (`word-break: auto-phrase`); the cards already shrank to fit.
A4 needs no change: the label ends 6–40px below an invisible button edge, with nothing drawn
there. Japanese 건물 단추 names (ロッテワールドタワー) still split mid-word: one 10-letter word
does not fit a 308px button even at the smallest size.

## B. Text that stays Korean (or English) in every language

The layout holds, but a non-Korean visitor still reads Korean.

| # | Screen | Untranslated text | Cause |
|---|---|---|---|
| B1 | 뭐먹지 · 뭐사지 · 시설안내 · 뭐하지 · 이벤트 | Page title ("'롯데' 뭐먹지?", "롯데 시설안내", "'롯데' 뭐하지", "롯데 이벤트") | The title is a Korean id that `screenTitle()` has no entry for; the sheet has `MainButton_ToEat/ToBuy/ToHelp/AI/Event` |
| B2 | 상세 | Header "'롯데' 뭐먹지? > Details" is half Korean | same as B1 (`item.title`) |
| B3 | 뭐하지 · 이벤트 · 여기는 롯데 | Subtitle ("영화 전후 코스 · …", "진행 중인 행사와 …", "이곳의 시설과 볼거리를 …") | Hard-coded Korean `subtitle=` |
| B4 | 화장실 | Building tabs 월드몰 / 타워 / 에비뉴엘, and the plan text "롯데월드몰 floor plan" | Built from the Korean address |
| B5 | 화장실 · 시네마 · 목록 · 상세 | Subtitle is **English for every language** (ja, th, ru … get "Restrooms by floor.") | `const en = lang !== 'ko'` in 6 files |
| B6 | 건물 안내 (이벤트 · 핫스팟) | The whole page: title, 이벤트/핫스팟 tabs, building chips, every card | `lotteBuildingData.ts` is Korean-only; the tab labels exist in the sheet (`Building_Tab_*`) |
| B7 | 롯데 이벤트 | Title, subtitle, 전체/공연/전시/기타 filters, cards | Hard-coded (`Event_Filter_*`, `Event_None` exist in the sheet) |
| B8 | 뭐하지 | Title, subtitle, "보실 영화와 시간" heading | Hard-coded |
| B9 | 안녕 로씨 | Tabs 소개 / 취미생활 / 건강습관 | Hard-coded |
| B10 | 오늘의 사연 · 영화 나눔 | Small lines under the titles, steps and QR captions | Hard-coded |
| B11 | 여기는 롯데 | "사진 자리" photo placeholders | Hard-coded |

(Shop names, categories and addresses on the lists are Korean in this run because the sample
data copies Korean into every language. The real shops API and ShopData tabs carry translations.)

### Status (2026-11-23, part B)

B1–B11 are done. A re-run in all 8 languages finds no Korean left on any screen except data
(below), and Korean renders pixel-identical to before. The only Korean differences are the
clock and the clock-based sample showtimes.

How it works: `src/layouts/lotte/lotteCopy.ts`.
- `tc(key, lang)` keeps the authored Korean, takes the sheet row `key` when it exists, and
  otherwise the 8-language translation written there. Every key is named as a
  Localization_Lotte row, so adding the row to the sheet overrides the code.
- `lotteTitle` maps page titles to the MainButton_* rows.
- `placeName` / `buildingName` / `localSpot` name buildings and 핫스팟 from the FacilityData
  rows' translated locations and names.
- The course planner takes its wording as a parameter. Korean is the default, so its unit test
  is unchanged.

Still Korean in other languages, all data rather than screen copy:
- Sample content: 예시 events, 예시 movies, and the offline sample shops. The shops API and the
  showtimes feed carry translations.
- 월드몰 핫스팟 cards with no FacilityData row: 롯데콘서트홀, 롯데마트, 롯데하이마트, 시그니엘 서울,
  롯데월드 어드벤처. Their name, one-liner and floor stay Korean until the sheet has rows.
- 롯데시네마 and 아쿠아리움 have rows but no description or hours, so in other languages their
  card shows the name and floor only.

## C. Fix order

1. **A1, A5, A6, A7** first. They are on the home screen or on the screens every visitor
   opens, and they look broken in 6 of 8 languages. Typical fix: let the box grow or wrap to two
   lines instead of one fixed width, and shrink the font one step for long languages.
2. **B1–B5, B7**: read the existing sheet keys instead of fixed Korean or English text. No
   design change is needed.
3. **A2–A4, A8, A9**: smaller polish.
4. **B6 and the rest of B**: these need translated content first (most of it is the sheet work
   in `LOTTE_SHEET_DATA_MAP.md`).

## How to re-run

The harness is `.tmp/lotte` (gitignored). With it running on :5193:

```
node .tmp/lotte/lang-audit.mjs <outdir> [screen,screen…]
```

`CHROME_EXE` must point at the installed Playwright Chromium. The script writes `audit.json` and
a screenshot per screen and language.
