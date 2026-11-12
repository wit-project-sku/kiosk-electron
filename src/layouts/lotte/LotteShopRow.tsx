/** One row on the 롯데 lists (Figma 뭐먹지-목록): name · category, address, one line, up to two photos. */
import type { Shop } from '@shared/types/shop';
import type { Lang } from '@renderer/lib/i18n';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import {
  shopAddress,
  shopDescription,
  shopImages,
  shopName,
  shopSecondCategory,
} from '@renderer/lib/shops';
import c from './lotteContent.module.css';

export function LotteShopRow({
  shop,
  lang,
  onClick,
}: {
  shop: Shop;
  lang: Lang;
  onClick: () => void;
}): JSX.Element {
  const photos = shopImages(shop).slice(0, 2);
  const shown = photos.length > 0 ? photos : [lotteIconUrl('noimage') ?? ''];
  return (
    <button type="button" className={c.shopRow} onClick={onClick}>
      <span className={c.shopRowText}>
        <span className={c.shopRowTop}>
          <span className={c.shopRowName}>{shopName(shop, lang)}</span>
          <span className={c.shopRowTag}>
            {shopSecondCategory(shop, lang).replace(/^\d+-/, '')}
          </span>
        </span>
        <span className={c.shopRowLine}>{shopAddress(shop, lang)}</span>
        <span className={c.shopRowLine}>{shopDescription(shop, lang)}</span>
      </span>
      <span className={c.shopRowPhotos}>
        {shown.map((src) => (
          <img key={src} src={src} alt="" draggable={false} />
        ))}
      </span>
    </button>
  );
}
