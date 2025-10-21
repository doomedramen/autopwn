/**
 * Test data factory for generating consistent test data
 */
export class TestDataFactory {
  /**
   * Generate user test data
   */
  static createUser(overrides: Partial<UserData> = {}): UserData {
    const userData: UserData = {
      email: `user${this.generateId()}@example.com`,
      password: 'SecurePass123!',
      firstName: `Test${this.generateId()}`,
      lastName: `User${this.generateId()}`,
      ...overrides
    };
    return userData;
  }

  /**
   * Generate authentication credentials
   */
  static createAuthCredentials(): AuthCredentials {
    return {
      email: process.env.E2E_ADMIN_EMAIL || 'admin@autopwn.local',
      password: process.env.E2E_ADMIN_PASSWORD || 'autopwn-admin-password'
    };
  }

  /**
   * Generate test file data
   */
  static createFileData(overrides: Partial<FileData> = {}): FileData {
    const fileData: FileData = {
      name: `test-file-${this.generateId()}.txt`,
      content: `Test content generated at ${new Date().toISOString()}`,
      type: 'text/plain',
      size: 1024,
      ...overrides
    };
    return fileData;
  }

  /**
   * Generate random ID
   */
  private static generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }
}

/**
 * User data interface
 */
interface UserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  [key: string]: any;
}

/**
 * Authentication credentials interface
 */
interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * File data interface
 */
interface FileData {
  name: string;
  content: string;
  type: string;
  size: number;
  [key: string]: any;
}