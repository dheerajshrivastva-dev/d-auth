import { AuthenticatedRequest, authenticateToken, dAuthMiddleware, DAuthOptions } from "./middleware/authMiddleware";
import User, { IUser } from "./models/User";
export * from "./utils/generateTokens";
export * from "./utils/verifyToken";
export default dAuthMiddleware;

export {
  AuthenticatedRequest,
  authenticateToken as authenticateMiddleware,
  DAuthOptions,
  IUser,
  User as MongodbuserModel,
}
