import { User, VideoItem, SplitJob, UserStorageStats, PlatformStats, ProcessingMode, OutputResolution } from './types';

const TOKEN_KEY = 'splitstudio_token';
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const url = `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

 if (!response.ok) {
  const responseText = await response.text();
  let errorMsg = responseText || 'An unexpected error occurred';

  try {
    const errData = JSON.parse(responseText);
    errorMsg = errData.error || errorMsg;
  } catch {
    // Keep the original response text
  }

  throw new Error(errorMsg);
}

  return response.json();
}

export const api = {
  // Auth
  completeRegistration: (name: string, password: string, idToken: string) =>
    request<{ user: User; token: string }>('/api/auth/complete-registration', {
      method: 'POST',
      body: JSON.stringify({ name, password, idToken }),
    }),

  login: (email: string, password: string) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<{ user: User }>('/api/auth/me'),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  // Videos
  uploadVideo: (file: File, title?: string, onProgress?: (pct: number) => void): Promise<VideoItem> => {
    return new Promise((resolve, reject) => {
      const token = getStoredToken();
      const formData = new FormData();
      formData.append('video', file);
      if (title) formData.append('title', title);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/api/videos/upload`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.response);
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during video upload'));
      xhr.send(formData);
    });
  },

  createSampleVideo: () =>
    request<VideoItem>('/api/videos/create-sample', {
      method: 'POST',
    }),

  getVideos: () => request<VideoItem[]>('/api/videos'),

  getVideo: (id: string) => request<VideoItem>(`/api/videos/${id}`),

  deleteVideo: (id: string) =>
    request<{ success: boolean }>(`/api/videos/${id}`, {
      method: 'DELETE',
    }),

  getVideoStreamUrl: (id: string) => {
    const token = getStoredToken();
    return `${BASE_URL}/api/videos/${id}/stream?token=${encodeURIComponent(token || '')}`;
  },

  getVideoThumbnailUrl: (id: string) => `${BASE_URL}/api/videos/${id}/thumbnail`,

  // Jobs
  createJob: (payload: {
    videoId: string;
    splitPoints: number[];
    mode: ProcessingMode;
    resolution: OutputResolution;
    customNames?: string[];
  }) =>
    request<SplitJob>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getJobs: () => request<SplitJob[]>('/api/jobs'),

  getJob: (id: string) => request<SplitJob>(`/api/jobs/${id}`),

  cancelJob: (id: string) =>
    request<{ success: boolean }>(`/api/jobs/${id}/cancel`, {
      method: 'POST',
    }),

  deleteJob: (id: string) =>
    request<{ success: boolean }>(`/api/jobs/${id}`, {
      method: 'DELETE',
    }),

  getClipStreamUrl: (jobId: string, clipId: string) => {
    const token = getStoredToken();
    return `${BASE_URL}/api/clips/${jobId}/${clipId}/stream?token=${encodeURIComponent(token || '')}`;
  },

  getClipDownloadUrl: (jobId: string, clipId: string) => {
    const token = getStoredToken();
    return `${BASE_URL}/api/clips/${jobId}/${clipId}/download?token=${encodeURIComponent(token || '')}`;
  },

  getJobZipDownloadUrl: (jobId: string) => {
    const token = getStoredToken();
    return `${BASE_URL}/api/jobs/${jobId}/download-zip?token=${encodeURIComponent(token || '')}`;
  },

  // Storage
  getUserStorage: () => request<UserStorageStats>('/api/user/storage'),

  // Admin
  getAdminStats: () => request<PlatformStats>('/api/admin/stats'),

  getAdminUsers: () => request<User[]>('/api/admin/users'),

  updateAdminUser: (
    userId: string,
    updates: { role?: 'admin' | 'user'; storageQuotaBytes?: number; status?: 'active' | 'suspended' }
  ) =>
    request<User>(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteAdminUser: (userId: string) =>
    request<{ success: boolean }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    }),

  getAdminJobs: () => request<SplitJob[]>('/api/admin/jobs'),

  cancelAdminJob: (jobId: string) =>
    request<{ success: boolean }>(`/api/admin/jobs/${jobId}/cancel`, {
      method: 'POST',
    }),
};
