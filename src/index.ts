import { AuthenticatedRequest, authenticateApiMiddleware, dAuthMiddleware, DAuthOptions } from "./middleware/authMiddleware";
import sendEmail from "./services/sendEmail";
import userController from "./controllers/userController";
import User, { IUser } from "./models/User";
import { HttpStatus, HTTPResponse } from "./httpResponse";
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
  HttpStatus
}
