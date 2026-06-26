import type { Migration } from './types';

/**
 * Seed default translations for all supported languages.
 * Covers kiosk navigation and operator back-office UI.
 * Updated during night sync from Google Sheets.
 */
export const migration006: Migration = {
  version: 6,
  name: 'default_translations',
  up: (db) => {
    const defaultTranslations = [
      // Kiosk navigation - Insadong layout
      { key: 'kiosk.nav.intro', ko: '소개', en: 'Intro', ja: '紹介', vi: 'Giới thiệu', zh: '介绍' },
      { key: 'kiosk.nav.guide', ko: '관광안내', en: 'Guide', ja: 'ガイド', vi: 'Hướng dẫn', zh: '指南' },
      { key: 'kiosk.nav.events', ko: '이벤트', en: 'Events', ja: 'イベント', vi: 'Sự kiện', zh: '活动' },
      { key: 'kiosk.nav.facilities', ko: '편의시설', en: 'Facilities', ja: '施設', vi: 'Tiện nghi', zh: '设施' },
      // Kiosk navigation - Nam Insadong layout
      { key: 'kiosk.nav.food', ko: '맛집', en: 'Food', ja: '食べ物', vi: 'Đồ ăn', zh: '美食' },
      { key: 'kiosk.nav.shopping', ko: '쇼핑', en: 'Shopping', ja: 'ショッピング', vi: 'Mua sắm', zh: '购物' },
      { key: 'kiosk.nav.culture', ko: '문화체험', en: 'Culture', ja: '文化', vi: 'Văn hóa', zh: '文化' },
      // Operator back-office
      { key: 'op.nav.dashboard', ko: 'Dashboard', en: 'Dashboard', ja: 'ダッシュボード', vi: 'Bảng điều khiển', zh: '仪表板' },
      { key: 'op.nav.customers', ko: 'Customers', en: 'Customers', ja: '顧客', vi: 'Khách hàng', zh: '客户' },
      { key: 'op.nav.photos', ko: 'Photos', en: 'Photos', ja: '写真', vi: 'Ảnh', zh: '照片' },
      { key: 'op.nav.camera', ko: 'Camera', en: 'Camera', ja: 'カメラ', vi: 'Máy ảnh', zh: '摄像机' },
      { key: 'op.nav.display', ko: 'Display', en: 'Display', ja: 'ディスプレイ', vi: 'Hiển thị', zh: '显示' },
      { key: 'op.nav.data', ko: 'Data', en: 'Data', ja: 'データ', vi: 'Dữ liệu', zh: '数据' },
      { key: 'op.nav.settings', ko: 'Settings', en: 'Settings', ja: '設定', vi: 'Cài đặt', zh: '设置' },
      // Common UI
      { key: 'common.home', ko: 'Home', en: 'Home', ja: 'ホーム', vi: 'Trang chủ', zh: '主页' },
      { key: 'common.back', ko: 'Back', en: 'Back', ja: '戻る', vi: 'Quay lại', zh: '返回' },
      { key: 'common.save', ko: 'Save', en: 'Save', ja: '保存', vi: 'Lưu', zh: '保存' },
      { key: 'common.cancel', ko: 'Cancel', en: 'Cancel', ja: 'キャンセル', vi: 'Hủy', zh: '取消' },
      { key: 'common.delete', ko: 'Delete', en: 'Delete', ja: '削除', vi: 'Xóa', zh: '删除' },
      { key: 'common.edit', ko: 'Edit', en: 'Edit', ja: '編集', vi: 'Chỉnh sửa', zh: '编辑' },
    ];

    const now = new Date().toISOString();

    for (const item of defaultTranslations) {
      for (const [lang, text] of Object.entries(item)) {
        if (lang === 'key') continue;
        db.prepare(
          `INSERT INTO translations (key, language, text, created_at)
           VALUES (@key, @language, @text, @now)
           ON CONFLICT(key, language) DO NOTHING`,
        ).run({
          key: item.key,
          language: lang,
          text,
          now,
        });
      }
    }
  },
};
