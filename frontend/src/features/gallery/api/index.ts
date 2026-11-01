import { axiosInstance } from '@/api/axiosInstance';
import type { GalleryImage } from '../types';

export const galleryApi = {
  fetchImages: async (): Promise<GalleryImage[]> => {
    const { data } = await axiosInstance.get('/gallery');
    return data;
  },
  
  uploadImage: async (file: File, folder?: string): Promise<GalleryImage> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) {
      formData.append('folder', folder);
    }
    const { data } = await axiosInstance.post('/gallery', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  deleteImage: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/gallery/${id}`);
  },



  renameImage: async (id: string, filename: string): Promise<GalleryImage> => {
    const { data } = await axiosInstance.put(`/gallery/${id}`, { filename });
    return data;
  }
};
