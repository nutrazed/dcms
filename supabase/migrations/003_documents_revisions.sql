-- ============================================================
-- DCMS Migration 003: Documents, Revisions & Full-Text Search
-- ============================================================

CREATE TABLE public.documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id         UUID        NOT NULL REFERENCES folders(id),
  doc_code          TEXT        NOT NULL UNIQUE, -- e.g. YYMM-QMS-POL-001
  title             TEXT        NOT NULL,
  doc_type          TEXT        NOT NULL
                    CHECK (doc_type IN ('policy','procedure','work_instruction','form','record')),
  functional_area   TEXT        NOT NULL,
  owner_id          UUID        REFERENCES profiles(id),
  current_rev_id    UUID,       -- FK set after first revision inserted
  status            TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','under_review','approved','obsolete')),
  security_class    TEXT        NOT NULL DEFAULT 'internal'
                    CHECK (security_class IN ('public','internal','confidential','restricted')),
  retention_years   INT         NOT NULL DEFAULT 3,
  effective_date    DATE,
  review_due_date   DATE GENERATED ALWAYS AS
                    (effective_date + (INTERVAL '1 year' * retention_years)) STORED,
  fts_vector        TSVECTOR GENERATED ALWAYS AS
                    (to_tsvector('english',
                      coalesce(title,'') || ' ' ||
                      coalesce(doc_code,'') || ' ' ||
                      coalesce(functional_area,'')
                    )) STORED,
  tags              TEXT[]      DEFAULT '{}',
  applicable_standards TEXT[]   DEFAULT '{}', -- ISO 9001, ISO 27001, GDPR ...
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.revisions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  major           INT         NOT NULL DEFAULT 1,
  minor           INT         NOT NULL DEFAULT 0,
  version_label   TEXT        GENERATED ALWAYS AS ('V' || major || '.' || minor) STORED,
  storage_path    TEXT        NOT NULL,     -- Supabase Storage object path
  file_hash       TEXT        NOT NULL,     -- SHA-256 of uploaded file
  change_summary  TEXT        NOT NULL,
  authored_by     UUID        NOT NULL REFERENCES profiles(id),
  approved_by     UUID        REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  esig_hash       TEXT,                     -- Hashed electronic signature token
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Only one version label per document (V1.0, V1.1, V2.0 etc.)
CREATE UNIQUE INDEX idx_revisions_version ON revisions(document_id, major, minor);

-- GIN index for full-text search
CREATE INDEX idx_documents_fts ON documents USING gin(fts_vector);
-- For doc code partial searches
CREATE INDEX idx_documents_doc_code ON documents(doc_code);
-- For status + area queries (common dashboard filter)
CREATE INDEX idx_documents_status_area ON documents(status, functional_area);
-- For review due date alerts
CREATE INDEX idx_documents_review_due ON documents(review_due_date) WHERE deleted_at IS NULL;

-- Self-referencing FK (set after first insert)
ALTER TABLE documents ADD CONSTRAINT fk_current_rev
  FOREIGN KEY (current_rev_id) REFERENCES revisions(id) DEFERRABLE INITIALLY DEFERRED;

-- updated_at auto-stamp
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;

-- Helper functions (read from app_metadata — server-controlled, not user-writable)
CREATE OR REPLACE FUNCTION public.jwt_role() RETURNS TEXT AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.jwt_department() RETURNS TEXT AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'department')::TEXT;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Viewers: approved docs in own dept, or public docs, or admin sees all
CREATE POLICY docs_select ON documents
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL AND (
      jwt_role() = 'admin'
      OR security_class = 'public'
      OR (functional_area = jwt_department() AND status = 'approved')
    )
  );

-- Editors see their own drafts regardless of dept
CREATE POLICY docs_select_own_drafts ON documents
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL AND
    jwt_role() IN ('editor','admin') AND
    owner_id = auth.uid()
  );

-- Reviewers see under_review docs for their dept
CREATE POLICY docs_select_reviewer ON documents
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL AND
    jwt_role() IN ('reviewer','admin') AND
    functional_area = jwt_department() AND
    status = 'under_review'
  );

CREATE POLICY docs_insert ON documents
  FOR INSERT TO authenticated WITH CHECK (
    jwt_role() IN ('editor','admin') AND owner_id = auth.uid()
  );

CREATE POLICY docs_update ON documents
  FOR UPDATE TO authenticated USING (
    (owner_id = auth.uid() OR jwt_role() = 'admin') AND
    status NOT IN ('approved','obsolete')
  );

CREATE POLICY docs_delete ON documents
  FOR DELETE TO authenticated USING (jwt_role() = 'admin');

-- Revisions: visible where parent document is visible
CREATE POLICY revisions_select ON revisions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id)
  );

CREATE POLICY revisions_insert ON revisions
  FOR INSERT TO authenticated WITH CHECK (
    jwt_role() IN ('editor','admin') AND
    authored_by = auth.uid()
  );

-- Only admins/reviewers can set approved_by
CREATE POLICY revisions_approve ON revisions
  FOR UPDATE TO authenticated USING (
    jwt_role() IN ('reviewer','admin')
  );
