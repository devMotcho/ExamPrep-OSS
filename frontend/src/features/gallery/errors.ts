import type { TFunction } from 'i18next';

/** Friendly text for a failed gallery action; server and S3 details never reach the page. */
export const galleryErrorMessage = (err: any, t: TFunction, action: 'upload' | 'delete' | 'rename'): string => {
  const status = err?.response?.status;
  if (action === 'upload') {
    if (status === 413) return t('gallery.errors.tooLarge', 'That image is too large. Try a smaller file.');
    if (status === 503) return t('gallery.errors.unavailable', 'Image uploads are not available right now. Try again later.');
    return t('gallery.errors.upload', 'We could not upload your image. Try again.');
  }
  if (action === 'delete') return t('gallery.errors.delete', 'We could not delete the image. Try again.');
  return t('gallery.errors.rename', 'We could not rename the image. Try again.');
};
