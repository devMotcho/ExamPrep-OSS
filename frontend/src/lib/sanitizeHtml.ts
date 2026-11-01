import DOMPurify from 'dompurify';

// Question content comes from users (editor, JSON import) and is shown to other students.
export const sanitizeHtml = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true } });
