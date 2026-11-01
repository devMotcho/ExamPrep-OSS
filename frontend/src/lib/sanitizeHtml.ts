import DOMPurify from 'dompurify';

// Exactly what the Tiptap editor produces. The backend applies the same list on write (RichTextSanitizer);
// this copy protects content stored before that check existed.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'hr', 'a', 'span',
];
const ALLOWED_ATTR = ['href', 'start'];
const FORBID_TAGS = ['form', 'input', 'button', 'textarea', 'select', 'option', 'style', 'link', 'meta', 'base', 'iframe', 'object', 'embed', 'svg', 'math'];
// style and class could stretch content over the page; id and name could shadow page globals.
const FORBID_ATTR = ['style', 'class', 'id', 'name', 'srcset', 'action', 'formaction'];

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    // A link in a question must not navigate away from an exam in progress.
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
  }
});

// Question content comes from users (editor, JSON import) and is shown to other students.
export const sanitizeHtml = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
