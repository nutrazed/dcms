import { NextResponse } from 'next/server'

/**
 * Document register export endpoint (CSV / XLSX).
 * TODO: implement server-side query → CSV stream with audit log entry.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Not implemented yet' },
    { status: 501 },
  )
}
