# DCMS — Document Control Management System

> **ISO 9001:2015 / ISO 27001:2022 Compliant**  
> Built with Next.js 14 App Router · Supabase · Vercel Edge

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                   │
│  middleware.ts (route protection + session refresh)      │
│  /api/search   (Edge Runtime — global FTS endpoint)      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Next.js 14 App Router                   │
│  Server Components  →  Server Actions  →  Client UI      │
│  (RSC data fetch)      (mutations)      (TanStack Table)  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                      Supabase                            │
│  PostgreSQL + LTREE + FTS  │  Storage (private buckets)  │
│  Row Level Security (RLS)  │  Edge Functions (Deno)       │
│  Realtime (notifications)  │  Auth (custom JWT claims)    │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Supabase CLI
- Vercel CLI (optional)

### 1. Clone & install
```bash
git clone <your-repo>
cd dcms
pnpm install
```

### 2. Set up Supabase
```bash
# Start local Supabase (Docker required)
supabase start

# Run all migrations in order
supabase db reset
# or apply individually:
# supabase db push

# Generate TypeScript types
pnpm db:types
```

### 3. Configure environment
```bash
cp .env.example .env.local
# Fill in your Supabase project URL and keys
```

### 4. Run locally
```bash
pnpm dev
# Visit http://localhost:3000
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, OAuth callback
│   ├── (app)/               # Protected app routes
│   │   ├── dashboard/       # Review-due alerts + stats
│   │   ├── register/        # Document Control Register (TanStack Table)
│   │   ├── documents/       # Document CRUD + viewer
│   │   └── admin/           # User management, audit logs
│   └── api/
│       ├── search/          # FTS endpoint (Edge Runtime)
│       └── export/          # Audit CSV export
├── components/
│   ├── documents/           # RegisterTable, DocumentCard, StatusChip
│   └── upload/              # UploadZone, MetadataForm
├── lib/
│   ├── supabase/            # Client + server Supabase helpers
│   ├── actions/             # Server Actions (documents, audit)
│   └── utils/               # hash.ts, versioning.ts
├── middleware.ts             # Route protection + role gates
└── types/
    └── database.types.ts    # Supabase generated types
supabase/
├── migrations/              # SQL migrations (run in order)
│   ├── 001_profiles.sql
│   ├── 002_folders.sql
│   ├── 003_documents_revisions.sql
│   └── 004_audit_logs.sql
└── functions/
    └── watermark-pdf/       # Deno Edge Function
        └── index.ts
```

---

## Key Design Decisions

### Security
- **`app_metadata` for roles** — roles are set server-side only, preventing client-side privilege escalation
- **Append-only audit log** — `REVOKE UPDATE/DELETE/TRUNCATE` enforced at PostgreSQL level
- **Hash chain integrity** — each audit row stores SHA-256 of its content + hash of previous row
- **Watermarked previews** — user ID + timestamp embedded in every downloaded PDF

### Versioning
- `nextVersion(latest, isMajor)` — major bump resets minor to 0 (V1.3 → V2.0), minor increments only minor (V1.3 → V1.4)
- Composite `UNIQUE(document_id, major, minor)` makes version collisions a DB constraint, not application logic

### Performance
- `LTREE` extension for O(log n) subtree folder queries
- `TSVECTOR` generated column with GIN index for sub-10ms full-text search
- `review_due_date` generated column — always accurate, never stale
- TanStack Table with `manualFiltering/Sorting/Pagination` — all data operations server-side
- Search API on Edge Runtime — runs at 30+ global PoPs

---

## Document Naming Convention

```
YYMM-FUNC-TYPE-###
│    │    │    └── Sequential number (001–999)
│    │    └─────── Type: POL | PRO | WI | FRM | REC
│    └──────────── Functional area: QMS | ISM | OPS | LGL | HRS | FIN
└───────────────── Year-month of creation (e.g. 2501 = Jan 2025)

Example: 2501-QMS-POL-001 = Quality Policy, created Jan 2025, first policy
```

---

## RBAC Matrix

| Permission              | Viewer | Editor | Reviewer | Admin |
|-------------------------|:------:|:------:|:--------:|:-----:|
| View approved docs      | ✓      | ✓      | ✓        | ✓     |
| View own drafts         | —      | ✓      | ✓        | ✓     |
| Upload revision         | —      | ✓      | —        | ✓     |
| Submit for review       | —      | ✓      | —        | ✓     |
| Add review comments     | —      | —      | ✓        | ✓     |
| Approve / reject        | —      | —      | ✓        | ✓     |
| Retire / obsolete       | —      | —      | —        | ✓     |
| View audit logs         | —      | —      | —        | ✓     |
| Manage user roles       | —      | —      | —        | ✓     |

---

## Deployment

### Vercel (recommended)
```bash
vercel --prod
# Environment variables must be set in Vercel Dashboard
```

### Environment variables required
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) |

### Supabase Storage buckets to create
| Bucket | Access | Purpose |
|--------|--------|---------|
| `documents-private` | Private | Original revision files |
| `documents-preview` | Private (signed URL) | Watermarked PDFs |
| `avatars` | Public | Profile pictures |
| `exports` | Private (signed URL) | Audit log exports |

---

## Compliance Notes

This system is designed to support:
- **ISO 9001:2015 § 7.5** — Control of documented information
- **ISO 27001:2022 Annex A 5.33** — Protection of records
- **ISO 27001:2022 Annex A 8.15** — Logging

> ⚠️ This codebase provides technical infrastructure. Achieving full certification requires documented procedures, management review, and a certified auditor. Consult your compliance team.
