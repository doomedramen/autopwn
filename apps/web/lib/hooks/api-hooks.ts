'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '../api';
import type {
  User,
  LoginRequest,
  AuthResponse,
  Network,
  NetworkFilters,
  Dictionary,
  GenerateDictionaryRequest,
  Job,
  CreateJobRequest,
  PaginatedResponse,
  CreateUserRequest,
} from '../types';

// Auth hooks
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) =>
      ApiClient.post<AuthResponse>('/auth/login', data),
    onSuccess: (data) => {
      // Invalidate and refetch user session
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      ApiClient.post<{ message: string }>('/auth/logout'),
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
    },
  });
}

export function useAuthSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => ApiClient.get<AuthResponse>('/auth/session'),
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Network hooks
export function useNetworks(filters?: NetworkFilters) {
  return useQuery({
    queryKey: ['networks', filters],
    queryFn: () => ApiClient.get<PaginatedResponse<Network>>('/networks', filters as Record<string, unknown> | undefined),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useUploadPcap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      onProgress
    }: {
      file: File;
      onProgress?: (progress: number) => void
    }) => {
      const formData = new FormData();
      formData.append('pcap', file);

      return ApiClient.upload<{ networks: Network[] }>(
        '/networks/upload',
        formData,
        onProgress
      );
    },
    onSuccess: () => {
      // Invalidate networks cache
      queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
  });
}

// Dictionary hooks
export function useDictionaries() {
  return useQuery({
    queryKey: ['dictionaries'],
    queryFn: () => ApiClient.get<PaginatedResponse<Dictionary>>('/dictionaries'),
    staleTime: 30 * 1000,
  });
}

export function useUploadDictionary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      name,
      onProgress
    }: {
      file: File;
      name: string;
      onProgress?: (progress: number) => void
    }) => {
      const formData = new FormData();
      formData.append('dictionary', file);
      formData.append('name', name);

      return ApiClient.upload<Dictionary>(
        '/dictionaries/upload',
        formData,
        onProgress
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    },
  });
}

export function useGenerateDictionary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateDictionaryRequest) =>
      ApiClient.post<Dictionary>('/dictionaries/generate', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    },
  });
}

export function useDeleteDictionary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      ApiClient.delete<{ message: string }>(`/dictionaries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    },
  });
}

// Job hooks
export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: () => ApiClient.get<PaginatedResponse<Job>>('/jobs'),
    refetchInterval: 5 * 1000, // Refetch every 5 seconds for real-time updates
    staleTime: 2 * 1000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => ApiClient.get<Job>(`/jobs/${id}`),
    refetchInterval: 2 * 1000, // Refetch every 2 seconds for active jobs
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateJobRequest) =>
      ApiClient.post<Job>('/jobs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useControlJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      action
    }: {
      id: string;
      action: 'start' | 'pause' | 'resume' | 'cancel'
    }) =>
      ApiClient.patch<Job>(`/jobs/${id}`, { action }),
    onSuccess: (_, { id }) => {
      // Invalidate specific job and jobs list
      queryClient.invalidateQueries({ queryKey: ['job', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      ApiClient.delete<{ message: string }>(`/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// User hooks (admin only)
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => ApiClient.get<PaginatedResponse<User>>('/users'),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserRequest) =>
      ApiClient.post<User>('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<CreateUserRequest>) =>
      ApiClient.patch<User>(`/users/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      ApiClient.delete<{ message: string }>(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}