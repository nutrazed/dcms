'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, useRef } from 'react'
import { createDocumentWithUpload } from '@/lib/actions/documents'
import { IconUpload, IconFile, IconX, IconCheck } from '@/components/ui/Icons'

const DOC_TYPES = [
  { value: 'policy',           label: 'Policy' },
  { value: 'procedure',        label: 'Procedure' },
  { value: 'work_instruction', label: 'Work instruction' },
  { value: 'form',             label: 'Form' },
  { value: 'record',           label: 'Record' },
] as const

const AREAS = ['QMS', 'OPS', 'HR', 'FIN', 'IT'] as const
const SECURITY = ['public', 'internal', 'confidential', 'restricted'] as const

export function UploadForm({ defaultArea }: { defaultArea?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function pickFile(f: File | null | undefined) {
    if (!f) return
    if (f.size > 52_428_800) {
      setError('File exceeds 50 MB limit')
      return
    }
    setError(null)
    setFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  function handleSubmit(formData: FormData) {
    if (!file) {
      setError('Please select a file')
      return
    }
    formData.set('file', file)

    startTransition(async () => {
      setError(null)
      const result = await createDocumentWithUpload(formData)
      if (result.ok) {
        router.push(`/documents/${result.documentId}?created=1`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* File dropzone */}
      <div>
        <label className="label">Document file</label>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-colors ${
            dragOver
              ? 'border-accent bg-accent/5'
              : file
              ? 'border-success/40 bg-success/5'
              : 'border-line hover:border-line-strong bg-bg-inset'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => pickFile(e.target.files?.[0])}
            className="hidden"
          />

          {!file ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-bg-elev text-ink-mute">
                <IconUpload size={20} />
              </div>
              <div className="text-sm font-medium text-ink">
                Drop a file here, or click to browse
              </div>
              <div className="mt-1 text-2xs text-ink-mute">
                PDF or DOCX · up to 50 MB
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex size-10 items-center justify-center rounded-md bg-success/10 text-success shrink-0">
                <IconFile size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{file.name}</div>
                <div className="text-2xs text-ink-mute">{(file.size / 1024).toFixed(1)} KB · {file.type || 'unknown'}</div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                className="btn-ghost"
              >
                <IconX size={14} /> Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Title</label>
          <input
            name="title"
            type="text"
            required
            minLength={3}
            maxLength={200}
            placeholder="e.g. Information Security Policy"
            className="input"
          />
        </div>

        <div>
          <label className="label">Type</label>
          <select name="docType" required defaultValue="policy" className="input">
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Functional area</label>
          <select name="functionalArea" required defaultValue={defaultArea || 'QMS'} className="input">
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Security classification</label>
          <select name="securityClass" required defaultValue="internal" className="input">
            {SECURITY.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Retention (years)</label>
          <input
            name="retentionYears"
            type="number"
            min={1}
            max={30}
            defaultValue={3}
            required
            className="input"
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Change summary</label>
          <textarea
            name="changeSummary"
            required
            minLength={10}
            maxLength={500}
            rows={3}
            placeholder="What is this document for? What's changed in this initial version?"
            className="input resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-danger/10 border border-danger/20 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={pending || !file} className="btn-primary">
          {pending ? 'Uploading…' : (<><IconCheck size={14} /> Create document</>)}
        </button>
      </div>
    </form>
  )
}
