/**
 * AUTHENTICATION MIDDLEWARE
 * -------------------------
 * Middleware functions for protecting routes and checking user permissions
 * Extracted from the original monolithic app.js file
 */

/**
 * Middleware: requireAuth
 * Ensures the user is logged in before accessing protected routes.
 * If user is not authenticated, returns 401 Unauthorized.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
};

/**
 * Middleware: requireAdminOrManager
 * Restricts access to Admins (Total or Dept) only.
 * Checks if user has admin role in their permissions.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdminOrManager = (req, res, next) => {
    if (req.session.user && req.session.user.role.includes('admin')) {
        return next();
    }
    return res.status(403).json({ error: 'Không có quyền truy cập' });
};

/**
 * Middleware: requireTotalAdmin
 * Restricts access to Total Admin only (admin_total role).
 * Used for operations that require full system access.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireTotalAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin_total') {
        return next();
    }
    return res.status(403).json({ error: 'Chỉ Admin Tổng mới được thực hiện' });
};

/**
 * Middleware: requireDeptAdminOrTotalAdmin
 * Allows access to both Department Admins and Total Admins.
 * Used for operations that can be performed by either admin type.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireDeptAdminOrTotalAdmin = (req, res, next) => {
    if (req.session.user && 
        (req.session.user.role === 'admin_total' || req.session.user.role === 'admin_dept')) {
        return next();
    }
    return res.status(403).json({ error: 'Không có quyền truy cập' });
};

/**
 * Helper function to check if user can access specific department
 * Regular users can only access their own department
 * Admins can access all departments
 * 
 * @param {Object} user - User object from session
 * @param {string} targetDepartment - Department to check access for
 * @returns {boolean} - Whether user has access
 */
const canAccessDepartment = (user, targetDepartment) => {
    if (user.role === 'user') {
        return user.department === targetDepartment;
    }
    return true; // Admins can access all departments
};

/**
 * Middleware: validateDepartmentAccess
 * Ensures user can only access data from their own department (unless admin)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateDepartmentAccess = (req, res, next) => {
    const user = req.session.user;
    const targetDept = req.params.department || req.body.department;
    
    if (!canAccessDepartment(user, targetDept)) {
        return res.status(403).json({ error: 'Bạn chỉ được truy cập phòng ban của mình!' });
    }
    
    next();
};

module.exports = {
    requireAuth,
    requireAdminOrManager,
    requireTotalAdmin,
    requireDeptAdminOrTotalAdmin,
    validateDepartmentAccess,
    canAccessDepartment
};