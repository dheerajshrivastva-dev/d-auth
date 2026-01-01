import { IUserDocument } from "../adapters/IDatabaseAdapter";

declare global {
  namespace Express {
    // Extend Express's User interface to match IUserDocument
    // This ensures compatibility between Passport.js session users and JWT users
    interface User extends IUserDocument {
      id: string;
    }
  }
}

export {};
