import axios, { AxiosError } from 'axios';

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token if available
apiClient.interceptors.request.use(
  (config) => {
    // Add any auth token logic here if needed
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for consistent error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    // Handle different types of errors
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.data?.message || error.message);
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network Error: No response received');
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export class ApiClient {
  static async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await apiClient.get<T>(url, { params });
    return response.data;
  }

  static async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await apiClient.post<T>(url, data);
    return response.data;
  }

  static async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await apiClient.put<T>(url, data);
    return response.data;
  }

  static async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await apiClient.patch<T>(url, data);
    return response.data;
  }

  static async delete<T>(url: string): Promise<T> {
    const response = await apiClient.delete<T>(url);
    return response.data;
  }

  static async upload<T>(url: string, formData: FormData, onProgress?: (progress: number) => void): Promise<T> {
    const response = await apiClient.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  }
}

export default apiClient;