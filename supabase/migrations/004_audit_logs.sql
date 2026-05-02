-- ============================================================
-- DCMS Migration 004: Tamper-Proof Audit Log (Insert-Only)
-- ============================================================

CREATE TABLE public.audit_logs (
  id            BIGSERIAL   PRIMARY KEY,
  event_type    TEXT        NOT NULL,  -- 'view'|'download'|'upload'|'approve'|'reject'|'obsolete'|...
  actor_id      UUID        NOT NULL REFERENCES profiles(id),
  document_id   UUID        REFERENCES documents(id),
  revision_id   UUID        REFERENCES revisions(id),
  ip_address    INET,
  user_agent    TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  prev_hash     TEXT,        -- SHA-256 of previous row (hash chain integrity)
  row_hash      TEXT        NOT NULL, -- SHA-256 of this row's content
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- REVOKE all mutation — log rows are append-only
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
REVOKE TRUNCATE        ON public.audit_logs FROM anon, authenticated;

-- Indexes for compliance reporting
CREATE INDEX idx_audit_actor_time    ON audit_logs(actor_id,    logged_at DESC);
CREATE INDEX idx_audit_doc_time      ON audit_logs(document_id, logged_at DESC);
CREATE INDEX idx_audit_event_time    ON audit_logs(event_type,  logged_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all; no one else can
CREATE POLICY audit_select_admin ON audit_logs
  FOR SELECT TO authenticated USING (jwt_role() = 'admin');

-- Any authenticated user can insert (controlled via Server Actions)
CREATE POLICY audit_insert ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- ── Supporting tables ─────────────────────────────────────────

-- Review assignments
CREATE TABLE public.document_reviewers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  reviewer_id UUID        NOT NULL REFERENCES profiles(id),
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected','abstained')),
  comments    TEXT,
  reviewed_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (document_id, reviewer_id)
);

ALTER TABLE public.document_reviewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviewers_select ON document_reviewers
  FOR SELECT TO authenticated USING (
    reviewer_id = auth.uid() OR jwt_role() IN ('admin','editor')
  );

CREATE POLICY reviewers_update_own ON document_reviewers
  FOR UPDATE TO authenticated USING (reviewer_id = auth.uid());

-- Notification / alert queue (for review-due alerts)
CREATE TABLE public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,  -- 'review_due'|'approval_required'|'doc_published'
  title       TEXT        NOT NULL,
  body        TEXT,
  document_id UUID        REFERENCES documents(id),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifs_select_own ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY notifs_update_own ON notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
