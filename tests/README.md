## # d-auth Test Suite

Comprehensive test coverage for d-auth v4.0.0 authentication middleware.

## Running Tests

```bash
# Install test dependencies
npm install --save-dev jest ts-jest @types/jest supertest @types/supertest

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- login.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="Failed Login"
```

## Test Structure

```
tests/
├── setup.ts                    # Global test setup
├── mocks/
│   └── MockDatabaseAdapter.ts  # In-memory database for testing
├── unit/
│   ├── register.test.ts        # User registration tests
│   ├── login.test.ts           # Login with failed attempts tracking
│   ├── adminCreateUser.test.ts # Temp password & force reset tests
│   ├── guards.test.ts          # Auth guards & RBAC tests
│   ├── passwordReset.test.ts   # Password reset flow
│   ├── logout.test.ts          # Logout functionality
│   ├── refreshToken.test.ts    # Token refresh
│   └── oauth.test.ts           # OAuth authentication
└── integration/
    └── fullFlow.test.ts        # End-to-end workflows
```

## Test Coverage

### Register Middleware (`register.test.ts`)

- ✅ Successful registration with valid data
- ✅ Session creation in database
- ✅ Validation errors (missing email, invalid format, weak password)
- ✅ Duplicate email rejection
- ✅ Token modes (cookie, response, both)
- ✅ Role assignment (default and custom)
- ✅ Hook invocation (onUserRegistered)
- ✅ Password hashing verification

### Login Middleware (`login.test.ts`)

- ✅ Successful login with valid credentials
- ✅ Session creation
- ✅ Failed login attempts tracking
- ✅ Account locking after 3 failed attempts
- ✅ Lock prevention during locked period
- ✅ Failed attempts reset on successful login
- ✅ Remaining attempts counter
- ✅ Temporary password detection
- ✅ 2FA requirement for enabled users
- ✅ Invalid credentials rejection
- ✅ OAuth-only user password rejection
- ✅ Hook invocation (onUserLogin, onAccountLocked)

### Admin Create User (`adminCreateUser.test.ts`)

- ✅ User creation with auto-generated temp password
- ✅ Temp password strength validation (12 chars, mixed)
- ✅ Temporary password flags (isTemporaryPassword, mustResetPassword)
- ✅ Default role assignment
- ✅ Duplicate email prevention
- ✅ Email field requirement
- ✅ Force password reset with valid temp password
- ✅ Password change verification
- ✅ Auto-verification after reset
- ✅ Wrong temp password rejection
- ✅ Non-existent user rejection
- ✅ Non-temp user rejection
- ✅ Required fields validation
- ✅ Full workflow (create → reset → login)
- ✅ Hook invocation (onUserCreatedWithTempPassword, onPasswordReset)

### Authentication Guards (`guards.test.ts`)

- ✅ requireAuth: Valid token in Authorization header
- ✅ requireAuth: Valid token in cookie
- ✅ requireAuth: No token rejection
- ✅ requireAuth: Invalid token rejection
- ✅ requireAuth: Non-existent user rejection
- ✅ requireRoles: Exact role access
- ✅ requireRoles: Missing role denial
- ✅ requireRoles: Role hierarchy (admin > manager > employee > user)
- ✅ requireRoles: ANY role access for multi-role routes
- ✅ requireRoles: Authentication requirement before role check
- ✅ Role hierarchy: Higher roles access lower routes
- ✅ Role hierarchy: Lower roles denied from higher routes
- ✅ Multiple roles: User with multiple roles
- ✅ Token modes: Cookie-only mode
- ✅ Token modes: Response-only mode
- ✅ Token modes: Both mode

## Mock Database

The `MockDatabaseAdapter` provides an in-memory implementation of `IDatabaseAdapter`:

- Stores data in Maps (users, sessions, OTPs)
- Reset between tests
- Seed test data
- Full implementation of all adapter methods
- No external dependencies
- Fast execution

## Usage Examples

### Writing a New Test

```typescript
import request from 'supertest';
import express from 'express';
import { DAuth } from '../../src/DAuth';
import { MockDatabaseAdapter } from '../mocks/MockDatabaseAdapter';

describe('My Feature', () => {
  let app: express.Application;
  let mockDb: MockDatabaseAdapter;
  let dAuth: DAuth;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockDb = new MockDatabaseAdapter();
    dAuth = new DAuth({
      database: mockDb,
      jwt: { secret: 'test-secret' },
    });

    app.post('/test-route', dAuth.middleware.someMiddleware);
  });

  afterEach(() => {
    mockDb.reset();
  });

  it('should do something', async () => {
    const response = await request(app)
      .post('/test-route')
      .send({ data: 'test' })
      .expect(200);

    expect(response.body.message).toBe('Expected message');
  });
});
```

### Testing with Hooks

```typescript
it('should call hook on event', async () => {
  const hookMock = jest.fn();

  const dAuth = new DAuth({
    database: mockDb,
    jwt: { secret: 'test' },
    hooks: {
      onSomeEvent: hookMock,
    },
  });

  // Trigger event
  await request(app).post('/trigger').send({});

  // Verify hook was called
  expect(hookMock).toHaveBeenCalledWith({
    // expected data
  });
});
```

### Testing with Seeded Data

```typescript
it('should work with existing user', async () => {
  // Seed test user
  const user = await mockDb.createUser({
    email: 'test@example.com',
    password: await bcrypt.hash('password', 10),
    roles: ['user'],
    isVerified: true,
    twoFactorEnabled: false,
  });

  // Test against seeded data
  const response = await request(app)
    .post('/login')
    .send({ email: 'test@example.com', password: 'password' });

  expect(response.status).toBe(200);
});
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Reset**: Always reset mock database in `afterEach`
3. **Clear Mocks**: Clear jest mocks in `afterEach`
4. **Descriptive Names**: Use clear test descriptions
5. **Arrange-Act-Assert**: Follow AAA pattern
6. **One Assertion**: Focus on one thing per test
7. **Edge Cases**: Test error scenarios
8. **Hooks**: Verify hook invocations

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v2
        with:
          file: ./coverage/lcov.info
```

## Troubleshooting

### Tests Timeout

Increase timeout in jest.config.js:

```javascript
testTimeout: 20000; // 20 seconds
```

### Mock Data Not Resetting

Ensure `afterEach` hook calls `mockDb.reset()`:

```typescript
afterEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
});
```

### Async Issues

Always use `async/await` or return promises:

```typescript
it('should work', async () => {
  await request(app).post('/route').send({});
  // assertions
});
```
