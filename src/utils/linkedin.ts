/**
 * LinkedIn profile URL helpers.
 *
 * The "Connect on LinkedIn" button must never fail when tapped, so a URL is
 * validated and normalized at save time and only a canonical, openable
 * `https://www.linkedin.com/in/<slug>` is ever stored. `normalizeLinkedInUrl`
 * returns that canonical form for any accepted input, or `null` if the input
 * is not a personal LinkedIn profile URL.
 */

// Personal profile slugs are letters, digits, hyphens, underscores, and
// percent-encoding (for the occasional unicode vanity name).
const PROFILE_RE = /^linkedin\.com\/in\/([A-Za-z0-9\-_%]+)\/?(?:[?#].*)?$/i;

export function normalizeLinkedInUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;

  const stripped = raw
    .trim()
    .replace(/^https?:\/\//i, "") // drop scheme
    .replace(/^www\./i, ""); // drop leading www.

  const match = stripped.match(PROFILE_RE);
  if (!match) return null;

  const slug = match[1];
  if (!slug) return null;

  return `https://www.linkedin.com/in/${slug}`;
}

export function isValidLinkedInUrl(raw: string | null | undefined): boolean {
  return normalizeLinkedInUrl(raw) !== null;
}
