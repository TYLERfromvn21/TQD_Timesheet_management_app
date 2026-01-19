# Development Guide - Adding Features & Bug Fixes

## 🏗️ Project Structure Overview

```
src/
├── config/
│   └── database.js          # DB initialization, schema, promisified methods
├── middleware/
│   └── authMiddleware.js    # Authentication and authorization guards
├── services/
│   └── excelService.js      # Business logic for Excel reports
├── controllers/
│   ├── authController.js     # Login, register, logout logic
│   ├── departmentController.js
│   ├── userController.js
│   ├── jobCodeController.js
│   ├── taskController.js
│   └── reportController.js   # Calls excelService for reports
├── routes/
│   ├── authRoutes.js        # Maps HTTP routes to auth controllers
│   ├── departmentRoutes.js
│   ├── userRoutes.js
│   ├── jobCodeRoutes.js
│   ├── taskRoutes.js
│   └── reportRoutes.js
├── utils/
│   └── validation.js        # Request validation functions
└── server.js               # Main entry point, middleware setup
```

## 🚀 Adding a New Feature - Step by Step

### Example: Add "Team Management" Feature

#### Step 1: Database Layer
```bash
# 1. Update database schema in src/config/database.js
```

**File: `src/config/database.js`**
```javascript
// Add new table to the initializeDatabase function
await db.execAsync(`
    CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        description TEXT,
        department TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
`);
```

#### Step 2: Validation Layer
**File: `src/utils/validation.js`**
```javascript
function validateTeam(data) {
    const errors = [];
    
    if (!data.name || data.name.trim() === '') {
        errors.push('Tên đội nhóm là bắt buộc');
    }
    
    if (data.name && (data.name.length < 2 || data.name.length > 100)) {
        errors.push('Tên đội nhóm phải từ 2-100 ký tự');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    // ... existing exports
    validateTeam
};
```

#### Step 3: Service Layer (if complex logic)
**File: `src/services/teamService.js`**
```javascript
/**
 * Complex business logic for team management
 */
async function calculateTeamProductivity(teamId, db) {
    const tasks = await db.allAsync(`
        SELECT COUNT(*) as task_count, 
               SUM(end_time - start_time) as total_time
        FROM tasks 
        WHERE team_id = ?
    `, [teamId]);
    
    return {
        taskCount: tasks[0]?.task_count || 0,
        totalTime: tasks[0]?.total_time || 0
    };
}

module.exports = {
    calculateTeamProductivity
};
```

#### Step 4: Controller Layer
**File: `src/controllers/teamController.js`**
```javascript
const { validateTeam } = require('../utils/validation');

/**
 * Get all teams
 */
async function getTeams(req, res) {
    try {
        const { db } = req.app.locals;
        
        let sql = 'SELECT * FROM teams';
        let params = [];
        
        // Department admins only see their department's teams
        if (req.session.user.role === 'admin_dept') {
            sql += ' WHERE department = ?';
            params.push(req.session.user.department);
        }
        
        const teams = await db.allAsync(sql, params);
        return res.json(teams);
        
    } catch (error) {
        console.error('Get teams error:', error);
        return res.status(500).json({ error: 'Lỗi khi lấy danh sách đội nhóm' });
    }
}

/**
 * Create new team
 */
async function createTeam(req, res) {
    try {
        const { db } = req.app.locals;
        const { name, description } = req.body;
        
        // Validation
        const validation = validateTeam({ name, description });
        if (!validation.valid) {
            return res.status(400).json({ error: validation.errors.join(', ') });
        }
        
        // Permission check
        if (req.session.user.role !== 'admin_total') {
            return res.status(403).json({ error: 'Không có quyền tạo đội nhóm' });
        }
        
        // Database operation
        const id = uuid.v4();
        await db.runAsync(
            'INSERT INTO teams (id, name, description, department) VALUES (?, ?, ?, ?)',
            [id, name.trim(), description || '', req.session.user.department]
        );
        
        return res.json({ message: 'Đã tạo đội nhóm thành công' });
        
    } catch (error) {
        console.error('Create team error:', error);
        
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Tên đội nhóm đã tồn tại' });
        }
        
        return res.status(500).json({ error: 'Lỗi khi tạo đội nhóm' });
    }
}

module.exports = {
    getTeams,
    createTeam
};
```

#### Step 5: Routes Layer
**File: `src/routes/teamRoutes.js`**
```javascript
const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { requireAdminOrManager } = require('../middleware/authMiddleware');

// GET: Retrieve all teams
router.get('/api/teams', teamController.getTeams);

// POST: Create new team (Admin only)
router.post('/api/create-team', requireAdminOrManager, teamController.createTeam);

module.exports = router;
```

#### Step 6: Register Routes
**File: `src/server.js`**
```javascript
// Import the new routes
const teamRoutes = require('./routes/teamRoutes');

// Register routes in the ROUTE REGISTRATION section
app.use('/', teamRoutes);
```

#### Step 7: Test the Feature
```bash
# 1. Restart server
npm start

# 2. Test endpoints
curl -X GET http://localhost:3000/api/teams
curl -X POST http://localhost:3000/api/create-team \
  -H "Content-Type: application/json" \
  -d '{"name":"Team Alpha","description":"Development team"}'
```

---

## 🐛 Fixing Bugs - Step by Step

### Example: Fix "Teams endpoint returns empty array"

#### Step 1: Identify the Issue
```bash
# Check server logs for errors
tail -f server.log

# Test endpoint with verbose output
curl -v http://localhost:3000/api/teams
```

#### Step 2: Debug the Controller
**File: `src/controllers/teamController.js`**
```javascript
async function getTeams(req, res) {
    try {
        const { db } = req.app.locals;
        
        // Add debugging logs
        console.log('User role:', req.session.user?.role);
        console.log('User department:', req.session.user?.department);
        
        let sql = 'SELECT * FROM teams';
        let params = [];
        
        if (req.session.user.role === 'admin_dept') {
            sql += ' WHERE department = ?';
            params.push(req.session.user.department);
        }
        
        console.log('SQL:', sql);
        console.log('Params:', params);
        
        const teams = await db.allAsync(sql, params);
        console.log('Teams from DB:', teams);
        
        return res.json(teams);
        
    } catch (error) {
        console.error('Get teams error:', error);
        return res.status(500).json({ error: 'Lỗi khi lấy danh sách đội nhóm' });
    }
}
```

#### Step 3: Check Database
```bash
# Verify data exists
sqlite3 timesheet.db "SELECT * FROM teams;"

# Check table exists
sqlite3 timesheet.db ".schema teams"
```

#### Step 4: Fix and Test
```javascript
// If the issue was missing table, add migration logic:
async function initializeDatabase() {
    try {
        await db.execAsync(`
            -- Existing tables...
        `);

        // Add the missing table
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE,
                description TEXT,
                department TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
        `);

        console.log('Database schema created successfully');
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}
```

---

## 🛠️ Common Development Tasks

### Adding New API Endpoint
```javascript
// 1. Add controller function
// 2. Add validation (if needed)
// 3. Add route mapping
// 4. Register route module in server.js
// 5. Test with curl or Postman
```

### Adding New Database Field
```javascript
// 1. Update database schema in config/database.js
// 2. Add migration logic if table exists
// 3. Update affected controllers
// 4. Update validation functions
// 5. Update frontend forms (if needed)
```

### Adding Middleware
```javascript
// 1. Create new middleware file in src/middleware/
const customMiddleware = (req, res, next) => {
    // Your logic here
    console.log('Custom middleware executed');
    next();
};

// 2. Register in server.js
app.use(customMiddleware);

// 3. Use in routes as needed
router.get('/protected', customMiddleware, controller.method);
```

---

## 🧪 Testing Workflow

### 1. Unit Testing (Future)
```javascript
// Example test file structure
tests/
├── unit/
│   ├── controllers/
│   │   ├── authController.test.js
│   │   └── teamController.test.js
│   ├── services/
│   │   └── excelService.test.js
│   └── utils/
│       └── validation.test.js
└── integration/
    └── api.test.js
```

### 2. API Testing
```bash
# Test endpoints sequentially
curl -X GET http://localhost:3000/api/departments
curl -X POST http://localhost:3000/login -d "username=test&password=test"
curl -X GET http://localhost:3000/api/teams -b cookies.txt
```

### 3. Database Testing
```bash
# Direct database verification
sqlite3 timesheet.db "SELECT COUNT(*) FROM users;"
sqlite3 timesheet.db "SELECT * FROM departments LIMIT 5;"
```

---

## 📋 Development Best Practices

### 1. Error Handling
```javascript
// Always wrap async operations in try-catch
async function safeOperation(req, res) {
    try {
        const { db } = req.app.locals;
        // Your logic here
        return res.json(result);
    } catch (error) {
        console.error('Operation error:', error);
        return res.status(500).json({ 
            error: 'Lỗi hệ thống',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
}
```

### 2. Validation
```javascript
// Always validate user input
const validation = validateInput(req.body);
if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join(', ') });
}
```

### 3. Authentication & Authorization
```javascript
// Always check user permissions
if (req.session.user.role !== 'admin_total') {
    return res.status(403).json({ error: 'Không có quyền truy cập' });
}
```

### 4. Database Operations
```javascript
// Use prepared statements to prevent SQL injection
await db.runAsync(
    'INSERT INTO users (id, name) VALUES (?, ?)',
    [id, name]
);

// Use transactions for multiple operations
await db.execAsync('BEGIN TRANSACTION');
try {
    await db.runAsync('INSERT...', [params1]);
    await db.runAsync('UPDATE...', [params2]);
    await db.execAsync('COMMIT');
} catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
}
```

---

## 🚀 Deployment Checklist

### Before Deploying
- [ ] Run all tests
- [ ] Update package.json version
- [ ] Review environment variables
- [ ] Backup database
- [ ] Test with production data
- [ ] Check all endpoints work

### Database Migrations
```javascript
// Use versioned migrations in production
async function runMigrations(db) {
    const currentVersion = await db.getAsync('PRAGMA user_version');
    
    if (currentVersion.user_version < 2) {
        await db.execAsync('ALTER TABLE users ADD COLUMN email TEXT');
        await db.execAsync('PRAGMA user_version = 2');
    }
}
```

---

## 🔧 Debugging Tips

### 1. Logging
```javascript
// Add detailed logging
console.log('Request:', {
    method: req.method,
    url: req.url,
    user: req.session.user?.username,
    body: req.body
});
```

### 2. Database Queries
```javascript
// Log SQL queries
console.log('SQL:', sql);
console.log('Params:', JSON.stringify(params));
```

### 3. Session Issues
```javascript
// Check session state
console.log('Session:', req.session);
console.log('Session ID:', req.sessionID);
```

### 4. Error Analysis
```javascript
// Always log full error objects
console.error('Full error:', {
    message: error.message,
    stack: error.stack,
    code: error.code
});
```

---

This structure provides a clear, maintainable way to add features and fix issues while keeping code organized and testable.