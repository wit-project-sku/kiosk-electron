/**
 * "사진이 완성되었습니다. 확인해보세요!" — the 인사동 photo-ready popup
 * (Figma 7768:10445).
 *
 * The 제주 version of this moment is {@link PhotoReadyPrompt}, a light bottom
 * sheet over the game. On 인사동 it was too easy to miss, so the frame draws a
 * centred white card over a 30% black scrim instead — the game is dimmed and
 * the only things left to touch are the two buttons:
 *
 *   저장하기  → the result screen (the photo and its save QR)
 *   다시찍기  → the 한복 picker again, i.e. the kiosk's photo reset
 *
 * Both labels are the sheet's own `Photo_Save` / `Photo_Home` rows. The
 * sentence has no row, so it is authored here in the eight languages.
 */
import { useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import styles from './PhotoReadyModal.module.css';

type L8 = Partial<Record<Lang, string>>;

const MESSAGE: L8 = {
  ko: '사진이 완성되었습니다. 확인해보세요!',
  en: 'Your photo is ready. Take a look!',
  ja: '写真が完成しました。ご確認ください！',
  zh: '照片已完成，请查看！',
  vi: 'Ảnh của bạn đã hoàn thành. Hãy xem thử nhé!',
  th: 'รูปถ่ายของคุณเสร็จแล้ว ลองดูเลย!',
  ru: 'Ваше фото готово. Посмотрите!',
  id: 'Foto Anda sudah selesai. Silakan lihat!',
};

const SAVE: L8 = {
  ko: '저장하기', en: 'Save', ja: '保存', zh: '保存',
  vi: 'Lưu lại', th: 'บันทึก', ru: 'Сохранить', id: 'Simpan',
};

const RETAKE: L8 = {
  ko: '다시찍기', en: 'Try Again', ja: '再撮影', zh: '重拍',
  vi: 'Chụp lại', th: 'ถ่ายใหม่', ru: 'Переснять', id: 'Ulangi Foto',
};

interface Props {
  /** 저장하기 — go to the finished photo. */
  onSave: () => void;
  /** 다시찍기 — abandon this photo and start over. */
  onRetake: () => void;
}

export function PhotoReadyModal({ onSave, onRetake }: Props): JSX.Element {
  const lang = useLang();

  return (
    <div className={styles.scrim}>
      <section className={styles.card} role="dialog" aria-modal="true">
        <p className={styles.message}>{sheetText('Photo_popup_message_Complete', lang, MESSAGE)}</p>
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.save}`} onClick={onSave}>
            {sheetText('Photo_Save', lang, SAVE)}
          </button>
          <button type="button" className={`${styles.btn} ${styles.retake}`} onClick={onRetake}>
            {sheetText('Photo_Home', lang, RETAKE)}
          </button>
        </div>
      </section>
    </div>
  );
}
