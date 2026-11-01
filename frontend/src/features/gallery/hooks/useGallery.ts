import { useState, useCallback } from 'react';
import { galleryApi } from '../api';
import type { GalleryImage } from '../types';
import { useTranslation } from 'react-i18next';

export const useGallery = () => {
  const { t } = useTranslation();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await galleryApi.fetchImages();
      setImages(data);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(t('gallery.errorAccess', 'Gallery access is disabled.'));
      } else {
        setError(t('gallery.errorLoad', 'Failed to load gallery images.'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  const uploadImage = async (file: File, folder?: string) => {
    try {
      setUploading(true);
      const newImg = await galleryApi.uploadImage(file, folder);
      setImages(prev => [newImg, ...prev]);
      return newImg;
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (id: string) => {
    await galleryApi.deleteImage(id);
    setImages(prev => prev.filter(i => i.id !== id));
  };

  const renameImage = async (id: string, filename: string) => {
    const updatedImg = await galleryApi.renameImage(id, filename);
    setImages(prev => prev.map(i => i.id === id ? updatedImg : i));
    return updatedImg;
  };

  return {
    images,
    loading,
    error,
    uploading,
    fetchImages,
    uploadImage,
    deleteImage,
    renameImage
  };
};
