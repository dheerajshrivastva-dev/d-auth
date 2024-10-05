import { AuthenticatedRequest, authenticateApiMiddleware, dAuthMiddleware, DAuthOptions } from "./middleware/authMiddleware";
import User, { IUser } from "./models/User";
export * from "./utils/generateTokens";
export * from "./utils/verifyToken";
export default dAuthMiddleware;

export {
  AuthenticatedRequest,
  authenticateApiMiddleware as authenticateMiddleware,
  DAuthOptions,
  IUser,
  User as MongodbuserModel,
}
