import {
  AuthenticatedRequest,
  authenticateApiMiddleware,
  dAuthMiddleware,
  DAuthOptions,
  requireRoles,
} from "./middleware/authMiddleware";
import sendEmail from "./services/sendEmail";
import userController from "./controllers/userController";
import User, { IUser, UserRole } from "./models/User";
import { HttpStatus, HTTPResponse } from "./httpResponse";
import userRouter from "./routes/userRouter";
import { TemplateRenderer } from "./services/TemplateRendrer";
import {
  RoleHierarchy,
  DEFAULT_ROLE_HIERARCHY,
  RoleHierarchyManager,
  initializeRoleHierarchy,
  getRoleHierarchyManager,
} from "./config/roleHierarchy";

export * from "./utils/generateTokens";
export * from "./utils/verifyToken";
export default dAuthMiddleware;

export {
  AuthenticatedRequest,
  authenticateApiMiddleware as authenticateMiddleware,
  DAuthOptions,
  IUser,
  User as MongodbuserModel,
  sendEmail,
  userController,
  HTTPResponse,
  HttpStatus,
  userRouter,
  TemplateRenderer as EmailRendrerer,
  // RBAC exports
  UserRole,
  requireRoles, // Unified RBAC middleware (recommended)
  // Role Hierarchy exports
  RoleHierarchy,
  DEFAULT_ROLE_HIERARCHY,
  RoleHierarchyManager,
  initializeRoleHierarchy,
  getRoleHierarchyManager,
};
