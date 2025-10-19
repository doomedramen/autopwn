import { describe, it, expect } from 'vitest';
import {
  hasRole,
  hasExactRole,
  hasAnyRole,
  isAdmin,
  isSuperuser,
  canAccessResource,
  canManageUsers,
  canModifyConfig,
  getRoleDisplayName,
  getRolesAtOrBelow,
  getRolesAbove,
} from './rbac';
import type { User } from './auth';

/**
 * RBAC Unit Tests
 *
 * Tests role hierarchy and permission logic
 * These are pure functions with no side effects - perfect for unit testing
 */

const createMockUser = (role: 'user' | 'admin' | 'superuser', id = '1'): User => ({
  id,
  email: `${role}@test.com`,
  name: role,
  role,
  isActive: true,
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  deletedAt: null,
  passwordHash: 'hash',
});

describe('RBAC - Role Hierarchy', () => {
  it('should respect role hierarchy with hasRole', () => {
    const user = createMockUser('user');
    const admin = createMockUser('admin');
    const superuser = createMockUser('superuser');

    // User can only be user
    expect(hasRole(user, 'user')).toBe(true);
    expect(hasRole(user, 'admin')).toBe(false);
    expect(hasRole(user, 'superuser')).toBe(false);

    // Admin can be user or admin
    expect(hasRole(admin, 'user')).toBe(true);
    expect(hasRole(admin, 'admin')).toBe(true);
    expect(hasRole(admin, 'superuser')).toBe(false);

    // Superuser can be anything
    expect(hasRole(superuser, 'user')).toBe(true);
    expect(hasRole(superuser, 'admin')).toBe(true);
    expect(hasRole(superuser, 'superuser')).toBe(true);
  });

  it('should check exact role with hasExactRole', () => {
    const admin = createMockUser('admin');

    expect(hasExactRole(admin, 'admin')).toBe(true);
    expect(hasExactRole(admin, 'user')).toBe(false);
    expect(hasExactRole(admin, 'superuser')).toBe(false);
  });

  it('should check any role with hasAnyRole', () => {
    const admin = createMockUser('admin');

    expect(hasAnyRole(admin, ['user', 'admin'])).toBe(true);
    expect(hasAnyRole(admin, ['user', 'superuser'])).toBe(false);
    expect(hasAnyRole(admin, ['admin'])).toBe(true);
  });
});

describe('RBAC - Role Checks', () => {
  it('should identify admins correctly', () => {
    expect(isAdmin(createMockUser('user'))).toBe(false);
    expect(isAdmin(createMockUser('admin'))).toBe(true);
    expect(isAdmin(createMockUser('superuser'))).toBe(true);
  });

  it('should identify superusers correctly', () => {
    expect(isSuperuser(createMockUser('user'))).toBe(false);
    expect(isSuperuser(createMockUser('admin'))).toBe(false);
    expect(isSuperuser(createMockUser('superuser'))).toBe(true);
  });
});

describe('RBAC - Resource Access', () => {
  it('should allow users to access their own resources', () => {
    const user = createMockUser('user', 'user-1');

    expect(canAccessResource(user, 'user-1')).toBe(true);
    expect(canAccessResource(user, 'user-2')).toBe(false);
  });

  it('should allow admins to access any resource', () => {
    const admin = createMockUser('admin', 'admin-1');

    expect(canAccessResource(admin, 'admin-1')).toBe(true);
    expect(canAccessResource(admin, 'user-1')).toBe(true);
    expect(canAccessResource(admin, 'user-2')).toBe(true);
  });

  it('should allow superusers to access any resource', () => {
    const superuser = createMockUser('superuser', 'super-1');

    expect(canAccessResource(superuser, 'super-1')).toBe(true);
    expect(canAccessResource(superuser, 'user-1')).toBe(true);
    expect(canAccessResource(superuser, 'admin-1')).toBe(true);
  });
});

describe('RBAC - Permissions', () => {
  it('should only allow admins/superusers to manage users', () => {
    expect(canManageUsers(createMockUser('user'))).toBe(false);
    expect(canManageUsers(createMockUser('admin'))).toBe(true);
    expect(canManageUsers(createMockUser('superuser'))).toBe(true);
  });

  it('should only allow superusers to modify config', () => {
    expect(canModifyConfig(createMockUser('user'))).toBe(false);
    expect(canModifyConfig(createMockUser('admin'))).toBe(false);
    expect(canModifyConfig(createMockUser('superuser'))).toBe(true);
  });
});

describe('RBAC - Role Utilities', () => {
  it('should return correct display names', () => {
    expect(getRoleDisplayName('user')).toBe('User');
    expect(getRoleDisplayName('admin')).toBe('Administrator');
    expect(getRoleDisplayName('superuser')).toBe('Super Administrator');
  });

  it('should get roles at or below a given role', () => {
    expect(getRolesAtOrBelow('user')).toEqual(['user']);
    expect(getRolesAtOrBelow('admin')).toEqual(['user', 'admin']);
    expect(getRolesAtOrBelow('superuser')).toEqual(['user', 'admin', 'superuser']);
  });

  it('should get roles above a given role', () => {
    expect(getRolesAbove('user')).toEqual(['admin', 'superuser']);
    expect(getRolesAbove('admin')).toEqual(['superuser']);
    expect(getRolesAbove('superuser')).toEqual([]);
  });
});
