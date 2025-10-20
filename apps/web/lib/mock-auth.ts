// Mock authentication for demo purposes
export const DEMO_CREDENTIALS = {
  email: 'admin@autopwn.local',
  password: 'admin123',
};

export const mockUser = {
  id: '1',
  email: DEMO_CREDENTIALS.email,
  role: 'admin' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function mockLogin(email: string, password: string) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
        resolve({
          user: mockUser,
          message: 'Login successful',
        });
      } else {
        reject(new Error('Invalid credentials'));
      }
    }, 1000); // Simulate network delay
  });
}

export function mockLogout() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ message: 'Logout successful' });
    }, 500);
  });
}

export function mockGetSession() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Check if there's a "session" in localStorage
      const session = localStorage.getItem('autopwn_session');
      if (session) {
        resolve({
          user: mockUser,
          message: 'Session valid',
        });
      } else {
        reject(new Error('No active session'));
      }
    }, 100);
  });
}