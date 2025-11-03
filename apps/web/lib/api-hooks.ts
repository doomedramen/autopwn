'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient, ResultsApi } from './api'
import type {
  User,
  LoginRequest,
  AuthResponse,
  Network,
  Dictionary,
  Job,
  JobResult,
  PaginatedResponse,
} from './types'

import { authClient } from './auth'

// Real API hooks that connect to our backend

// Authentication hooks using better-auth
export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: LoginRequest) => 
      authClient.signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: '/' // Redirect to home after login
      }),
    onSuccess: (data: any) => {
      queryClient.setQueryData(['auth', 'session'], data)
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] }) // This will trigger a refresh of session data
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => authClient.signOut({
      callbackURL: '/sign-in' // Redirect to sign-in after logout
    }),
    onSuccess: () => {
      queryClient.clear()
      // The redirect will be handled by Better Auth
    },
  })
}

export function useAuthSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const session = await authClient.getSession()
      return session?.session || null
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes if needed
  })
}

// Network hooks
export function useNetworks() {
  return useQuery({
    queryKey: ['networks'],
    queryFn: () => ApiClient.get('/api/networks'),
    staleTime: 30 * 1000,
    select: (data: any) => ({
      data: data.data || [],
      count: data.count || 0,
    }),
  })
}

export function useNetwork(id: string) {
  return useQuery({
    queryKey: ['networks', id],
    queryFn: () => ApiClient.get(`/api/networks/${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

export function useCreateNetwork() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Network>) =>
      ApiClient.post('/api/networks', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['networks'] })
    },
  })
}

export function useUpdateNetwork(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Network>) =>
      ApiClient.put(`/api/networks/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['networks'] })
      queryClient.invalidateQueries({ queryKey: ['networks', id] })
    },
  })
}

export function useDeleteNetwork(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => ApiClient.delete(`/api/networks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] })
    },
  })
}

// Dictionary hooks
export function useDictionaries() {
  return useQuery({
    queryKey: ['dictionaries'],
    queryFn: () => ApiClient.get('/api/dictionaries'),
    staleTime: 30 * 1000,
    select: (data: any) => ({
      data: data.data || [],
      count: data.count || 0,
    }),
  })
}

export function useDictionary(id: string) {
  return useQuery({
    queryKey: ['dictionaries', id],
    queryFn: () => ApiClient.get(`/api/dictionaries/${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

export function useCreateDictionary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Dictionary>) =>
      ApiClient.post('/api/dictionaries', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] })
    },
  })
}

export function useUpdateDictionary(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Dictionary>) =>
      ApiClient.put(`/api/dictionaries/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] })
      queryClient.invalidateQueries({ queryKey: ['dictionaries', id] })
    },
  })
}

export function useDeleteDictionary(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => ApiClient.delete(`/api/dictionaries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] })
    },
  })
}

// Job hooks
export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: () => ApiClient.get('/api/jobs'),
    staleTime: 10 * 1000, // Jobs update frequently
    select: (data: any) => ({
      data: data.data || [],
      count: data.count || 0,
    }),
  })
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => ApiClient.get(`/api/jobs/${id}`),
    enabled: !!id,
    staleTime: 5 * 1000,
  })
}

export function useCreateJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) =>
      ApiClient.post('/api/jobs', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

export function useUpdateJob(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Job>) =>
      ApiClient.put(`/api/jobs/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs', id] })
    },
  })
}

export function useDeleteJob(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => ApiClient.delete(`/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

// Queue Management hooks
export function useQueueStats() {
  return useQuery({
    queryKey: ['queue', 'stats'],
    queryFn: () => ApiClient.get('/api/queue/stats'),
    staleTime: 5 * 1000,
  })
}

export function useStartCrackingJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { networkId: string; dictionaryId: string; attackMode?: 'pmkid' | 'handshake' }) =>
      ApiClient.post('/api/queue/crack', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['networks'] })
    },
  })
}

export function useGenerateDictionary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; baseWords?: string[]; rules?: string[]; transformations?: string[] }) =>
      ApiClient.post('/api/queue/dictionary/generate', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] })
    },
  })
}

export function useCancelJob(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => ApiClient.delete(`/api/queue/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs', id] })
    },
  })
}

export function useRetryJob(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => ApiClient.post(`/api/queue/jobs/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs', id] })
    },
  })
}

export function useStartCleanup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { strategy: string; userId?: string }) =>
      ApiClient.post('/api/queue/cleanup', data),
  })
}

// User management hooks
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => ApiClient.get('/api/users'),
    staleTime: 60 * 1000,
    select: (data: any) => ({
      data: data.data || [],
      count: data.count || 0,
    }),
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => ApiClient.get(`/api/users/${id}`),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<User>) =>
      ApiClient.post('/api/users', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<User>) =>
      ApiClient.put(`/api/users/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users', id] })
    },
  })
}

export function useDeleteUser(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => ApiClient.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// File upload hooks (Uppy integration)
export function useFileUploadConfig() {
  return useQuery({
    queryKey: ['upload', 'config'],
    queryFn: () => ApiClient.get('/api/upload/config'),
    staleTime: 60 * 1000, // Cache config for 1 minute
  })
}

export function usePresignUpload() {
  return useMutation({
    mutationFn: (data: { filename: string; type: 'pcap' | 'dictionary'; size?: number }) =>
      ApiClient.post('/api/upload/presign', data),
  })
}

export function useUploadStatus(uploadId: string) {
  return useQuery({
    queryKey: ['upload', 'status', uploadId],
    queryFn: () => ApiClient.get(`/api/upload/status/${uploadId}`),
    enabled: !!uploadId,
    refetchInterval: 2000, // Poll every 2 seconds
    staleTime: 1000,
  })
}

export function useCompleteUpload() {
  return useMutation({
    mutationFn: (data: { uploadId: string; filename: string; type: 'pcap' | 'dictionary' }) =>
      ApiClient.post('/api/upload/complete', data),
  })
}

export function useDeleteUploadedFile(uploadId: string) {
  return useMutation({
    mutationFn: () => ApiClient.delete(`/api/upload/${uploadId}`),
  })
}

// Results API hooks
export function useResults(params?: {
  jobId?: string;
  networkId?: string;
  type?: 'password' | 'handshake' | 'error';
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['results', params],
    queryFn: () => ResultsApi.getResults(params),
    staleTime: 10 * 1000,
    select: (data: any) => ({
      data: data.data || [],
      count: data.count || 0,
      pagination: data.pagination || {
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false
      }
    }),
  })
}

export function useResultsByJob(jobId: string) {
  return useQuery({
    queryKey: ['results', 'by-job', jobId],
    queryFn: () => ResultsApi.getResultsByJob(jobId),
    enabled: !!jobId,
    staleTime: 10 * 1000,
    select: (data: any) => ({
      data: data.data || [],
      count: data.count || 0
    })
  })
}

export function useResultsByNetwork(networkId: string) {
  return useQuery({
    queryKey: ['results', 'by-network', networkId],
    queryFn: () => ResultsApi.getResultsByNetwork(networkId),
    enabled: !!networkId,
    staleTime: 10 * 1000,
    select: (data: any) => ({
      data: data.data || [],
      count: data.count || 0,
      network: data.network
    })
  })
}

export function useResult(id: string) {
  return useQuery({
    queryKey: ['results', id],
    queryFn: () => ResultsApi.getResult(id),
    enabled: !!id,
    staleTime: 10 * 1000,
  })
}

export function useCrackedPasswords() {
  return useQuery({
    queryKey: ['results', 'cracked-passwords'],
    queryFn: () => ResultsApi.getCrackedPasswords(),
    staleTime: 10 * 1000,
    select: (data: any) => ({
      data: data.data || [],
      count: data.count || 0
    })
  })
}

export function useResultsStats() {
  return useQuery({
    queryKey: ['results', 'stats'],
    queryFn: () => ResultsApi.getResultsStats(),
    staleTime: 30 * 1000, // Stats change less frequently
    select: (data: any) => ({
      byType: data.data?.byType || {},
      crackedNetworks: data.data?.crackedNetworks || 0,
      totalNetworks: data.data?.totalNetworks || 0,
      crackRate: data.data?.crackRate || 0
    })
  })
}

// Health check
export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => ApiClient.get('/health'),
    staleTime: 30 * 1000,
  })
}