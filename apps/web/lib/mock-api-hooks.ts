'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockLogin, mockLogout, mockGetSession } from './mock-auth';
import type {
  User,
  LoginRequest,
  AuthResponse,
  Network,
  Dictionary,
  Job,
  PaginatedResponse,
} from './types';

// Mock data for demo purposes
const mockNetworks: Network[] = [
  {
    id: '1',
    ssid: 'HomeNetwork',
    bssid: 'AA:BB:CC:DD:EE:FF',
    captureDate: '2024-01-15T10:30:00Z',
    status: 'ready',
    encryption: 'WPA2',
    channel: 6,
    signalStrength: -45,
    captureFile: 'home_network.pcap',
  },
  {
    id: '2',
    ssid: 'OfficeWiFi',
    bssid: '11:22:33:44:55:66',
    captureDate: '2024-01-14T15:45:00Z',
    status: 'ready',
    encryption: 'WPA3',
    channel: 11,
    signalStrength: -52,
    key: 'Password123!',
  },
  {
    id: '3',
    ssid: '<Hidden>',
    bssid: 'FF:EE:DD:CC:BB:AA',
    captureDate: '2024-01-13T09:15:00Z',
    status: 'processing',
    encryption: 'WPA2',
    channel: 1,
    signalStrength: -65,
  },
];

const mockDictionaries: Dictionary[] = [
  {
    id: '1',
    name: 'rockyou.txt',
    filename: 'rockyou.txt',
    size: 134217728, // 128MB
    type: 'uploaded',
    status: 'ready',
    createdAt: '2024-01-15T10:00:00Z',
    uploadedBy: '1',
    wordCount: 14344392,
  },
  {
    id: '2',
    name: 'custom_passwords',
    filename: 'custom_gen.txt',
    size: 52428800, // 50MB
    type: 'generated',
    status: 'ready',
    createdAt: '2024-01-14T14:30:00Z',
    uploadedBy: '1',
    wordCount: 5000000,
  },
  {
    id: '3',
    name: 'common_passwords',
    filename: 'common.txt',
    size: 1048576, // 1MB
    type: 'uploaded',
    status: 'processing',
    createdAt: '2024-01-13T16:45:00Z',
    uploadedBy: '1',
    wordCount: 100000,
    progress: 75,
  },
];

const mockJobs: Job[] = [
  {
    id: '1',
    name: 'Home Network Crack',
    status: 'completed',
    progress: 100,
    createdAt: '2024-01-15T11:00:00Z',
    startedAt: '2024-01-15T11:00:05Z',
    completedAt: '2024-01-15T11:15:32Z',
    networks: [mockNetworks[0]!],
    dictionaries: [mockDictionaries[0]!],
    attackMode: 'straight',
    gpuAcceleration: true,
    results: [
      {
        networkId: '1',
        network: mockNetworks[0]!,
        password: 'Password123!',
        foundAt: '2024-01-15T11:15:32Z',
      },
    ],
  },
  {
    id: '2',
    name: 'Office WiFi Attack',
    status: 'running',
    progress: 65,
    createdAt: '2024-01-15T12:30:00Z',
    startedAt: '2024-01-15T12:30:05Z',
    networks: [mockNetworks[1]!],
    dictionaries: [mockDictionaries[1]!],
    attackMode: 'brute-force',
    gpuAcceleration: true,
    keySpace: 1000000000,
  },
  {
    id: '3',
    name: 'Hidden Network Test',
    status: 'paused',
    progress: 25,
    createdAt: '2024-01-15T13:45:00Z',
    startedAt: '2024-01-15T13:45:10Z',
    networks: [mockNetworks[2]!],
    dictionaries: [mockDictionaries[0]!, mockDictionaries[1]!],
    attackMode: 'combination',
    gpuAcceleration: false,
  },
];

const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@autopwn.local',
    role: 'admin',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    email: 'user@autopwn.local',
    role: 'user',
    createdAt: '2024-01-10T12:00:00Z',
    updatedAt: '2024-01-14T16:30:00Z',
  },
];

// Mock hooks
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => mockLogin(data.email, data.password),
    onSuccess: (data: any) => {
      localStorage.setItem('autopwn_session', 'true');
      queryClient.setQueryData(['auth', 'session'], data);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => mockLogout(),
    onSuccess: () => {
      localStorage.removeItem('autopwn_session');
      queryClient.clear();
    },
  });
}

export function useAuthSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => mockGetSession(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useNetworks() {
  return useQuery({
    queryKey: ['networks'],
    queryFn: () => Promise.resolve({
      data: mockNetworks,
      total: mockNetworks.length,
      page: 1,
      limit: 50,
      totalPages: 1,
    } as PaginatedResponse<Network>),
    staleTime: 30 * 1000,
  });
}

export function useDictionaries() {
  return useQuery({
    queryKey: ['dictionaries'],
    queryFn: () => Promise.resolve({
      data: mockDictionaries,
      total: mockDictionaries.length,
      page: 1,
      limit: 50,
      totalPages: 1,
    } as PaginatedResponse<Dictionary>),
    staleTime: 30 * 1000,
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: () => Promise.resolve({
      data: mockJobs,
      total: mockJobs.length,
      page: 1,
      limit: 50,
      totalPages: 1,
    } as PaginatedResponse<Job>),
    refetchInterval: 5 * 1000,
    staleTime: 2 * 1000,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => Promise.resolve({
      data: mockUsers,
      total: mockUsers.length,
      page: 1,
      limit: 50,
      totalPages: 1,
    } as PaginatedResponse<User>),
    staleTime: 60 * 1000,
  });
}

// Mock mutations (they won't do anything but return success)
export function useUploadPcap() {
  return useMutation({
    mutationFn: () => Promise.resolve({ networks: [] }),
  });
}

export function useUploadDictionary() {
  return useMutation({
    mutationFn: () => Promise.resolve({} as Dictionary),
  });
}

export function useGenerateDictionary() {
  return useMutation({
    mutationFn: () => Promise.resolve({} as Dictionary),
  });
}

export function useDeleteDictionary() {
  return useMutation({
    mutationFn: () => Promise.resolve({ message: 'Dictionary deleted' }),
  });
}

export function useCreateJob() {
  return useMutation({
    mutationFn: () => Promise.resolve({} as Job),
  });
}

export function useControlJob() {
  return useMutation({
    mutationFn: () => Promise.resolve({} as Job),
  });
}

export function useDeleteJob() {
  return useMutation({
    mutationFn: () => Promise.resolve({ message: 'Job deleted' }),
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: () => Promise.resolve({} as User),
  });
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: () => Promise.resolve({} as User),
  });
}

export function useDeleteUser() {
  return useMutation({
    mutationFn: () => Promise.resolve({ message: 'User deleted' }),
  });
}