import { useEffect, useState } from 'react';
import { isOk } from '@shared/types/result';
import { CAMERA_ROTATIONS, DEFAULT_CAMERA_ROTATION, type CameraRotation } from '@shared/types/photo';
import { usePhotoStore } from '@renderer/store/photoStore';
import styles from './ManualCapturePanel.module.css';

/**
 * TEMPORARY — vertical-camera test controls on the touch screen, shown while
 * the camera streams (see PHOTO_MANUAL_CAPTURE). Replaces the countdown:
 * nothing reaches the AI until 촬영하기 is pressed.
 *
 * The rotation button starts at the stored value (DEFAULT_CAMERA_ROTATION =
 * 270) and turns Monitor 2's live feed and the saved capture together, so the
 * mount can be re-checked on site without devtools.
 */
export function ManualCapturePanel(): JSX.Element {
  const phase = usePhotoStore((s) => s.phase);
  const [rotation, setRotation] = useState<CameraRotation>(DEFAULT_CAMERA_ROTATION);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.api.camera.getSelected().then((r) => {
      if (isOk(r)) setRotation(r.value.rotation);
    });
  }, []);

  // The shot is taken in the display window, so the button stays disabled until
  // the workflow actually leaves 'preview' (→ generating), with a fallback in
  // case the display never answers.
  useEffect(() => {
    if (phase !== 'preview') setBusy(false);
  }, [phase]);

  const cycleRotation = async (): Promise<void> => {
    const i = CAMERA_ROTATIONS.indexOf(rotation);
    const next = CAMERA_ROTATIONS[(i + 1) % CAMERA_ROTATIONS.length] ?? DEFAULT_CAMERA_ROTATION;
    const r = await window.api.camera.setRotation(next);
    if (isOk(r)) setRotation(r.value.rotation);
  };

  const takePhoto = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => setBusy(false), 3000);
    await window.api.photo.captureNow();
  };

  const sending = phase === 'generating';

  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={styles.shoot}
        onClick={() => void takePhoto()}
        disabled={sending || busy}
      >
        {sending ? 'AI 전송 중…' : '촬영하기'}
      </button>
      <button type="button" className={styles.rotate} onClick={() => void cycleRotation()}>
        <span className={styles.rotateLabel}>카메라 회전</span>
        <span className={styles.rotateValue}>{rotation}°</span>
      </button>
    </div>
  );
}
