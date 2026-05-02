/**
 * Tiny class-merger. Falsy values dropped, arrays flattened, no duplicates.
 * Lighter than clsx + tailwind-merge for our use case.
 */
export function cn(...inputs: Array<string | false | null | undefined | 0>): string {
  return inputs.filter(Boolean).join(' ')
}
