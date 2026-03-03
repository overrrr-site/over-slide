-- ============================================================
-- quotes: 見積ヘッダー
-- ============================================================
CREATE TABLE quotes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by     UUID NOT NULL REFERENCES profiles(id),
  quote_number   TEXT NOT NULL,
  client_name    TEXT NOT NULL DEFAULT '',
  project_name   TEXT NOT NULL DEFAULT '',
  project_types  JSONB NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'submitted', 'won', 'lost')),
  issued_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at     DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  subtotal       BIGINT NOT NULL DEFAULT 0,
  tax            BIGINT NOT NULL DEFAULT 0,
  total          BIGINT NOT NULL DEFAULT 0,
  notes          JSONB NOT NULL DEFAULT '[]',
  assigned_sales TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_team ON quotes(team_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created ON quotes(created_at DESC);
CREATE UNIQUE INDEX idx_quotes_number_team ON quotes(team_id, quote_number);

-- ============================================================
-- quote_items: 見積明細
-- ============================================================
CREATE TABLE quote_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  category        TEXT NOT NULL DEFAULT '',
  name            TEXT NOT NULL DEFAULT '',
  unit_price      BIGINT NOT NULL DEFAULT 0,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT '式',
  amount          BIGINT NOT NULL DEFAULT 0,
  internal_days   NUMERIC(10,2) NOT NULL DEFAULT 0,
  assignee_type   TEXT NOT NULL DEFAULT 'director'
                    CHECK (assignee_type IN ('director', 'sales')),
  outsource_cost  BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX idx_quote_items_sort ON quote_items(quote_id, sort_order);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- quotes: team_id 直接チェック（projects テーブルと同じパターン）
CREATE POLICY "Team members can view quotes"
  ON quotes FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team members can create quotes"
  ON quotes FOR INSERT
  WITH CHECK (team_id = get_user_team_id());

CREATE POLICY "Team members can update quotes"
  ON quotes FOR UPDATE
  USING (team_id = get_user_team_id());

CREATE POLICY "Team members can delete quotes"
  ON quotes FOR DELETE
  USING (team_id = get_user_team_id());

-- quote_items: 親テーブル（quotes）経由チェック（brief_sheets と同じパターン）
CREATE POLICY "Team access to quote items"
  ON quote_items FOR SELECT
  USING (quote_id IN (SELECT id FROM quotes WHERE team_id = get_user_team_id()));

CREATE POLICY "Team insert quote items"
  ON quote_items FOR INSERT
  WITH CHECK (quote_id IN (SELECT id FROM quotes WHERE team_id = get_user_team_id()));

CREATE POLICY "Team update quote items"
  ON quote_items FOR UPDATE
  USING (quote_id IN (SELECT id FROM quotes WHERE team_id = get_user_team_id()));

CREATE POLICY "Team delete quote items"
  ON quote_items FOR DELETE
  USING (quote_id IN (SELECT id FROM quotes WHERE team_id = get_user_team_id()));
