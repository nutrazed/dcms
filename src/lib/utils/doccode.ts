/**
 * Generate a document code following the DCMS naming convention:
 *   YYMM-AREA-TYPE-NNN
 *
 * Example: 2501-QMS-POL-001
 */
export function generateDocCode(
  functionalArea: string,
  docType: string,
  sequence: number
): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const typeCode = DOC_TYPE_CODES[docType] ?? docType.toUpperCase().slice(0, 3)
  const seq = String(sequence).padStart(3, '0')
  return `${yy}${mm}-${functionalArea.toUpperCase()}-${typeCode}-${seq}`
}

const DOC_TYPE_CODES: Record<string, string> = {
  policy:           'POL',
  procedure:        'PRO',
  work_instruction: 'WI',
  form:             'FRM',
  record:           'REC',
}
