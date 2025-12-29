import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./requireAuth";
import { HTTPResponse, HttpStatus } from "../../httpResponse";
import {
  RoleHierarchyManager,
  DEFAULT_ROLE_HIERARCHY,
  RoleHierarchy,
} from "../../config/roleHierarchy";

/**
 * Role-Based Access Control (RBAC) Guard
 * Refactored from authMiddleware.ts:187-228
 *
 * Uses role hierarchy - higher roles automatically have access to lower role routes.
 * Supports both new roles array and legacy isAdmin field.
 *
 * Key improvements from v3:
 * - Accepts custom role hierarchy
 * - Better TypeScript types
 * - Cleaner error messages
 *
 * Usage:
 * ```typescript
 * // Public route (no auth required)
 * app.get('/public/data', requireRoles([]), handler);
 *
 * // Single role (user needs this role or higher)
 * app.get('/employee/dashboard', requireRoles(['employee']), handler);
 *
 * // Multiple roles (user needs ANY of these or higher)
 * app.get('/staff/schedule', requireRoles(['employee', 'staff']), handler);
 *
 * // With custom hierarchy
 * const rolesGuard = requireRoles(['admin'], customHierarchy);
 * app.use('/api/admin', rolesGuard, adminRouter);
 * ```
 */

export interface RequireRolesOptions {
  requiredRoles: string[];
  roleHierarchy?: RoleHierarchy;
  allowUnverified?: boolean;
}

/**
 * Create role-based access control middleware
 *
 * @param requiredRoles - Array of roles allowed to access the route
 *                        - Empty array [] = Public route (no authentication required)
 *                        - Single role = User needs that role or higher
 *                        - Multiple roles = User needs ANY of these roles (or higher)
 * @param roleHierarchy - Optional custom role hierarchy (defaults to DEFAULT_ROLE_HIERARCHY)
 * @returns Express middleware function
 *
 * @example
 * // Public routes - no authentication required
 * app.use('/api/public', requireRoles([]), publicRouter);
 *
 * // Single role - user needs this role or higher
 * app.get('/employee/dashboard', requireRoles(['employee']), (req, res) => {
 *   res.send('Employee Dashboard');
 *   // Employee, Supervisor, Manager, Moderator, Admin can access
 * });
 *
 * // Multiple roles - user needs ANY of these (or higher)
 * app.get('/staff/schedule', requireRoles(['employee', 'staff']), (req, res) => {
 *   res.send('Staff Schedule');
 *   // Staff, Employee, Supervisor, Manager, Moderator, Admin can access
 * });
 *
 * // Router-level protection (Recommended)
 * const adminRouter = express.Router();
 * adminRouter.get('/users', handler);
 * adminRouter.delete('/user/:id', handler);
 * app.use('/api/admin', requireRoles(['admin']), adminRouter);
 */
export function requireRoles(requiredRoles: string[] = [], roleHierarchy?: RoleHierarchy) {
  const hierarchyManager = new RoleHierarchyManager(roleHierarchy || DEFAULT_ROLE_HIERARCHY);

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // ✅ REUSE: Public route handling (authMiddleware.ts:189-192)
    if (requiredRoles.length === 0) {
      return next();
    }

    // ✅ REUSE: Authentication check (authMiddleware.ts:194-203)
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user?.id) {
      // For JWT mode, req.isAuthenticated won't exist, but req.user will be set by requireAuth
      if (!req.user?.id) {
        return res.status(401).send(
          new HTTPResponse({
            statusCode: HttpStatus.UN_AUTHORISED.code,
            httpStatus: HttpStatus.UN_AUTHORISED.status,
            message: "Authentication required",
          })
        );
      }
    }

    // ✅ REUSE: Get user roles (authMiddleware.ts:207-211)
    const userRoles = req.user.roles || [];
    if (req.user.isAdmin && !userRoles.includes("admin")) {
      userRoles.push("admin");
    }

    // ✅ REUSE: Hierarchy-based access check (authMiddleware.ts:213-224)
    const hasAccess = hierarchyManager.hasAnyAccess(userRoles, requiredRoles);

    if (!hasAccess) {
      return res.status(403).send(
        new HTTPResponse({
          statusCode: HttpStatus.FORBIDDEN.code,
          httpStatus: HttpStatus.FORBIDDEN.status,
          message: `Access denied. Required roles: ${requiredRoles.join(", ")} (or higher)`,
        })
      );
    }

    return next();
  };
}

/**
 * Advanced role guard with more options
 *
 * @param options - Configuration options
 * @returns Express middleware function
 *
 * @example
 * // Require admin role with custom hierarchy
 * app.use('/api/admin', requireRolesAdvanced({
 *   requiredRoles: ['admin'],
 *   roleHierarchy: customHierarchy,
 *   allowUnverified: false,
 * }), adminRouter);
 */
export function requireRolesAdvanced(options: RequireRolesOptions) {
  const { requiredRoles = [], roleHierarchy, allowUnverified = false } = options;
  const hierarchyManager = new RoleHierarchyManager(roleHierarchy || DEFAULT_ROLE_HIERARCHY);

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Public route handling
    if (requiredRoles.length === 0) {
      return next();
    }

    // Authentication check
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user?.id) {
      if (!req.user?.id) {
        return res.status(401).send(
          new HTTPResponse({
            statusCode: HttpStatus.UN_AUTHORISED.code,
            httpStatus: HttpStatus.UN_AUTHORISED.status,
            message: "Authentication required",
          })
        );
      }
    }

    // Verification check (if required)
    if (!allowUnverified && !req.user.isVerified) {
      return res.status(403).send(
        new HTTPResponse({
          statusCode: HttpStatus.FORBIDDEN.code,
          httpStatus: HttpStatus.FORBIDDEN.status,
          message: "Email verification required",
        })
      );
    }

    // Get user roles
    const userRoles = req.user.roles || [];
    if (req.user.isAdmin && !userRoles.includes("admin")) {
      userRoles.push("admin");
    }

    // Hierarchy-based access check
    const hasAccess = hierarchyManager.hasAnyAccess(userRoles, requiredRoles);

    if (!hasAccess) {
      return res.status(403).send(
        new HTTPResponse({
          statusCode: HttpStatus.FORBIDDEN.code,
          httpStatus: HttpStatus.FORBIDDEN.status,
          message: `Access denied. Required roles: ${requiredRoles.join(", ")} (or higher)`,
        })
      );
    }

    return next();
  };
}

/**
 * Require ALL specified roles (not just ANY)
 *
 * @param requiredRoles - Array of roles that user MUST have (all of them)
 * @param roleHierarchy - Optional custom role hierarchy
 * @returns Express middleware function
 *
 * @example
 * // User must have BOTH employee AND staff roles (or higher equivalents)
 * app.get('/special/access', requireAllRoles(['employee', 'staff']), handler);
 */
export function requireAllRoles(requiredRoles: string[] = [], roleHierarchy?: RoleHierarchy) {
  const hierarchyManager = new RoleHierarchyManager(roleHierarchy || DEFAULT_ROLE_HIERARCHY);

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Public route handling
    if (requiredRoles.length === 0) {
      return next();
    }

    // Authentication check
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user?.id) {
      if (!req.user?.id) {
        return res.status(401).send(
          new HTTPResponse({
            statusCode: HttpStatus.UN_AUTHORISED.code,
            httpStatus: HttpStatus.UN_AUTHORISED.status,
            message: "Authentication required",
          })
        );
      }
    }

    // Get user roles
    const userRoles = req.user.roles || [];
    if (req.user.isAdmin && !userRoles.includes("admin")) {
      userRoles.push("admin");
    }

    // Check if user has access to ALL required roles (not just any)
    const hasAccess = hierarchyManager.hasAllAccess(userRoles, requiredRoles);

    if (!hasAccess) {
      return res.status(403).send(
        new HTTPResponse({
          statusCode: HttpStatus.FORBIDDEN.code,
          httpStatus: HttpStatus.FORBIDDEN.status,
          message: `Access denied. Required ALL roles: ${requiredRoles.join(", ")} (or higher)`,
        })
      );
    }

    return next();
  };
}
