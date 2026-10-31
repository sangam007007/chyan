# Role-Based Access Control (RBAC)

## Role Definitions

| Role         | Description                                           |
| ------------ | ----------------------------------------------------- |
| `student`    | Default role. Can browse tests, attempt quizzes, view questions within tests. |
| `admin`      | Can create, update, and delete questions and tests.   |
| `super_admin`| Full system access. Same as admin, plus user management capabilities. |

All new users are assigned the `student` role by default (enforced via database column default).

## Protected Endpoints

### Questions (`/api/questions`)

| Method | Path                | Required Role            |
| ------ | ------------------- | ------------------------ |
| POST   | `/api/questions`    | `admin`, `super_admin`   |
| GET    | `/api/questions`    | Any authenticated user   |
| GET    | `/api/questions/:id`| Any authenticated user   |
| PUT    | `/api/questions/:id`| `admin`, `super_admin`   |
| DELETE | `/api/questions/:id`| `admin`, `super_admin`   |

### Tests (`/api/tests`)

| Method | Path                      | Required Role            |
| ------ | ------------------------- | ------------------------ |
| POST   | `/api/tests`              | `admin`, `super_admin`   |
| PUT    | `/api/tests/:id`          | `admin`, `super_admin`   |
| GET    | `/api/tests`              | Any authenticated user   |
| GET    | `/api/tests/:id`          | Any authenticated user   |
| GET    | `/api/tests/:id/questions`| Any authenticated user   |

### Other Routes (unchanged)

All other routes (auth, profile, onboarding, subjects, attempts, dashboard, coins, daily quiz, sessions) remain accessible to any authenticated user without role restrictions.

## Promoting a User to Admin

Connect to the database and run:

```sql
-- Promote a user to admin
UPDATE users SET role = 'admin' WHERE id = '<user-uuid>';

-- Promote a user to super_admin
UPDATE users SET role = 'super_admin' WHERE id = '<user-uuid>';

-- Find a user by phone number and promote
UPDATE users SET role = 'admin' WHERE phone = '9876543210';
```

## Middleware Chain

The RBAC system uses a layered middleware approach:

```
Request → jwtAuth → requireRole(...roles) → route handler
```

1. **`jwtAuth`** — Validates the JWT access token, checks session in Redis, and attaches `req.user = { userId, sessionId, role }` to the request.

2. **`requireRole(...roles)`** — A factory function that returns middleware checking `req.user.role` against the provided allowed roles. If the role is not in the list, responds with 403 Forbidden.

3. **Route handler** — The actual controller logic executes only if both middleware pass.

### Example usage in a controller:

```typescript
import { jwtAuth } from "@/middleware/jwt-auth.js";
import { requireRole } from "@/middleware/require-role.js";

router.use(jwtAuth); // All routes require authentication

// Only admins can create
router.post("/", requireRole('admin', 'super_admin'), createHandler);

// All authenticated users can read
router.get("/", listHandler);
```

## How Roles Are Included in JWT Tokens

1. When a session is created (login/signup), the `SessionService.create()` method queries the user's `role` from the `users` table.

2. The role is included in the JWT access token payload:
   ```json
   {
     "sub": "user-uuid",
     "sessionId": "session-uuid",
     "role": "student",
     "iat": 1234567890,
     "exp": 1234571490
   }
   ```

3. On token refresh, the role is re-fetched from the database, so role changes take effect on the next refresh (within 1 hour at most).

4. The `jwtAuth` middleware extracts `role` from the decoded payload and attaches it to `req.user.role`.

## Database Schema

The `users` table has a `role` column:

```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student';
ALTER TABLE users ADD CONSTRAINT chk_user_role CHECK (role IN ('student', 'admin', 'super_admin'));
CREATE INDEX idx_users_role ON users (role);
```

## Error Responses

### 401 Unauthorized (no authentication)
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Authentication required"
  }
}
```

### 403 Forbidden (insufficient role)
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```
