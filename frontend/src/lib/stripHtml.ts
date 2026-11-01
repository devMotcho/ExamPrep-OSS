/**
 * The plain text of stored rich text. DOMParser builds an inert document: unlike innerHTML on a detached
 * element, it runs no scripts, fires no event handlers and loads no images.
 */
export const stripHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
};

/** For values placed into a string that is rendered as HTML. */
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
