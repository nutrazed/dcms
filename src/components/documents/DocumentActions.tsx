'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { approveDocument, rejectDocument, submitForReview, obsoleteDocument } from '@/lib/actions/documents'
import { IconCheck, IconX, IconClock, IconAlert } from '@/components/ui/Icons'

interface Props {
  documentId: string
  currentRevisionId: string | null
  status: string
  isOwner: boolean
  role: string
}

export function DocumentActions({ documentId, currentRevisionId, status, isOwner, role }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [esig, setEsig] = useState('')
  const [reason, setReason] = useState('')

  const canSubmit  = status === 'draft' && (isOwner || role === 'admin')
  const canDecide  = status === 'under_review' && ['reviewer', 'admin'].includes(role)
  const canRetire  = status === 'approved' && role === 'admin'

  function handleSubmit() {
    if (!currentRevisionId) {
      setError('Cannot submit: no revision uploaded yet')
      return
    }
    startTransition(async () => {
      setError(null)
      // Submit-for-review requires reviewer IDs; for now we'll just update status.
      // In a real app, you'd open a reviewer-picker modal here.
      const result = await submitForReview(documentId, [])
      if (!result.ok) setError(result.error ?? 'Submit failed')
      else router.refresh()
    })
  }

  function handleApprove() {
    if (!currentRevisionId) {
      setError('No current revision to approve')
      return
    }
    if (esig.length < 4) {
      setError('Type your e-signature token (any string ≥ 4 chars)')
      return
    }
    startTransition(async () => {
      setError(null)
      const result = await approveDocument(currentRevisionId, esig)
      if (!result.ok) setError(result.error ?? 'Approval failed')
      else {
        setShowApprove(false)
        setEsig('')
        router.refresh()
      }
    })
  }

  function handleReject() {
    if (!currentRevisionId) return
    if (reason.trim().length < 5) {
      setError('Provide a rejection reason (≥ 5 chars)')
      return
    }
    startTransition(async () => {
      setError(null)
      const result = await rejectDocument(currentRevisionId, reason)
      if (!result.ok) setError(result.error ?? 'Reject failed')
      else {
        setShowReject(false)
        setReason('')
        router.refresh()
      }
    })
  }

  function handleObsolete() {
    if (!confirm('Mark this document obsolete? This will hide it from active workflows.')) return
    startTransition(async () => {
      setError(null)
      const result = await obsoleteDocument(documentId, 'Manually retired by admin')
      if (!result.ok) setError(result.error ?? 'Retire failed')
      else router.refresh()
    })
  }

  if (!canSubmit && !canDecide && !canRetire) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSubmit && (
        <button onClick={handleSubmit} disabled={pending} className="btn-primary">
          <IconClock size={14} /> Submit for review
        </button>
      )}

      {canDecide && !showApprove && !showReject && (
        <>
          <button onClick={() => setShowApprove(true)} disabled={pending} className="btn-primary">
            <IconCheck size={14} /> Approve
          </button>
          <button onClick={() => setShowReject(true)} disabled={pending} className="btn-danger">
            <IconX size={14} /> Reject
          </button>
        </>
      )}

      {showApprove && (
        <div className="surface-elev p-4 w-full">
          <div className="text-sm font-semibold text-ink mb-1">Approve revision</div>
          <p className="text-2xs text-ink-mute mb-3">
            Type any e-signature token. The hash is stored — the raw token is never persisted.
          </p>
          <input
            type="text"
            value={esig}
            onChange={(e) => setEsig(e.target.value)}
            placeholder="e.g. your full name + date"
            className="input mb-3"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowApprove(false); setEsig('') }} className="btn-secondary">Cancel</button>
            <button onClick={handleApprove} disabled={pending} className="btn-primary">
              {pending ? 'Approving…' : 'Confirm approval'}
            </button>
          </div>
        </div>
      )}

      {showReject && (
        <div className="surface-elev p-4 w-full">
          <div className="text-sm font-semibold text-ink mb-1">Reject revision</div>
          <p className="text-2xs text-ink-mute mb-3">Reason will be visible to the document author.</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What needs to change before this can be approved?"
            rows={3}
            className="input resize-none mb-3"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowReject(false); setReason('') }} className="btn-secondary">Cancel</button>
            <button onClick={handleReject} disabled={pending} className="btn-danger">
              {pending ? 'Rejecting…' : 'Confirm rejection'}
            </button>
          </div>
        </div>
      )}

      {canRetire && !showApprove && !showReject && (
        <button onClick={handleObsolete} disabled={pending} className="btn-secondary">
          <IconAlert size={14} /> Mark obsolete
        </button>
      )}

      {error && (
        <div className="w-full rounded-md bg-danger/10 border border-danger/20 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  )
}
