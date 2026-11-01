import { axiosInstance } from './axiosInstance';

export type BlogLocale = 'pt' | 'en';
export type BlogStatus = 'DRAFT' | 'PUBLISHED';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// Uploaded files are served by the API, so their addresses need its base.
export const mediaUrl = (src = '') => (src.startsWith('/api/blog/media/') ? `${API_BASE}${src}` : src);

export interface BlogPostSummary {
  id: string;
  slug: string;
  locale: BlogLocale;
  title: string;
  excerpt: string;
  featureKey: string | null;
  status: BlogStatus;
  authorName: string;
  readingMinutes: number;
  publishedAt: string | null;
  updatedAt: string;
  coverUrl: string | null;
}

export interface BlogPost extends BlogPostSummary {
  contentMd: string;
  translations: BlogLocale[];
}

export interface BlogPostInput {
  title: string;
  slug: string;
  locale: BlogLocale;
  excerpt: string;
  contentMd: string;
  featureKey: string;
  status: BlogStatus;
  coverUrl: string;
}

export const blogApi = {
  list: async (locale: string, feature?: string) =>
    (await axiosInstance.get<BlogPostSummary[]>('/api/blog/posts', { params: { locale, feature } })).data,

  get: async (locale: string, slug: string) =>
    (await axiosInstance.get<BlogPost>(`/api/blog/posts/${locale}/${slug}`)).data,

  // Developer only
  listAll: async () => (await axiosInstance.get<BlogPostSummary[]>('/api/blog/manage/posts')).data,

  getForEditing: async (id: string) => (await axiosInstance.get<BlogPost>(`/api/blog/manage/posts/${id}`)).data,

  create: async (input: BlogPostInput) => (await axiosInstance.post<BlogPost>('/api/blog/manage/posts', input)).data,

  update: async (id: string, input: BlogPostInput) =>
    (await axiosInstance.put<BlogPost>(`/api/blog/manage/posts/${id}`, input)).data,

  remove: async (id: string) => {
    await axiosInstance.delete(`/api/blog/manage/posts/${id}`);
  },

  uploadMedia: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return (await axiosInstance.post<{ url: string; contentType: string }>('/api/blog/manage/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0, // a video can take longer than the default limit
    })).data;
  },
};

// Keys a post can be attached to, so the feature's screen can point to it.
export const BLOG_FEATURES = [
  { key: 'ai-generation', label: 'AI question generation' },
  { key: 'questions', label: 'Creating questions' },
] as const;

export type BlogFeatureKey = (typeof BLOG_FEATURES)[number]['key'];
