/** Only in-app paths are accepted as a post-sign-in destination (no open redirects). */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/sign-in')) return '/'
  return next
}
