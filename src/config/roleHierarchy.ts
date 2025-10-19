import { UserRole } from "../models/User";

/**
 * Role hierarchy configuration
 * Higher level roles automatically inherit permissions of lower level roles
 *
 * Default hierarchy (from highest to lowest):
 * 1. ADMIN - Has access to everything
 * 2. MODERATOR - Can access manager, supervisor, employee, staff, user routes
 * 3. MANAGER - Can access supervisor, employee, staff, user routes
 * 4. SUPERVISOR - Can access employee, staff, user routes
 * 5. EMPLOYEE - Can access staff, user routes
 * 6. STAFF - Can access user routes
 * 7. USER - Base level, no inherited permissions
 */

export type RoleHierarchy = {
  [role: string]: number;
};

/**
 * Default role hierarchy
 * Higher number = higher privilege
 * A role with level 5 can access routes that require level 3, 2, or 1
 */
export const DEFAULT_ROLE_HIERARCHY: RoleHierarchy = {
  [UserRole.SUPERADMIN]: 120, // Top level - can access everything including admin
  [UserRole.ADMIN]: 100, // Highest - can access everything
  [UserRole.MODERATOR]: 80, // Can access all below
  [UserRole.MANAGER]: 60, // Can access supervisor, employee, staff, user
  [UserRole.SUPERVISOR]: 40, // Can access employee, staff, user
  [UserRole.EMPLOYEE]: 20, // Can access staff, user
  [UserRole.STAFF]: 10, // Can access user only
  [UserRole.USER]: 0, // Base level
};

/**
 * Role Hierarchy Manager
 * Handles role hierarchy logic and comparisons
 */
export class RoleHierarchyManager {
  private hierarchy: RoleHierarchy;

  constructor(hierarchy?: RoleHierarchy) {
    this.hierarchy = hierarchy || DEFAULT_ROLE_HIERARCHY;
  }

  /**
   * Get the hierarchy level of a role
   */
  getRoleLevel(role: string): number {
    return this.hierarchy[role] ?? -1;
  }

  /**
   * Check if userRole has sufficient privilege to access requiredRole
   * @param userRole - The role the user has
   * @param requiredRole - The role required for access
   * @returns true if user has sufficient privilege
   */
  hasAccess(userRole: string, requiredRole: string): boolean {
    const userLevel = this.getRoleLevel(userRole);
    const requiredLevel = this.getRoleLevel(requiredRole);

    // Unknown roles are denied
    if (userLevel === -1 || requiredLevel === -1) {
      return false;
    }

    // User level must be >= required level
    return userLevel >= requiredLevel;
  }

  /**
   * Check if user with given roles has access to any of the required roles
   * @param userRoles - Array of roles the user has
   * @param requiredRoles - Array of roles that grant access
   * @returns true if user has sufficient privilege
   */
  hasAnyAccess(userRoles: string[], requiredRoles: string[]): boolean {
    // For each user role, check if it can access any required role
    for (const userRole of userRoles) {
      for (const requiredRole of requiredRoles) {
        if (this.hasAccess(userRole, requiredRole)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if user with given roles has access to ALL required roles
   * @param userRoles - Array of roles the user has
   * @param requiredRoles - Array of roles that must ALL be satisfied
   * @returns true if user can access all required roles
   */
  hasAllAccess(userRoles: string[], requiredRoles: string[]): boolean {
    // User must be able to access every required role
    return requiredRoles.every((requiredRole) =>
      userRoles.some((userRole) => this.hasAccess(userRole, requiredRole))
    );
  }

  /**
   * Get all roles that a user can access with their current role
   * @param userRole - The user's role
   * @returns Array of role names the user can access
   */
  getAccessibleRoles(userRole: string): string[] {
    const userLevel = this.getRoleLevel(userRole);
    if (userLevel === -1) return [];

    return Object.keys(this.hierarchy).filter((role) => this.getRoleLevel(role) <= userLevel);
  }

  /**
   * Get the hierarchy configuration
   */
  getHierarchy(): RoleHierarchy {
    return { ...this.hierarchy };
  }

  /**
   * Set a custom hierarchy
   */
  setHierarchy(hierarchy: RoleHierarchy): void {
    this.hierarchy = hierarchy;
  }

  /**
   * Add or update a role in the hierarchy
   */
  setRoleLevel(role: string, level: number): void {
    this.hierarchy[role] = level;
  }
}

// Singleton instance
let hierarchyManagerInstance: RoleHierarchyManager;

/**
 * Get the global role hierarchy manager instance
 */
export function getRoleHierarchyManager(): RoleHierarchyManager {
  if (!hierarchyManagerInstance) {
    hierarchyManagerInstance = new RoleHierarchyManager();
  }
  return hierarchyManagerInstance;
}

/**
 * Initialize role hierarchy with custom configuration
 */
export function initializeRoleHierarchy(hierarchy?: RoleHierarchy): RoleHierarchyManager {
  hierarchyManagerInstance = new RoleHierarchyManager(hierarchy);
  return hierarchyManagerInstance;
}
