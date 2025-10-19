import type { UserRole } from '@autopwn/shared';
import type { User } from './auth';

/**
 * Role-Based Access Control (RBAC) Helpers
 *
 * Utilities for checking user permissions and roles
 */

/**
 * Role hierarchy
 * Higher roles inherit permissions from lower roles
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  superuser: 3,
};

/**
 * Check if user has at least the specified role
 *
 * @example
 * hasRole(user, 'admin') // true for admin and superuser
 */
export function hasRole(user: User, requiredRole: UserRole): boolean {
  const userRoleLevel = ROLE_HIERARCHY[user.role as UserRole] ?? 0;
  const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Check if user has exactly the specified role
 */
export function hasExactRole(user: User, role: UserRole): boolean {
  return user.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: User, roles: UserRole[]): boolean {
  return roles.some((role) => hasExactRole(user, role));
}

/**
 * Check if user is admin or superuser
 */
export function isAdmin(user: User): boolean {
  return hasRole(user, 'admin');
}

/**
 * Check if user is superuser
 */
export function isSuperuser(user: User): boolean {
  return hasExactRole(user, 'superuser');
}

/**
 * Check if user can access a resource owned by another user
 *
 * Users can only access their own resources unless they are admin/superuser
 */
export function canAccessResource(
  currentUser: User,
  resourceOwnerId: string
): boolean {
  // Users can always access their own resources
  if (currentUser.id === resourceOwnerId) {
    return true;
  }

  // Admins and superusers can access all resources
  return isAdmin(currentUser);
}

/**
 * Check if user can modify a resource owned by another user
 *
 * Similar to canAccessResource but more strict for modifications
 */
export function canModifyResource(
  currentUser: User,
  resourceOwnerId: string
): boolean {
  return canAccessResource(currentUser, resourceOwnerId);
}

/**
 * Check if user can delete a resource owned by another user
 */
export function canDeleteResource(
  currentUser: User,
  resourceOwnerId: string
): boolean {
  return canAccessResource(currentUser, resourceOwnerId);
}

/**
 * Check if user can manage other users
 * Only admins and superusers can manage users
 */
export function canManageUsers(user: User): boolean {
  return isAdmin(user);
}

/**
 * Check if user can modify system configuration
 * Only superusers can modify system config
 */
export function canModifyConfig(user: User): boolean {
  return isSuperuser(user);
}

/**
 * Get user's role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    user: 'User',
    admin: 'Administrator',
    superuser: 'Super Administrator',
  };
  return displayNames[role] || role;
}

/**
 * Get all roles that are equal to or below the specified role
 */
export function getRolesAtOrBelow(role: UserRole): UserRole[] {
  const roleLevel = ROLE_HIERARCHY[role];
  return (Object.keys(ROLE_HIERARCHY) as UserRole[]).filter(
    (r) => ROLE_HIERARCHY[r] <= roleLevel
  );
}

/**
 * Get all roles that are above the specified role
 */
export function getRolesAbove(role: UserRole): UserRole[] {
  const roleLevel = ROLE_HIERARCHY[role];
  return (Object.keys(ROLE_HIERARCHY) as UserRole[]).filter(
    (r) => ROLE_HIERARCHY[r] > roleLevel
  );
}
