export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class FileSystemError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'FileSystemError'
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export function createValidationError(message: string, field?: string) {
  return new ValidationError(message, field)
}

export function createFileSystemError(message: string, code?: string) {
  return new FileSystemError(message, code)
}

export function createDatabaseError(message: string, originalError?: Error) {
  return new DatabaseError(message, originalError)
}

export function createSuccessResponse<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    message
  }
}

export function createErrorResponse(message: string, error?: any) {
  return {
    success: false,
    error: message,
    details: error
  }
}