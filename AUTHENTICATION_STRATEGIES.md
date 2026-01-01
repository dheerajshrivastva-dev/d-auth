# Authentication Strategies Guide

d-auth v4.0.0 supports **two authentication strategies**: JWT-based and Session-based. This guide helps you choose the right one for your application.

## Quick Comparison

| Feature | JWT Strategy | Session Strategy |
|---------|--------------|------------------|
| **State** | Stateless | Stateful |
| **Storage** | No server storage | Requires session store |
| **Scalability** | Excellent | Good (with Redis) |
| **Token Size** | Large cookies (~1KB) | Small cookies (~50B) |
| **Revocation** | Difficult (needs blacklist) | Easy (delete session) |
| **Mobile Apps** | Excellent | Poor |
| **Server-Rendered** | Good | Excellent |
| **OAuth** | Good | Excellent |
| **CDN/Edge** | Excellent | Not recommended |
| **Microservices** | Excellent | Poor |

## JWT Strategy

### Overview
JWT (JSON Web Token) is a stateless authentication method where the server signs a token containing user information, and the client stores it.

### How It Works

```
1. User logs in → Server generates JWT
2. JWT sent to client (cookie or response)
3. Client includes JWT in subsequent requests
4. Server verifies JWT signature
5. No database lookup needed for auth
```

### Configuration

```typescript
const dAuth = new DAuth({
  database: new MongoDBAdapter({ uri: process.env.MONGO_URI }),

  strategy: 'jwt',

  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    tokenMode: 'cookie', // or 'response' or 'both'
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    },
  },
});
```

### Token Modes

#### 1. Cookie Mode (`tokenMode: 'cookie'`)

**Best for:** Traditional web apps, server-rendered pages

```typescript
jwt: {
  tokenMode: 'cookie',
  cookieOptions: {
    httpOnly: true,  // Prevents XSS attacks
    secure: true,    // HTTPS only
    sameSite: 'lax', // CSRF protection
  },
}
```

**Client Usage:**
```javascript
// Login
fetch('/auth/login', {
  method: 'POST',
  credentials: 'include', // Important!
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

// Authenticated requests
fetch('/api/profile', {
  credentials: 'include', // Cookies sent automatically
});
```

**Pros:**
- ✅ More secure (HTTP-only cookies)
- ✅ Automatic cookie handling
- ✅ CSRF protection with sameSite

**Cons:**
- ❌ Doesn't work with native mobile apps
- ❌ CORS complexity

---

#### 2. Response Mode (`tokenMode: 'response'`)

**Best for:** Mobile apps, SPAs, third-party integrations

```typescript
jwt: {
  tokenMode: 'response',
}
```

**Server Response:**
```json
{
  "user": { "id": "123", "email": "user@example.com" },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Client Usage:**
```javascript
// Login and store tokens
const { accessToken, refreshToken } = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then(r => r.json());

localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Authenticated requests
fetch('/api/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
  },
});
```

**Pros:**
- ✅ Works with mobile apps
- ✅ Simple CORS setup
- ✅ Client controls token storage

**Cons:**
- ❌ Vulnerable to XSS if not careful
- ❌ Manual token management

---

#### 3. Both Mode (`tokenMode: 'both'`)

**Best for:** Apps supporting both web and mobile clients

```typescript
jwt: {
  tokenMode: 'both',
  cookieOptions: { httpOnly: true, secure: true },
}
```

**Server Response:**
```json
{
  "user": { "id": "123", "email": "user@example.com" },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```
**AND** sets cookies: `accessToken`, `refreshToken`

**Auth Middleware Accepts:**
1. HTTP-only cookie (for web browsers)
2. `Authorization: Bearer <token>` header (for mobile/API)

**Pros:**
- ✅ Maximum flexibility
- ✅ One API for all clients
- ✅ Progressive enhancement

**Cons:**
- ❌ Slightly more complex

---

### When to Use JWT

✅ **Best for:**
- REST APIs
- Mobile app backends
- Single Page Applications (React, Vue, Angular)
- Microservices
- Serverless architectures
- Public APIs
- CDN/Edge deployments

✅ **Use Cases:**
- E-commerce API
- Mobile banking app
- Real-time chat application
- Multi-tenant SaaS
- Headless CMS
- GraphQL API

❌ **Not ideal for:**
- Traditional server-rendered apps
- Apps requiring immediate session revocation
- High-security banking (unless with short expiry + refresh)

---

## Session Strategy

### Overview
Session-based authentication stores user session on the server and sends a session ID to the client as a cookie.

### How It Works

```
1. User logs in → Server creates session in store
2. Session ID sent to client as cookie
3. Client includes session cookie in requests
4. Server looks up session in store
5. User data retrieved from session
```

### Configuration

```typescript
const dAuth = new DAuth({
  database: new MongoDBAdapter({ uri: process.env.MONGO_URI }),

  strategy: 'session',

  session: {
    secret: process.env.SESSION_SECRET,
    name: 'sessionId',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxSessionsPerUser: 5,
    store: 'database', // or 'memory' or 'redis'
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    },
  },
});
```

### Session Stores

#### 1. Database Store (`store: 'database'`)

**Best for:** Small to medium apps

```typescript
session: {
  store: 'database', // Uses your database adapter
  maxSessionsPerUser: 10,
}
```

**Pros:**
- ✅ No additional infrastructure
- ✅ Session persistence
- ✅ Easy backup

**Cons:**
- ❌ Database overhead on each request
- ❌ Slower than in-memory stores

---

#### 2. Memory Store (`store: 'memory'`)

**Best for:** Development only

```typescript
session: {
  store: 'memory',
}
```

⚠️ **WARNING:** Do NOT use in production!
- Sessions lost on server restart
- Doesn't work with multiple servers
- Memory leaks possible

---

#### 3. Redis Store (`store: 'redis'`)

**Best for:** Production apps with high traffic

```typescript
session: {
  store: 'redis',
  redisUrl: process.env.REDIS_URL,
}
```

**Pros:**
- ✅ Very fast (in-memory)
- ✅ Works with load balancers
- ✅ Session persistence
- ✅ Built-in expiration

**Cons:**
- ❌ Requires Redis server
- ❌ Additional infrastructure

---

### When to Use Session

✅ **Best for:**
- Traditional web applications
- Server-side rendered apps (EJS, Pug, Handlebars)
- Admin dashboards
- OAuth-heavy apps
- Apps requiring immediate logout
- Monolithic architectures

✅ **Use Cases:**
- WordPress-style CMS
- Admin panels
- Social media platforms
- Banking web apps
- E-learning platforms
- Enterprise portals

❌ **Not ideal for:**
- Mobile apps
- Serverless deployments
- Microservices
- Public APIs
- Cross-domain auth

---

## Detailed Comparison

### Security

| Aspect | JWT | Session |
|--------|-----|---------|
| **XSS Protection** | Good (with httpOnly cookies) | Excellent |
| **CSRF Protection** | Good (with sameSite) | Excellent |
| **Token Theft** | Hard to revoke | Easy to revoke |
| **Replay Attacks** | Vulnerable (until expiry) | Easily prevented |
| **Man-in-Middle** | Both need HTTPS | Both need HTTPS |

### Performance

| Aspect | JWT | Session |
|--------|-----|---------|
| **Request Speed** | Very fast (no DB lookup) | Fast (Redis) / Slow (DB) |
| **Network** | Larger cookies | Smaller cookies |
| **Server Load** | Low CPU, No memory | Low CPU, Memory needed |
| **Database** | Only on login | Every request (if DB store) |

### Scalability

| Aspect | JWT | Session |
|--------|-----|---------|
| **Horizontal Scaling** | Excellent | Good (with Redis) |
| **Load Balancing** | No sticky sessions | Needs sticky or Redis |
| **Serverless** | Perfect | Not recommended |
| **CDN/Edge** | Works great | Doesn't work |

### Developer Experience

| Aspect | JWT | Session |
|--------|-----|---------|
| **Setup Complexity** | Low | Medium (needs store) |
| **Client Code** | More complex | Simple |
| **Debugging** | Harder (decode tokens) | Easier (session store) |
| **Testing** | Easier (stateless) | Harder (need store) |

---

## Migration Between Strategies

### From Session to JWT

```typescript
// Before (v3.x or session mode)
const dAuth = new DAuth({
  strategy: 'session',
  session: { secret: '...' },
});

// After (JWT mode)
const dAuth = new DAuth({
  strategy: 'jwt',
  jwt: {
    secret: process.env.JWT_SECRET,
    tokenMode: 'cookie', // Keep cookie-based for easy migration
  },
});
```

**Changes needed:**
- ✅ No client-side changes (if using cookie mode)
- ✅ Update session secret to JWT secret
- ✅ Remove session store infrastructure
- ⚠️ Users will need to re-login

### From JWT to Session

```typescript
// Before (JWT mode)
const dAuth = new DAuth({
  strategy: 'jwt',
  jwt: { secret: '...', tokenMode: 'cookie' },
});

// After (Session mode)
const dAuth = new DAuth({
  strategy: 'session',
  session: {
    secret: process.env.SESSION_SECRET,
    store: 'redis', // Recommended for production
    redisUrl: process.env.REDIS_URL,
  },
});
```

**Changes needed:**
- ✅ Setup Redis or session store
- ✅ Update configuration
- ⚠️ Users will need to re-login
- ⚠️ Mobile apps may need to switch to cookies

---

## Hybrid Approach

For maximum flexibility, use JWT with 'both' mode:

```typescript
const dAuth = new DAuth({
  strategy: 'jwt',
  jwt: {
    secret: process.env.JWT_SECRET,
    tokenMode: 'both',
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    },
  },
});
```

This supports:
- 🌐 **Web browsers**: Use cookies automatically
- 📱 **Mobile apps**: Use Bearer tokens
- 🔌 **API clients**: Use Authorization header
- 🧪 **Testing**: Easy with cURL/Postman

---

## Decision Tree

```
Start: What type of app are you building?
│
├─ Mobile app only?
│  └─ Use JWT with tokenMode: 'response'
│
├─ Traditional web app (server-rendered)?
│  └─ Use Session with Redis store
│
├─ SPA (React/Vue/Angular)?
│  ├─ Need immediate logout?
│  │  └─ Use Session with Redis
│  └─ Otherwise
│     └─ Use JWT with tokenMode: 'cookie'
│
├─ REST API?
│  └─ Use JWT with tokenMode: 'response'
│
├─ Microservices?
│  └─ Use JWT with tokenMode: 'response'
│
├─ Serverless (Lambda/Vercel)?
│  └─ Use JWT with tokenMode: 'response'
│
├─ Both web and mobile?
│  └─ Use JWT with tokenMode: 'both'
│
└─ Admin panel with OAuth?
   └─ Use Session with Redis store
```

---

## Best Practices

### For JWT Strategy

1. **Short access token expiry** (15 minutes)
2. **Longer refresh token** (7-30 days)
3. **Use httpOnly cookies** when possible
4. **Rotate refresh tokens** on each use
5. **Implement token blacklist** for critical actions
6. **Use HTTPS** in production

### For Session Strategy

1. **Use Redis** in production
2. **Set appropriate maxAge** (usually 24 hours)
3. **Limit concurrent sessions** per user
4. **Use secure, httpOnly cookies**
5. **Implement CSRF protection**
6. **Clean up expired sessions** regularly

---

## Conclusion

**Choose JWT if:**
- Building an API or mobile app
- Need to scale horizontally
- Serverless architecture
- Cross-domain authentication

**Choose Session if:**
- Traditional web application
- Using server-side rendering
- Need immediate session control
- OAuth is primary authentication

**Still unsure?**
Start with JWT using `tokenMode: 'both'` for maximum flexibility. You can always change later!
