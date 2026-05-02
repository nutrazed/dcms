export interface VersionSpec {
  major: number
  minor: number
}

/**
 * Compute the next version given the current latest and whether this is a major bump.
 * - Major bump: V1.3 → V2.0  (structural change, new policy requirement)
 * - Minor bump: V1.3 → V1.4  (typo fix, clarification, formatting)
 */
export function nextVersion(
  latest: VersionSpec | null | undefined,
  isMajor: boolean
): VersionSpec {
  if (!latest) return { major: 1, minor: 0 }  // First revision

  if (isMajor) {
    return { major: latest.major + 1, minor: 0 }
  }
  return { major: latest.major, minor: latest.minor + 1 }
}

export function formatVersion({ major, minor }: VersionSpec): string {
  return `V${major}.${minor}`
}

/**
 * Returns true if the version is a major release (minor === 0)
 */
export function isMajorRelease({ minor }: VersionSpec): boolean {
  return minor === 0
}
