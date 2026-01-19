/**
 * USER CONTROLLER
 * ---------------
 * Handles user management operations
 * List users, update user credentials, delete users
 * Uses async/await and bcrypt for password operations
 */

const bcrypt = require('bcrypt');

/**
 * Get Users List
 * Retrieves list of users (Filtered by department for Admin Dept)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function getUsers(req, res) {
    try {
        const { db } = req.app.locals;
        let sql = 'SELECT id, username, role, department FROM users';
        let params = [];
        
        // If the requester is a Dept Manager, limit the scope to their department
        if (req.session.user.role === 'admin_dept') {
            sql += ' WHERE department = ?';
            params.push(req.session.user.department);
        }
        
        const users = await db.allAsync(sql, params);
        return res.json(users || []);
        
    } catch (error) {
        console.error('Get users error:', error);
        return res.status(500).json({ error: 'Lỗi khi lấy danh sách người dùng' });
    }
}

/**
 * Get All Users for Admin
 * Retrieves all users for reporting dropdown (Admin Total only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function getAllUsersForAdmin(req, res) {
    try {
        const { db } = req.app.locals;
        // Only Admin Total can access all users
        if (req.session.user.role !== 'admin_total') {
            return res.status(403).json([]);
        }
        
        const users = await db.allAsync('SELECT id, username, role, department FROM users ORDER BY username', []);
        return res.json(users || []);
        
    } catch (error) {
        console.error('Get all users error:', error);
        return res.status(500).json({ error: 'Lỗi khi lấy danh sách người dùng' });
    }
}

/**
 * Update User
 * Updates user credentials (username or password reset)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function updateUser(req, res) {
    try {
        const { db } = req.app.locals;
        const { id, username, password } = req.body;
        
        // Validation
        if (!id || !username) {
            return res.status(400).json({ error: 'ID và tên đăng nhập là bắt buộc' });
        }
        
        if (username.trim() === '') {
            return res.status(400).json({ error: 'Tên đăng nhập không được để trống' });
        }
        
        if (password) {
            // If password is provided, hash it asynchronously before saving
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.runAsync(
                'UPDATE users SET username = ?, password = ? WHERE id = ?', 
                [username.trim(), hashedPassword, id]
            );
        } else {
            // Only update username
            await db.runAsync(
                'UPDATE users SET username = ? WHERE id = ?', 
                [username.trim(), id]
            );
        }
        
        return res.json({ msg: 'OK' });
        
    } catch (error) {
        console.error('Update user error:', error);
        
        // Handle duplicate username
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
        }
        
        return res.status(500).json({ error: 'Lỗi khi cập nhật người dùng' });
    }
}

/**
 * Delete User
 * Deletes a user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function deleteUser(req, res) {
    try {
        const { db } = req.app.locals;
        const { id } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'ID người dùng là bắt buộc' });
        }
        
        // Prevent self-deletion
        if (id === req.session.user.id) {
            return res.status(400).json({ error: 'Không thể xóa tài khoản của chính mình' });
        }
        
        await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
        return res.json({ msg: 'Deleted' });
        
    } catch (error) {
        console.error('Delete user error:', error);
        return res.status(500).json({ error: 'Lỗi khi xóa người dùng' });
    }
}

module.exports = {
    getUsers,
    getAllUsersForAdmin,
    updateUser,
    deleteUser
};