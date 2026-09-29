# Insadong icon / illustration assets

Export each icon from the Figma `인사>홈` design and drop it here with the exact
base name below. **SVG is preferred** (crisp at any size); PNG also works. If both
exist for a name, PNG wins — so delete the old `.png` when replacing it with `.svg`.
Files are loaded automatically — missing ones fall back to a labelled placeholder.

Most home-grid tiles are `.svg`; `ai-search`, `donation` and `restroom` are
`.png`. Names below are listed with the legacy `.png` extension but either
extension resolves.

Export each **tile graphic only** (the rounded illustration), **without** the
text label underneath — the labels are rendered in code.

## Home grid tiles (the 4×4 icons)
All sixteen are 300×300 squares — since `인사>홈-01/02` no tile spans two columns.
- `ai-search.png`   — '인사' 모하지 (AI검색) — the robot tile
- `insarang.png`    — 인사랑(준비중) (W001/W002' 3rd slot)
- `market.png`      — 위드마켓 (W003's 3rd slot)
- `events.png`      — 인사동 이벤트
- `eat.png`         — '인사' 뭐먹지
- `shop.png`        — '인사' 뭐사지
- `museum.png`      — 인사동미술관
- `taxfree.png`     — TAX-FREE
- `about.png`       — 여기는 인사동
- `hello.png`       — 안녕 '인사'
- `help.png`        — 도와줘 '인사'
- `donation.png`    — 기부 (grid slot 2 on every Insadong kiosk)
- `map.png`         — 인사동지도 (grid slot 12; no longer swapped for 기부)
- `exchange.png`    — 환율
- `transport.png`   — 교통안내
- `lodging.png`     — 숙박안내
- `palace.png`      — 고궁안내

## Bottom action bar
- `bottom-bar-classic.png` — the scalloped `Union` bar (three domes, 2246×532
  including its drop-shadow bleed). `bottom-bar.png` is the retired variant whose
  left bump was a wide square, sized for the old K-DRAMA logo.
- `smart-tour.svg`    — 스마트관광(준비중), left dome (235×235)
- `restroom.png`      — 화장실, right dome (235×235)
  (the centre camera button is drawn in code)

## Promo
- `hanbok.png`      — the two hanbok figures in the bottom “가상 한복 착장” banner

## Optional background decoration
- `bg.png`          — full 2160×3840 background with ONLY the decorative art
  (clouds / rainbow / dancheong), no text/icons/search. If present it’s used as
  the page background; otherwise a plain warm‑cream background is used.

## 인사동 리뉴얼 홈 (W001 · W002 only)

`InsadongHomeRenewal` draws Figma page `인사동 리뉴얼` (7516:63421 / 7574:68827) and
uses its OWN copies of the tile art, because W003 still runs the pre-renewal
`InsadongHome` out of this same folder. Never overwrite a bare name with a
renewal export — add/patch the `renewal-` twin instead.

### Grid tiles — `renewal-*` (300×300, rx 85.7994)
Same illustrations as the bare names, squircle repainted in the lighter palette:
`renewal-eat` #FFF3CB · `renewal-shop` #E5F2FC · `renewal-lodging` #E5E5E5 ·
`renewal-palace` #F9E9D6 · `renewal-about` #EFEFEF · `renewal-hello` #FFE1E4 ·
`renewal-help` #FFDFBF · `renewal-museum` #D2F1DA · `renewal-exchange` #FFEFD9 ·
`renewal-map` #FFEDD3 · `renewal-donation` #E5F7F4 · `renewal-transport` #F1FBD5 ·
`renewal-taxfree` #EFEFEF. Slot 10 is `renewal-map` OR `renewal-donation`
(`useHasDonationTile`), never both — the renewal restored them as alternatives.

### Quick cards — bare art, no squircle
- `quick-ai.svg`        — 238×205, the AI robot ('인사' 뭐하지)
- `quick-insarang.svg`  — 130×199, 인사랑(준비중)
- `quick-events.svg`    — 174×174, 인사동 이벤트

### Bottom buttons (the scalloped Union bar is gone in the renewal)
- `nav-kdrama.png`   — 381×235 blue K-DRAMA plate (@2×), replaces 스마트관광
- `nav-camera.png`   — 353×355 orange camera dome (@2×)
- `nav-restroom.png` — 233×234 화장실 dome (@2×)

`bg.png` is now the uploaded hanok/blossom plate with Figma 7519:74420's
treatment baked in (30% over the 인사>홈 page colour #FBF8F3), so all twenty
screens that load it share one plate and need no extra CSS.

## Left nav + scroll rail
- The ♿ low-reach toggle (3rd button on `InsadongLeftNav`) has NO asset — it is
  drawn inline in InsadongLeftNav.tsx so it can take `--kiosk-primary`. 제주's
  `ico-accessibility` is baked at its own #FF7F0F and embeds the figure as a
  raster pattern, so it cannot be recoloured; beside 인사동's #FE6C50 home/back it
  was visibly the wrong orange. NOT in the 인사동 frames — added for 제주 parity.
- `scroll-arrow.svg` — 85×85, ONE asset the pages rotate ±90° into the ▲ / ▼
  pair at x2027, y2103 / y2223 (Figma 7574:70001 / 70002, same tops as 제주).
- `quick-market.svg` — bare 위드마켓 art for W003's 2nd quick card, made from
  `market.svg` with the squircle plate and its backdrop-blur stripped so it
  matches `quick-insarang.svg` / `quick-events.svg`.

## '인사' 뭐하지 — AI course landing (7519:74937)
- `course-ai.png`       — 282x329 나만의 코스 icon (@2x)
- `course-nature.png`   — 279x207 자연·유산 탐방 코스 (@2x)
- `course-food.png`     — 334x151 맛집·감성 코스 (@2x)
- `course-family.png`   — 333x270 가족·체험 코스 (@2x)
- `course-shopping.svg` — 277x277 쇼핑·로컬 체험 코스
- `course-arrow.svg`    — 90x90 chevron. The export ALREADY carries the node's
  own rotation, so it points right as drawn — do NOT add Figma's `rotate-180`
  wrapper on top or every chevron flips back to the left.
- `banner-kioskmall.png` — 2160x573 WITH 키오스크몰 promo, the page banner for the
  landing and the short builder (the tall builder runs to y3675 and has none).
- `course-dwell.svg`    — 58x58 머무는 시간 glyph on the course-result spot card
  (7519:76326). 주소/영업시간 reuse the existing `photos/insadong/ai/icon-marker`
  and `icon-alarm`, which SpotDetailCard already draws.
