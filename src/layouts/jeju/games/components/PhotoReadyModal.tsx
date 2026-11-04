/**
 * "사진이 완성되었습니다. 확인해보세요!" — the 인사동 photo-ready popup
 * (Figma 7768:10445).
 *
 * 제주 and 인사동 both use this centred card over a 30% black scrim once the
 * photo is ready. The game is dimmed and the only things left to touch are
 * the two buttons:
 *
 *   저장하기  → the result screen (the photo and its save QR); 제주 labels it
 *              사진 보기 (VIEW_PHOTO)
 *   다시찍기  → the 한복 picker again, i.e. the kiosk's photo reset
 *
 * Both labels are the sheet's own `Photo_Save` / `Photo_Home` rows. The
 * sentence reads `Photo_popup_title_Complete` ("사진이 완성됐어요!") where the
 * location's sheet has it (인사동 / 오색 / 화성 do); `Photo_popup_desc_Complete`
 * ("게임을 계속하다가…") is the 제주 bottom sheet's keep-playing line and does
 * not fit this blocking card, so it is not used. MESSAGE covers languages and
 * sheets without the row.
 */
import { useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText, tExact } from '@renderer/lib/loc';
import { usePhotoChrome } from '../../../photo/photoChrome';
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

/**
 * 제주's label for the first button (2026-10-28): it opens the finished photo,
 * so it says 사진 보기 rather than 저장하기. Hard-coded — the 제주 sheet's
 * Photo_Save row is not this text (its en cell reads "Jeju").
 */
const VIEW_PHOTO: Record<string, string> = {
  ko: '사진 보기', en: 'View Photo', ja: '写真を見る', zh: '查看照片',
  vi: 'Xem ảnh', th: 'ดูรูปภาพ', ru: 'Посмотреть фото', id: 'Lihat Foto',
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
  const { isJeju } = usePhotoChrome();

  return (
    <div className={styles.scrim}>
      <section className={styles.card} role="dialog" aria-modal="true">
        <p className={styles.message}>{tExact('Photo_popup_message_Complete', lang) || sheetText('Photo_popup_title_Complete', lang, MESSAGE)}</p>
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.save}`} onClick={onSave}>
            {isJeju ? VIEW_PHOTO[lang] ?? VIEW_PHOTO.en : sheetText('Photo_Save', lang, SAVE)}
          </button>
          <button type="button" className={`${styles.btn} ${styles.retake}`} onClick={onRetake}>
            {sheetText('Photo_Home', lang, RETAKE)}
          </button>
        </div>
      </section>
    </div>
  );
}
