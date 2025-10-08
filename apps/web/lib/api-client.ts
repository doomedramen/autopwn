// Use the correct host for Docker tests
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === '[::1]' || hostname === '::1') {
      return 'http://[::1]:3001';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    // Include auth cookies if available
    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include', // Important for cookies
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async signIn(email: string, password: string) {
    return this.request('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async signUp(email: string, password: string, name?: string) {
    return this.request('/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async signOut() {
    return this.request('/api/auth/sign-out', {
      method: 'POST',
    });
  }

  async getSession() {
    return this.request('/api/auth/get-session');
  }

  // Jobs endpoints
  async getJobs() {
    return this.request('/api/jobs/list');
  }

  async getJob(id: number) {
    return this.request(`/api/jobs/${id}`);
  }

  async createJob(data: {
    filename: string;
    dictionaryIds: number[];
    priority?: number;
  }) {
    return this.request('/api/jobs/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getJobItems(jobId: number) {
    return this.request(`/api/jobs/${jobId}/items`);
  }

  async getJobStatus(jobId: number) {
    return this.request(`/api/jobs/${jobId}/status`);
  }

  async getJobLogs(jobId: number) {
    return this.request(`/api/jobs/${jobId}/logs`);
  }

  async getJobStats(jobId: number) {
    return this.request(`/api/jobs/${jobId}/stats`);
  }

  async updateJobProgress(jobId: number, data: {
    progress?: number;
    speed?: string;
    eta?: string;
    itemsCracked?: number;
    hashCount?: number;
    currentDictionary?: string;
    logs?: string;
  }) {
    return this.request(`/api/jobs/${jobId}/progress`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async pauseJob(jobId: number) {
    return this.request(`/api/jobs/${jobId}/pause`, {
      method: 'POST',
    });
  }

  async resumeJob(jobId: number) {
    return this.request(`/api/jobs/${jobId}/resume`, {
      method: 'POST',
    });
  }

  async stopJob(jobId: number) {
    return this.request(`/api/jobs/${jobId}/stop`, {
      method: 'POST',
    });
  }

  async restartJob(jobId: number) {
    return this.request(`/api/jobs/${jobId}/restart`, {
      method: 'POST',
    });
  }

  async updateJobPriority(jobId: number, priority: number) {
    return this.request(`/api/jobs/${jobId}/priority`, {
      method: 'PUT',
      body: JSON.stringify({ priority }),
    });
  }

  async deleteJob(jobId: number) {
    return this.request(`/api/jobs/${jobId}`, {
      method: 'DELETE',
    });
  }

  // Upload endpoints
  async uploadFiles(files: FileList) {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    return this.request('/api/upload/files', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  async createTestUpload(filename: string, content?: string) {
    return this.request('/api/upload/test', {
      method: 'POST',
      body: JSON.stringify({ filename, content }),
    });
  }

  // Dictionary endpoints
  async getDictionaries() {
    return this.request('/api/dictionaries');
  }

  async uploadDictionaries(files: FileList) {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    return this.request('/api/dictionaries', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  async createSimpleDictionary(name: string, content: string) {
    return this.request('/api/dictionaries/simple', {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    });
  }

  async deleteDictionary(id: number) {
    return this.request(`/api/dictionaries/${id}`, {
      method: 'DELETE',
    });
  }

  async getDictionaryCoverage(id: number) {
    return this.request(`/api/dictionaries/${id}/coverage`);
  }

  // Results endpoints
  async getResults(params?: {
    page?: number;
    limit?: number;
    jobId?: number;
    essid?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          query.append(key, value.toString());
        }
      });
    }
    const queryString = query.toString();
    return this.request(`/api/results/list${queryString ? `?${queryString}` : ''}`);
  }

  async getResult(id: number) {
    return this.request(`/api/results/${id}`);
  }

  async getJobResults(jobId: number) {
    return this.request(`/api/results/job/${jobId}`);
  }

  async getResultStats(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request(`/api/results/stats${query}`);
  }

  async searchResults(query: string, type?: string, page?: number, limit?: number) {
    const params = new URLSearchParams({ q: query });
    if (type) params.append('type', type);
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    return this.request(`/api/results/search?${params.toString()}`);
  }

  async exportResults(format?: string, filters?: {
    jobId?: number;
    essid?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    if (format) params.append('format', format);
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    const queryString = params.toString();

    const response = await fetch(`${this.baseUrl}/api/results/export${queryString ? `?${queryString}` : ''}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response;
  }

  async deleteResult(id: number) {
    return this.request(`/api/results/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkDeleteResults(filters: {
    jobId?: number;
    olderThan?: string;
  }) {
    return this.request('/api/results/bulk', {
      method: 'DELETE',
      body: JSON.stringify(filters),
    });
  }

  // Captures endpoints
  async getCaptures() {
    return this.request('/api/captures');
  }

  async deleteCapture(filename: string) {
    return this.request('/api/captures', {
      method: 'DELETE',
      body: JSON.stringify({ filename }),
    });
  }

  // Stats endpoints
  async getStats() {
    return this.request('/api/stats');
  }

  async getSuccessRate() {
    return this.request('/api/stats/success-rate');
  }

  async getRecentActivity() {
    return this.request('/api/stats/recent');
  }

  // Analytics endpoints
  async getAnalytics() {
    return this.request('/api/analytics');
  }

  async getJobAnalytics() {
    return this.request('/api/analytics/jobs');
  }

  async getResultAnalytics() {
    return this.request('/api/analytics/results');
  }
}

export const apiClient = new ApiClient();