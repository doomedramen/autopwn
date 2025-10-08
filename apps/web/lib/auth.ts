// Simplified auth configuration for frontend
// The actual auth logic is handled by the backend API
export const auth = {
  api: {
    getSession: async (options: { headers: Headers }) => {
      // This will be handled by the backend
      return null;
    }
  }
};