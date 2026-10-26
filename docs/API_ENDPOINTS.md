# kiosk-app — API endpoints

Every API the kiosk app calls, taken from the source (`src/main/services` and friends).
Google Sheets (the CMS sync) is intentionally left out of this list.

---

## 1. Witteria backend

| Env | Base URL |
|---|---|
| Production | `https://api-v3.witteria.com` |
| Staging | `https://api-stage-v3.witteria.com` |

`{region}` = location key from `src/shared/config/kioskLocations.ts`.

### Content

| Method | Endpoint | Service | Purpose |
|---|---|---|---|
| GET | `/api/shops/v2?region={region}` | ShopService | Shop catalogue |
| GET | `/api/kiosks/{region}/banners/v2` | BannerService | Rotating banners |
| GET | `/api/kiosks/{region}/buttons/v2` | ButtonLayoutService | Home-screen button grid |
| GET | `/api/kiosks/{region}/subtitles/v2` | SubtitleService | Video subtitles |
| GET | `/api/kiosks/{region}/backgrounds/v2` | BackgroundService | AR photo backgrounds |
| GET | `/api/kiosks/{region}/games/spot-difference/puzzles/v2` | SpotDiffService | Spot-the-difference game |
| GET | `/api/jeju/attractions/v2?region={region}` | AttractionService | Jeju attractions |
| GET | `/api/events` | EventsService | Events list |
| GET | `/api/events/{eventId}` | EventsService | Event detail |
| GET | `/api/events/recommend` | EventsService | Recommended events |

### Outfits (hanbok photo)

| Method | Endpoint | Service | Purpose |
|---|---|---|---|
| GET | `/api/outfits/v2?pageNum=&pageSize=` | OutfitService | Outfit list |
| GET | `/api/outfits/categories/v2` | OutfitService | Outfit categories |
| GET | `/api/categories/outfits` | OutfitService | Legacy categories (fallback) |

### AI courses

| Method | Endpoint | Service | Purpose |
|---|---|---|---|
| POST | `/api/jeju/courses/recommend/v2` | JejuCourseService | Jeju AI course |
| POST | `/api/jeju/courses/picker/v2` | JejuCourseService | Jeju course picker |
| POST | `/api/insa/courses/recommend/v2` | InsaCourseService | Insadong AI course |
| POST | `/api/insa/courses/recommend` | InsaCourseService | Insadong v1 fallback |

### Stats

| Method | Endpoint | Service | Purpose |
|---|---|---|---|
| POST | `/api/stats/menu-touch` | StatsService | Real-time menu touch |
| POST | `/api/stats/shots` | StatsService | Photo shot (non-Jeju) |
| POST | `/api/stats/shots/v2` | StatsService | Photo shot (Jeju layouts) |
| POST | `/api/stats/menu-touches/sync` | StatsService | Nightly resend of failed touches |
| POST | `/api/stats/photo-shots/sync` | StatsService | Nightly resend of failed shots |

### Device

| Method | Endpoint | Service | Purpose |
|---|---|---|---|
| GET | `/api/kiosks/{kioskNum}/update-command` | UpdateCommandService | Polled remote "update now" |

### Photo host

| Method | Endpoint | Service | Purpose |
|---|---|---|---|
| POST | `https://photo.witteria.com/api/images` | ImageHostService | Upload photo → QR link |

---

## 2. Third-party APIs

| Provider | Method | Endpoint | Service |
|---|---|---|---|
| OpenWeatherMap | GET | `https://api.openweathermap.org/data/2.5/weather` | WeatherService |
| OpenWeatherMap | GET | `https://api.openweathermap.org/data/2.5/forecast` | WeatherService |
| Korea Eximbank (exchange rates) | GET | `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON` | ExchangeService |
| Korea Airports (data.go.kr) | GET | `https://apis.data.go.kr/B551178/flight-status/depart` | FlightService |
| Korea Airports (data.go.kr) | GET | `https://apis.data.go.kr/B551178/flight-status/arrival` | FlightService |
| Korea Airports (data.go.kr) | GET | `https://apis.data.go.kr/B551178/flight-status/info` | FlightService |
| Korea Airports (data.go.kr) | GET | `https://apis.data.go.kr/B551178/flight-status/detail` | FlightService |
| Korea Airports (data.go.kr) | GET | `https://apis.data.go.kr/B551178/flight-apron-status/cju` | FlightService |
| Haewoon ferry board | GET | `http://company.haewoon.co.kr/CompanySite/getJSONData.aspx` | SailingService |
| Google Drive | POST | `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` | GoogleDriveService |
| Google OAuth (Drive token) | POST | `https://oauth2.googleapis.com/token` | Google auth |
| Digicon AR AI | POST | `https://kr-kiosk.digicon.pro/api/v2/process_image` | ARImageTransport (solo) |
| Digicon AR AI | POST | `https://kr-kiosk.digicon.pro/api/v2/process_and_combine` | ARImageTransport (together) |
| Fillme | POST | `https://admin-v2.fillme.co.kr/api/analysis/guest` | layouts/jeju/fillme |
| Fillme | GET | `https://admin-v2.fillme.co.kr/api/analysis/guest/result` | layouts/jeju/fillme |
| Fillme | POST | `https://admin-v2.fillme.co.kr/api/fillme/shares` | layouts/jeju/fillme |
| OpenStreetMap | GET | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | EventDetailScreen map |

---

## 3. Local / optional

| Service | Address | Notes |
|---|---|---|
| Payment agent | `http://127.0.0.1:8080` | Started by PaymentAgentManager; called by the store/donation webviews; only on kiosks with a card terminal |
| Footfall upload | `FOOTFALL_API_URL` env | Not configured → counts stay local |

---

## 4. Embedded web pages (webviews, not APIs)

| Page | URL |
|---|---|
| Witteria store | `https://witteria.com/#/kiosk/store` |
| Donation | `https://witglobaldonation.vercel.app/#/?kiosk=1` |
| Events | `https://withevent.kr/kiosk/events?region=…` |
| Tax refund | `https://wit.linktaxfree.com/` |
| Tamnao | `https://www.tamnao.com/mw/` |
| Jejuqrang | `https://jejuqrang.com/` |
| Insarang | `https://insarang.kr/` |
| AI course QR | `https://direction-fe.vercel.app/ai` |

Shop detail pages also link to many `naver.me` short links.

---

## Env overrides

`OUTFITS_API_URL`, `OUTFIT_CATEGORIES_API_URL`, `STATS_MENU_TOUCH_URL`,
`STATS_MENU_TOUCHES_SYNC_URL`, `STATS_PHOTO_SHOTS_SYNC_URL`,
`PHOTO_PUBLIC_UPLOAD_URL`, `FOOTFALL_API_URL`, `PAYMENT_HTTP_PORT`.
