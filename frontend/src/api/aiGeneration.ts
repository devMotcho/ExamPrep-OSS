import { axiosInstance } from './axiosInstance';

export interface GeneratedOption {
  text: string;
  correct: boolean;
}

export interface GeneratedQuestion {
  prompt: string;
  explanation?: string | null;
  chapter?: string | null;
  sourcePage?: number;
  options: GeneratedOption[];
}

export interface AiGenerationStatus {
  available: boolean;
  providerName: string | null;
  quota: { limit: number; used: number; windowDays: number; nextAvailableAt: string | null };
}

export interface AiGenerationJob {
  id: string;
  studyAreaId: string;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'COMPLETED' | 'DISCARDED' | 'EXPIRED';
  progress: number;
  filename?: string;
  pageCount: number;
  attempts: number;
  canRetry: boolean;
  errorCode?: string;
  errorMessage?: string;
  savedCount?: number;
  createdAt: string;
  questions?: GeneratedQuestion[];
}

const upload = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('consent', 'true');
  return formData;
};
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export const aiGenerationApi = {
  getStatus: async (studyAreaId: string) =>
    (await axiosInstance.get<AiGenerationStatus>(`/api/study-areas/${studyAreaId}/ai-generation/status`)).data,

  // Reached only after the user ticks the consent box in the dialog.
  createJob: async (studyAreaId: string, file: File) =>
    (await axiosInstance.post<AiGenerationJob>(`/api/study-areas/${studyAreaId}/ai-generation/jobs`, upload(file), multipart)).data,

  retryJob: async (jobId: string, file: File) =>
    (await axiosInstance.post<AiGenerationJob>(`/api/ai-generation/jobs/${jobId}/retry`, upload(file), multipart)).data,

  getOpenJob: async (studyAreaId: string) => {
    const res = await axiosInstance.get<AiGenerationJob>(`/api/study-areas/${studyAreaId}/ai-generation/jobs/open`);
    return res.status === 204 ? null : res.data;
  },

  getJob: async (jobId: string) =>
    (await axiosInstance.get<AiGenerationJob>(`/api/ai-generation/jobs/${jobId}`)).data,

  approve: async (jobId: string, questions: GeneratedQuestion[]) =>
    (await axiosInstance.post<AiGenerationJob>(`/api/ai-generation/jobs/${jobId}/approve`, { questions })).data,

  discard: async (jobId: string) =>
    (await axiosInstance.post<AiGenerationJob>(`/api/ai-generation/jobs/${jobId}/discard`)).data,

  // Developer settings
  testConnection: async () =>
    (await axiosInstance.post<{ ok: boolean; provider: string; model: string; code?: string; message?: string }>('/api/config/ai/test')).data,

  getUsage: async () =>
    (await axiosInstance.get<{ spentThisMonthUsd: number; capUsd: number }>('/api/config/ai/usage')).data,
};
