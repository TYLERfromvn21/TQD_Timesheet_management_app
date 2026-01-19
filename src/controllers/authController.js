/**
 * AUTHENTICATION CONTROLLER
 * -------------------------
 * Handles all authentication-related operations
 * Login, registration, logout, and system status checks
 * Uses async/await and bcrypt for password hashing
 */

const bcrypt = require('bcrypt');
const uuid = require('uuid');
const path = require('path');

/**
 * User Login
 * Authenticates user credentials and creates session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function login(req, res) {
    try {
        const { db } = req.app.locals;
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.redirect('/?error=' + encodeURIComponent('Vui lòng nhập tên đăng nhập và mật khẩu'));
        }

        const user = await db.getAsync('SELECT * FROM users WHERE username = ?', [username]);
        
        if (user && bcrypt.compareSync(password, user.password)) {
            req.session.user = user;
            return res.redirect('/dashboard');
        }
        
        return res.redirect('/?error=' + encodeURIComponent('Sai thông tin'));
    } catch (error) {
        console.error('Login error:', error);
        return res.redirect('/?error=' + encodeURIComponent('Lỗi hệ thống'));
    }
}

/**
 * Admin Authentication Login
 * Separate login endpoint for admin authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function adminAuthLogin(req, res) {
    try {
        const { db } = req.app.locals;
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
        }

        const user = await db.getAsync('SELECT * FROM users WHERE username = ?', [username]);
        
        if (user && bcrypt.compareSync(password, user.password)) {
            if (user.role === 'user') {
                return res.status(403).json({ error: 'Nhân viên không được vào' });
            }
            req.session.user = user;
            return res.json({ msg: 'OK' });
        }
        
        return res.status(401).json({ error: 'Sai mật khẩu' });
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({ error: 'Lỗi hệ thống' });
    }
}

/**
 * Create New Account
 * Handles user registration with role-based permissions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function createAccount(req, res) {
    try {
        const { db } = req.app.locals;
        
        // Check if the system is in "Setup Mode" (No Admins exist)
        const result = await db.getAsync('SELECT COUNT(*) as count FROM users WHERE role = "admin_total"');
        const isSetupMode = (result.count === 0);
        
        // Security: Prevent unauthorized account creation if not in Setup Mode
        if (!isSetupMode && (!req.session.user || !req.session.user.role.includes('admin'))) {
            return res.status(403).json({ error: 'Cấm truy cập' });
        }

        const { username, password, type, department, hidden_dept, id } = req.body;
        
        // Validation
        if (!username || !password) {
            const errorMsg = isSetupMode 
                ? 'Vui lòng nhập tên đăng nhập và mật khẩu'
                : 'Trùng tên hoặc thiếu thông tin';
            return isSetupMode 
                ? res.redirect('/admin-create?error=' + encodeURIComponent(errorMsg))
                : res.status(400).json({ error: errorMsg });
        }

        const finalDept = department || hidden_dept;
        const roleToSave = isSetupMode ? 'admin_total' : type;
        const userId = id || uuid.v4();
        
        // Hash password asynchronously (security improvement)
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await db.runAsync(
            'INSERT INTO users (id, username, password, role, department) VALUES (?, ?, ?, ?, ?)', 
            [userId, username, hashedPassword, roleToSave, finalDept]
        );
        
        if (isSetupMode) {
            return res.redirect('/admin-auth');
        }
        
        return res.redirect('/admin-create?message=' + encodeURIComponent('Tạo thành công!'));
        
    } catch (error) {
        console.error('Create account error:', error);
        const errorMsg = 'Lỗi khi tạo tài khoản';
        return res.redirect('/admin-create?error=' + encodeURIComponent(errorMsg));
    }
}

/**
 * User Logout
 * Destroys session and redirects to login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function logout(req, res) {
    try {
        req.session.destroy(() => {
            res.redirect('/');
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.redirect('/');
    }
}

/**
 * Get User Information
 * Returns current user's session data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserInfo(req, res) {
    try {
        return res.json(req.session.user);
    } catch (error) {
        console.error('Get user info error:', error);
        return res.status(500).json({ error: 'Lỗi hệ thống' });
    }
}

/**
 * Check System Status
 * Returns whether system is in setup mode (no admin exists)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function checkSystemStatus(req, res) {
    try {
        const { db } = req.app.locals;
        const result = await db.getAsync('SELECT COUNT(*) as c FROM users WHERE role="admin_total"');
        return res.json({ isSetupMode: result.c === 0 });
    } catch (error) {
        console.error('Check system status error:', error);
        return res.status(500).json({ error: 'Lỗi hệ thống' });
    }
}

/**
 * Serve Login Page
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function serveLoginPage(req, res) {
    try {
        if (req.session.user) {
            return res.redirect('/dashboard');
        }
        return res.sendFile(path.join(__dirname, '../../public/index.html'));
    } catch (error) {
        console.error('Serve login page error:', error);
        return res.status(500).send('Lỗi hệ thống');
    }
}

/**
 * Serve Dashboard Page
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function serveDashboard(req, res) {
    try {
        return res.sendFile(path.join(__dirname, '../../public/index_dashboard.html'));
    } catch (error) {
        console.error('Serve dashboard error:', error);
        return res.status(500).send('Lỗi hệ thống');
    }
}

/**
 * Serve Admin Authentication Page
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function serveAdminAuth(req, res) {
    try {
        return res.sendFile(path.join(__dirname, '../../public/admin-auth.html'));
    } catch (error) {
        console.error('Serve admin auth error:', error);
        return res.status(500).send('Lỗi hệ thống');
    }
}

/**
 * Serve Admin Creation Page
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function serveAdminCreate(req, res) {
    try {
        return res.sendFile(path.join(__dirname, '../../public/admin.html'));
    } catch (error) {
        console.error('Serve admin create error:', error);
        return res.status(500).send('Lỗi hệ thống');
    }
}

module.exports = {
    login,
    adminAuthLogin,
    createAccount,
    logout,
    getUserInfo,
    checkSystemStatus,
    serveLoginPage,
    serveDashboard,
    serveAdminAuth,
    serveAdminCreate
};