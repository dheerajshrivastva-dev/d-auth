import { Router } from 'express';
import userController from '../controllers/userController';

/**
 * User Router
 * 
 * This router handles all user-related routes for the application.
 * 
 * Note: Please protect this router with #authenticateMiddleware
 * 
 * Routes:
 * 
 * ### Admin Routes
 * 
 * * `GET /admin/user/:id`: Retrieves a user by ID.
 * * `POST /admin/user/update`: Updates a user's information.
 * * `POST /admin/user/delete`: Deletes a user.
 * * `POST /admin/user/create`: Creates a new user.
 * * `POST /admin/user/verify`: Verifies a user's credentials.
 * * `POST /admin/user/make-admin`: Updates a user's admin status.
 * 
 * ### User Routes
 * 
 * * `GET /me`: Retrieves the current user's information.
 * * `POST /me`: Updates the current user's information.
 * 
 * @module userRouter
 * 
 * @example
 * const app = express();
 * app.use('/api', authenticateMiddleware);
 * app.use('/api', userRouter);
 * app.listen(3000);
 */
const userRouter = Router();

userRouter.get('/admin/user:id', userController.getUser);

userRouter.post('/admin/user/update', userController.updateUser);

userRouter.post('/admin/user/delete', userController.deleteUser);

userRouter.post('/admin/user/create', userController.create);

userRouter.post('/admin/user/verify', userController.verifyUser);

userRouter.post('/admin/user/make-admin', userController.updateAdminStatues);

userRouter.get('/me', userController.me);

userRouter.post('/me', userController.updateMe);

export default userRouter;
