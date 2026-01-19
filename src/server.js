/**
 * TÍN VIỆT TIMESHEET - REFACTORED SERVER
 * ---------------------------------------
 * Main entry point for the Node.js application.
 * Refactored from monolithic app.js to modular MVC structure.
 * 
 * Features:
 * - Environment variable configuration with dotenv
 * - Promisified database operations
 * - Global error handling
 * - Modular route and controller structure
 * - Async/await throughout
 * - Security middleware (helmet, rate limiting)
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import configuration and routes
const { initializeDatabase, closeDatabase, db } = require('./config/database');

// Import route modules
const authRoutes = require('./routes/authRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const userRoutes = require('./routes/userRoutes');
const jobCodeRoutes = require('./routes/jobCodeRoutes');
const taskRoutes = require('./routes/taskRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Initialize Express App
const app = express();
const port = process.env.PORT || 3000;

// Store database instance in app locals for route access
app.locals.db = db;

// --- 2. SECURITY & CONFIGURATION ---

// Apply Helmet for security headers (Content Security Policy disabled for inline scripts compatibility)
app.use(helmet({ contentSecurityPolicy: false }));

// Rate Limiting: Prevent brute-force attacks (Max 200 requests per 15 minutes)
const limiter = rateLimit({ 
    windowMs: 15 * 60 * 1000, 
    max: 200,
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Body parsing middleware to handle form data and JSON payloads
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (HTML, CSS, Client-side JS) from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Session Configuration
// Stores user login state securely using cookies
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true, 
        maxAge: 86400000, // Session expires in 24 hours
        secure: process.env.NODE_ENV === 'production' // HTTPS only in production
    }
}));

// --- 3. GLOBAL ERROR HANDLER ---

// --- 4. ROUTE REGISTRATION ---

// Register all route modules BEFORE error handlers
app.use('/', authRoutes);
app.use('/', departmentRoutes);
app.use('/', userRoutes);
app.use('/', jobCodeRoutes);
app.use('/', taskRoutes);
app.use('/', reportRoutes);

// --- 5. SERVE MANAGE USERS PAGE ---

/**
 * Serve Manage Users Page
 * This needs to be after all API routes to avoid conflicts
 */
app.get('/manage-users', (req, res) => {
    if (!req.session || !req.session.user || !req.session.user.role.includes('admin')) {
        return res.redirect('/?error=' + encodeURIComponent('Không có quyền truy cập'));
    }
    res.sendFile(path.join(__dirname, '../public/manage_users.html'));
});

/**
 * Global Error Handler Middleware
 * Catches all unhandled errors and prevents server crashes
 * Provides consistent error response format
 */
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    // Don't send stack trace in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.status(err.status || 500).json({
        error: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
    });
});

/**
 * Catch-all route handler for 404 errors
 * Must be AFTER all route registrations
 */
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// --- 6. SERVER STARTUP ---

/**
 * Start server and initialize database
 */
async function startServer() {
    try {
        // Initialize database schema and seed data
        await initializeDatabase();
        
        // Start listening for requests
        app.listen(port, () => {
            console.log(`🚀 Server is running on port ${port}`);
            console.log(`📊 Timesheet Management System is ready`);
            console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

/**
 * Graceful shutdown handler
 */
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down gracefully...');
    try {
        await closeDatabase();
        console.log('✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Start the application
startServer();

module.exports = app;