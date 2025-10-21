// Real authentication using Better Auth backend
import { auth } from './auth'
import {
  useLogin as realUseLogin,
  useLogout as realUseLogout,
  useAuthSession as realUseAuthSession,
  useNetworks as realUseNetworks,
  useNetwork as realUseNetwork,
  useCreateNetwork as realUseCreateNetwork,
  useUpdateNetwork as realUseUpdateNetwork,
  useDeleteNetwork as realUseDeleteNetwork,
  useDictionaries as realUseDictionaries,
  useDictionary as realUseDictionary,
  useCreateDictionary as realUseCreateDictionary,
  useUpdateDictionary as realUseUpdateDictionary,
  useDeleteDictionary as realUseDeleteDictionary,
  useJobs as realUseJobs,
  useJob as realUseJob,
  useCreateJob as realUseCreateJob,
  useUpdateJob as realUseUpdateJob,
  useDeleteJob as realUseDeleteJob,
  useQueueStats as realUseQueueStats,
  useStartCrackingJob as realUseStartCrackingJob,
  useGenerateDictionary as realUseGenerateDictionary,
  useCancelJob as realUseCancelJob,
  useRetryJob as realUseRetryJob,
  useStartCleanup as realUseStartCleanup,
  useUsers as realUseUsers,
  useUser as realUseUser,
  useCreateUser as realUseCreateUser,
  useUpdateUser as realUseUpdateUser,
  useDeleteUser as realUseDeleteUser,
  useFileUploadConfig as realUseFileUploadConfig,
  usePresignUpload as realUsePresignUpload,
  useUploadStatus as realUseUploadStatus,
  useCompleteUpload as realUseCompleteUpload,
  useDeleteUploadedFile as realUseDeleteUploadedFile,
  useHealthCheck as realUseHealthCheck
} from './api-hooks'

// Keep demo credentials for development/testing
export const DEMO_CREDENTIALS = {
  email: 'admin@autopwn.local',
  password: 'admin123',
};

// Export real authentication functions
export const mockLogin = auth.signIn;
export const mockLogout = auth.signOut;
export const mockGetSession = auth.getSession;

// Export additional auth functions
export const { signUp, getProfile, updateProfile, changePassword } = auth;

// Helper function to check if user is authenticated
export async function isAuthenticated() {
  try {
    await auth.getSession();
    return true;
  } catch (error) {
    return false;
  }
}

// Export real API hooks (replacing mock ones)
export const useLogin = realUseLogin;
export const useLogout = realUseLogout;
export const useAuthSession = realUseAuthSession;
export const useNetworks = realUseNetworks;
export const useNetwork = realUseNetwork;
export const useCreateNetwork = realUseCreateNetwork;
export const useUpdateNetwork = realUseUpdateNetwork;
export const useDeleteNetwork = realUseDeleteNetwork;
export const useDictionaries = realUseDictionaries;
export const useDictionary = realUseDictionary;
export const useCreateDictionary = realUseCreateDictionary;
export const useUpdateDictionary = realUseUpdateDictionary;
export const useDeleteDictionary = realUseDeleteDictionary;
export const useJobs = realUseJobs;
export const useJob = realUseJob;
export const useCreateJob = realUseCreateJob;
export const useUpdateJob = realUseUpdateJob;
export const useDeleteJob = realUseDeleteJob;
export const useQueueStats = realUseQueueStats;
export const useStartCrackingJob = realUseStartCrackingJob;
export const useGenerateDictionary = realUseGenerateDictionary;
export const useCancelJob = realUseCancelJob;
export const useRetryJob = realUseRetryJob;
export const useStartCleanup = realUseStartCleanup;
export const useUsers = realUseUsers;
export const useUser = realUseUser;
export const useCreateUser = realUseCreateUser;
export const useUpdateUser = realUseUpdateUser;
export const useDeleteUser = realUseDeleteUser;
export const useFileUploadConfig = realUseFileUploadConfig;
export const usePresignUpload = realUsePresignUpload;
export const useUploadStatus = realUseUploadStatus;
export const useCompleteUpload = realUseCompleteUpload;
export const useDeleteUploadedFile = realUseDeleteUploadedFile;
export const useHealthCheck = realUseHealthCheck;

// Export auth utilities
export { auth };