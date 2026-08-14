import { useEffect, useState } from 'react';
import { isOk } from '@shared/types/result';
import type { SpotDiffRound } from '@shared/types/spotDiff';

/**
 * How many boards to have ready per photo session.
 *
 * More than one because a fast player can clear a round well inside the 60s AI
 * hold and is then offered 다시 하기 — and that replay must not go to the
 * network, which is the whole reason this hook exists. Three covers a very quick
 * player without warming images nobody will see.
 */
const ROUNDS_PER_SESSION = 3;

/**
 * Picks the 틀린그림찾기 boards for a photo session and gets them ready to play.
 *
 * ── Why this runs at session START, not when the game appears ─────────
 * The game is shown during the ~60s AI wait, which is precisely when the
 * network is busiest: the captured photo is uploading and the synthesis request
 * is in flight. Fetching puzzle images then would either leave the board blank
 * or steal bandwidth from the photo. So the rounds are chosen and every image is
 * decoded into Chromium's cache the moment the visitor starts picking an outfit
 * — a good half-minute of idle network earlier. By the time the game mounts (and
 * again on every replay) `<img src>` is a cache hit.
 *
 * The round list itself is already local (main caches it in SQLite at launch
 * and at the nightly sync), so `getRound()` is an IPC call, not a request.
 *
 * ── It also fixes the aspect ──────────────────────────────────────────
 * The puzzle API sends coordinates but no image dimensions, and the hit test
 * needs the aspect: `radius` is a fraction of WIDTH, so the vertical axis is
 * scaled by it, and the panel box is sized from it too. Guessing would give a
 * stretched picture and an elliptical — subtly unfair — hit area. Since this
 * hook decodes the images anyway, it reads `naturalWidth/naturalHeight` off them
 * and corrects each round before the game ever sees it.
 *
 * Returns [] until the first round resolves. Fewer than `ROUNDS_PER_SESSION`
 * entries is normal and fine — the CMS may only have one puzzle, and the game
 * simply wraps around (a repeat still plays differently, because winning takes
 * any five of the puzzle's ~10 differences).
 */
export function useSpotDiffRounds(sessionId: string | null): SpotDiffRound[] {
  const [rounds, setRounds] = useState<SpotDiffRound[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setRounds([]);
      return;
    }

    let cancelled = false;

    /** Warm both images and correct the round's aspect from the real file. */
    const prepare = (round: SpotDiffRound): void => {
      let measured = false;
      for (const url of [round.originalUrl, round.modifiedUrl]) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (cancelled || measured) return;
          const { naturalWidth: w, naturalHeight: h } = img;
          if (!w || !h) return;
          measured = true;
          const aspect = w / h;
          // Guard the no-op: an unchanged aspect must not re-render the board
          // mid-game, and the generated placeholder already ships the exact one.
          if (Math.abs(aspect - round.aspect) < 0.001) return;
          setRounds((prev) => prev.map((r) => (r.id === round.id ? { ...r, aspect } : r)));
        };
        img.src = url;
      }
    };

    void (async () => {
      const picked: SpotDiffRound[] = [];
      for (let i = 0; i < ROUNDS_PER_SESSION; i += 1) {
        const result = await window.api.spotDiff.getRound();
        if (cancelled) return;
        if (!isOk(result)) break;
        // The service picks at random, so the same board can come back twice.
        // A duplicate is dropped rather than retried — with a one-puzzle CMS
        // retrying would just spin.
        if (picked.some((r) => r.id === result.value.id)) continue;
        picked.push(result.value);
        // Publish as they arrive so the first board is playable immediately.
        setRounds([...picked]);
        prepare(result.value);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return rounds;
}
