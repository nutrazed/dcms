-- ============================================================
-- DCMS Migration 002: Folders (LTREE recursive hierarchy)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS ltree;

CREATE TABLE public.folders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID        REFERENCES folders(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  path            LTREE       NOT NULL UNIQUE,  -- e.g. 'QMS.Procedures.SOPs'
  functional_area TEXT        NOT NULL,         -- QMS | ISM | OPS | LGL | HRS | FIN
  owner_dept      TEXT        NOT NULL,
  created_by      UUID        REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- GiST index makes subtree queries O(log n)
CREATE INDEX idx_folders_path ON folders USING gist(path);
-- B-tree for exact lookups
CREATE INDEX idx_folders_functional_area ON folders(functional_area);

-- RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY folders_select_all ON public.folders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY folders_insert_admin ON public.folders
  FOR INSERT TO authenticated WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'editor')
  );

CREATE POLICY folders_update_admin ON public.folders
  FOR UPDATE TO authenticated USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Seed: default functional area folders
INSERT INTO public.folders (name, path, functional_area, owner_dept) VALUES
  ('Quality Management',   'QMS', 'QMS', 'QMS'),
  ('Information Security', 'ISM', 'ISM', 'ISM'),
  ('Operations',           'OPS', 'OPS', 'OPS'),
  ('Legal & Regulatory',   'LGL', 'LGL', 'LGL'),
  ('Human Resources',      'HRS', 'HRS', 'HRS'),
  ('Finance & Audit',      'FIN', 'FIN', 'FIN'),
  ('Records',              'REC', 'REC', 'REC');
