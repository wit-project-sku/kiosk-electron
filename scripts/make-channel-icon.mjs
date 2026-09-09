/**
 * Generate build/icon-<channel>.ico + .png from the production icon.
 *
 *   node scripts/make-channel-icon.mjs beta     ->  build/icon-beta.{png,ico}
 *   node scripts/make-channel-icon.mjs lab      ->  build/icon-lab.{png,ico}
 *
 * The test builds install ALONGSIDE production (separate appId / productName /
 * userData — see electron-builder.<channel>.yml), so all three sit next to each
 * other in the Start menu, on the taskbar and in Programs. They must be tellable
 * apart at 16px, where a wordmark is unreadable — so the difference is CARRIED
 * BY COLOUR: the navy mark is recoloured and a solid band with the channel name
 * runs across the foot.
 *
 *   production  navy (untouched)
 *   beta        orange
 *   lab         green
 *
 * ★ The three colours must stay far apart in HUE, not in name. The whole point
 * is a 16px taskbar button, where the band is a few pixels tall and the label is
 * gone; navy / orange / green survive that, navy / blue / teal would not.
 *
 * Regenerate with `npm run icon:beta` / `npm run icon:lab` after build/icon.png
 * changes. The output is committed, so a normal build never needs Python or
 * this script.
 *
 * Requires Python with Pillow (already used by the sheet tooling). Kept out of
 * the JS toolchain deliberately: adding an image dependency to package.json for
 * a file that changes once a year is not worth the install cost on every CI run.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Band colour + foot label per channel. RGBA, alpha always 255. */
const CHANNELS = {
  // [제주] main 01 — the same orange the kiosk UI uses for its primary accent.
  beta: { rgb: '(255, 127, 15, 255)', label: 'BETA' },
  // A saturated green, chosen to sit far from both the navy production mark and
  // the orange beta band at thumbnail size.
  lab: { rgb: '(22, 163, 74, 255)', label: 'LAB' },
};

const channel = (process.argv[2] ?? '').trim().toLowerCase();
if (!(channel in CHANNELS)) {
  console.error(
    `[make-channel-icon] unknown channel "${process.argv[2] ?? ''}". ` +
      `Expected one of: ${Object.keys(CHANNELS).join(', ')}`,
  );
  process.exit(1);
}
const { rgb, label } = CHANNELS[channel];

const PY = String.raw`
import sys
from PIL import Image, ImageDraw, ImageFont

SRC = r"%SRC%"
OUT_PNG = r"%OUT_PNG%"
OUT_ICO = r"%OUT_ICO%"
ACCENT = %ACCENT%
LABEL = "%LABEL%"

base = Image.open(SRC).convert("RGBA")
w, h = base.size

# 1. Recolour the dark navy mark to the channel accent, leaving the light
#    background and the red sun alone. Anything dark and reasonably neutral is
#    treated as the mark.
px = base.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a > 24 and r < 110 and g < 110 and b < 150 and abs(r - g) < 48:
            # Keep the pixel's own luminance so the mark's shading survives.
            lum = (r + g + b) / 3 / 110
            px[x, y] = (
                int(ACCENT[0] * (0.55 + 0.45 * lum)),
                int(ACCENT[1] * (0.55 + 0.45 * lum)),
                int(ACCENT[2] * (0.55 + 0.45 * lum)),
                a,
            )

# 2. Solid band across the foot — the part that still reads at 16px.
band_h = int(h * 0.30)
d = ImageDraw.Draw(base)
d.rectangle([0, h - band_h, w, h], fill=ACCENT)

font = None
for path in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\seguibl.ttf"):
    try:
        font = ImageFont.truetype(path, int(band_h * 0.62))
        break
    except OSError:
        continue
if font is None:
    font = ImageFont.load_default()

box = d.textbbox((0, 0), LABEL, font=font)
d.text(
    ((w - (box[2] - box[0])) / 2 - box[0], h - band_h + (band_h - (box[3] - box[1])) / 2 - box[1]),
    LABEL,
    font=font,
    fill=(255, 255, 255, 255),
)

base.save(OUT_PNG)
# Every size Windows asks for: 16 for the taskbar, 256 for the installer header.
base.save(OUT_ICO, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("wrote", OUT_PNG, "and", OUT_ICO)
`
  .replace('%SRC%', join(root, 'build', 'icon.png'))
  .replace('%OUT_PNG%', join(root, 'build', `icon-${channel}.png`))
  .replace('%OUT_ICO%', join(root, 'build', `icon-${channel}.ico`))
  .replace('%ACCENT%', rgb)
  .replace('%LABEL%', label);

const out = execFileSync('python', ['-c', PY], { encoding: 'utf8' });
process.stdout.write(out);
