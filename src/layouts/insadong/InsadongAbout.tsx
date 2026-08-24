import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import historyImg from '@renderer/assets/photos/insadong/about/history.png';
import cultureImg from '@renderer/assets/photos/insadong/about/culture.png';
import attractionsImg from '@renderer/assets/photos/insadong/about/attractions.png';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongAbout.module.css';

interface InsadongAboutProps {
  controller: KioskController;
  debug?: boolean;
}

/** 여기는 인사동 — info screen (역사 / 문화 / 관광명소); text from Localization_Insa. */
export function InsadongAbout({ controller }: InsadongAboutProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="여기는 인사동" onHome={goHome} />

      <div className={styles.content}>
        <article className={styles.card}>
          <section className={styles.block}>
            <div className={styles.wideImage}>
              <img src={historyImg} alt="" draggable={false} />
            </div>
            <h2 className={styles.heading}>{t('Here_History', lang)}</h2>
            <p className={styles.body}>{t('Here_HistoryContent', lang)}</p>
          </section>

          <section className={styles.row}>
            <div className={styles.squareImage}>
              <img src={cultureImg} alt="" draggable={false} />
            </div>
            <div className={styles.textCol}>
              <h2 className={styles.heading}>{t('Here_Culture', lang)}</h2>
              <p className={styles.body}>{t('Here_CultureContent', lang)}</p>
            </div>
          </section>

          <section className={styles.row}>
            <div className={styles.textCol}>
              <h2 className={styles.heading}>{t('Here_Attraction', lang)}</h2>
              <p className={styles.body}>{t('Here_AttractionContent', lang)}</p>
            </div>
            <div className={styles.squareImage}>
              <img src={attractionsImg} alt="" draggable={false} />
            </div>
          </section>
        </article>
      </div>

      <InsadongLeftNav onHome={goHome} />
    </>
  );
}
