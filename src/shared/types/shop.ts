/** A shop image (S3 webp URL) ordered by sortOrder. */
export interface ShopImage {
  id: number;
  imageUrl: string;
  sortOrder: number;
}

/** A shop record from the witteria shops API (multilingual). */
export interface Shop {
  id: number;
  no: string;
  kioskId: number;
  shopNameKr: string;
  baseCategoryKr: string | null;
  secondCategoryKr: string | null;
  aiCategoryKr: string | null;
  addressKr: string;
  hashTagKr: string;
  descriptionKr: string;
  shopNameEn: string;
  baseCategoryEn: string | null;
  secondCategoryEn: string | null;
  addressEn: string;
  hashTagEn: string;
  descriptionEn: string;
  shopNameJp: string;
  baseCategoryJp: string | null;
  secondCategoryJp: string | null;
  addressJp: string;
  hashTagJp: string;
  descriptionJp: string;
  shopNameCh: string;
  baseCategoryCh: string | null;
  secondCategoryCh: string | null;
  addressCh: string;
  hashTagCh: string;
  descriptionCh: string;
  openTime: string | null;
  tel: string | null;
  naverLink: string | null;
  naverRating: number | null;
  images: ShopImage[];
}
