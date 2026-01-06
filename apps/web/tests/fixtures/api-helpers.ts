/**
 * API helper functions for E2E testing
 * These provide direct API access for setup/teardown and verification
 */

import { API_URL } from './test-users'

/**
 * API client for making authenticated requests
 */
export class ApiClient {
  private token: string | null = null
  private baseUrl: string

  constructor(baseUrl: string = API_URL, token?: string) {
    this.baseUrl = baseUrl
    if (token) this.token = token
  }

  /**
   * Set authentication token
   */
  setToken(token: string) {
    this.token = token
  }

  /**
   * Get authentication token
   */
  getToken(): string | null {
    return this.token
  }

  /**
   * Make an authenticated API request
   */
  private async request(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }

  /**
   * Authentication endpoints (Better Auth)
   */
  async signup(data: { email: string; password: string; name: string }) {
    return this.request('/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async login(email: string, password: string) {
    return this.request('/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async logout() {
    return this.request('/auth/sign-out', { method: 'POST' })
  }

  async getSession() {
    return this.request('/auth/session')
  }

  /**
   * Networks endpoints
   */
  async getNetworks(params?: { status?: string; search?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams(params as any).toString()
    return this.request(`/networks${qs ? `?${qs}` : ''}`)
  }

  async getNetwork(id: string) {
    return this.request(`/networks/${id}`)
  }

  async createNetwork(data: any) {
    return this.request('/networks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteNetwork(id: string) {
    return this.request(`/networks/${id}`, { method: 'DELETE' })
  }

  /**
   * Dictionaries endpoints
   */
  async getDictionaries(params?: { status?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams(params as any).toString()
    return this.request(`/dictionaries${qs ? `?${qs}` : ''}`)
  }

  async getDictionary(id: string) {
    return this.request(`/dictionaries/${id}`)
  }

  async uploadDictionary(formData: FormData) {
    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    // Don't set Content-Type for FormData - browser will set boundary
    return fetch(`${this.baseUrl}/dictionaries/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })
  }

  async deleteDictionary(id: string) {
    return this.request(`/dictionaries/${id}`, { method: 'DELETE' })
  }

  /**
   * Jobs endpoints
   */
  async getJobs(params?: { status?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams(params as any).toString()
    return this.request(`/jobs${qs ? `?${qs}` : ''}`)
  }

  async getJob(id: string) {
    return this.request(`/jobs/${id}`)
  }

  async createJob(data: {
    name: string
    networkId: string
    dictionaryId: string
    config: any
  }) {
    return this.request('/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async cancelJob(id: string) {
    return this.request(`/jobs/${id}/cancel`, { method: 'POST' })
  }

  async retryJob(id: string) {
    return this.request(`/jobs/${id}/retry`, { method: 'POST' })
  }

  async deleteJob(id: string) {
    return this.request(`/jobs/${id}`, { method: 'DELETE' })
  }

  /**
   * Results endpoints
   */
  async getResults(params?: { type?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams(params as any).toString()
    return this.request(`/results${qs ? `?${qs}` : ''}`)
  }

  async getResultsByJob(jobId: string) {
    return this.request(`/results/by-job/${jobId}`)
  }

  async getResultsByNetwork(networkId: string) {
    return this.request(`/results/by-network/${networkId}`)
  }

  /**
   * Users endpoints (admin only)
   */
  async getUsers(params?: { page?: number; limit?: number }) {
    const qs = new URLSearchParams(params as any).toString()
    return this.request(`/users${qs ? `?${qs}` : ''}`)
  }

  async createUser(data: { email: string; name: string; password?: string; role?: string }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateUser(id: string, data: { name?: string; role?: string }) {
    return this.request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, { method: 'DELETE' })
  }

  /**
   * Captures endpoints
   */
  async getCaptures(params?: { status?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams(params as any).toString()
    return this.request(`/captures${qs ? `?${qs}` : ''}`)
  }

  async getCapture(id: string) {
    return this.request(`/captures/${id}`)
  }

  async deleteCapture(id: string) {
    return this.request(`/captures/${id}`, { method: 'DELETE' })
  }

  async uploadCapture(formData: FormData) {
    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return fetch(`${this.baseUrl}/captures/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })
  }

  /**
   * Health check
   */
  async getHealth() {
    return this.request('/health')
  }
}

/**
 * Create an authenticated API client
 */
export async function createAuthenticatedClient(
  email: string,
  password: string,
  baseUrl?: string,
): Promise<{ client: ApiClient; user: any }> {
  const client = new ApiClient(baseUrl)

  const response = await client.login(email, password)
  if (!response.ok) {
    throw new Error(`Failed to authenticate: ${response.statusText}`)
  }

  const data = await response.json()
  client.setToken(data.token)

  return { client, user: data.user || data.session?.user }
}

/**
 * Helper to cleanup test data
 */
export async function cleanupTestData(client: ApiClient) {
  // Delete all test networks
  const networksRes = await client.getNetworks()
  if (networksRes.ok) {
    const networks = await networksRes.json()
    if (networks.data) {
      for (const network of networks.data) {
        if (network.ssid?.startsWith('E2E') || network.ssid?.startsWith('Test')) {
          await client.deleteNetwork(network.id).catch(() => {})
        }
      }
    }
  }

  // Delete all test dictionaries
  const dictsRes = await client.getDictionaries()
  if (dictsRes.ok) {
    const dicts = await dictsRes.json()
    if (dicts.data) {
      for (const dict of dicts.data) {
        if (dict.name?.startsWith('E2E') || dict.name?.startsWith('Test')) {
          await client.deleteDictionary(dict.id).catch(() => {})
        }
      }
    }
  }

  // Cancel/delete all test jobs
  const jobsRes = await client.getJobs()
  if (jobsRes.ok) {
    const jobs = await jobsRes.json()
    if (jobs.data) {
      for (const job of jobs.data) {
        if (job.name?.startsWith('E2E') || job.name?.startsWith('Test')) {
          if (job.status === 'running' || job.status === 'pending') {
            await client.cancelJob(job.id).catch(() => {})
          }
          await client.deleteJob(job.id).catch(() => {})
        }
      }
    }
  }

  // Delete all test captures
  const capturesRes = await client.getCaptures()
  if (capturesRes.ok) {
    const captures = await capturesRes.json()
    if (captures.data) {
      for (const capture of captures.data) {
        if (capture.filename?.startsWith('e2e-') || capture.filename?.startsWith('test-')) {
          await client.deleteCapture(capture.id).catch(() => {})
        }
      }
    }
  }
}
