-- 見積明細に「詳細」フィールドを追加
ALTER TABLE quote_items ADD COLUMN description TEXT NOT NULL DEFAULT '';
