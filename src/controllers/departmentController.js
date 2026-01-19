/**
 * DEPARTMENT CONTROLLER
 * ---------------------
 * Handles department management operations
 * List departments, add new departments
 * Uses async/await for database operations
 */

const uuid = require('uuid');

/**
 * Get All Departments
 * Retrieves list of all departments for dropdown lists
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function getDepartments(req, res) {
    try {
        const { db } = req.app.locals;
        const departments = await db.allAsync('SELECT * FROM departments ORDER BY name', []);
        return res.json(departments || []);
    } catch (error) {
        console.error('Get departments error:', error);
        return res.status(500).json({ error: 'Lỗi khi lấy danh sách phòng ban' });
    }
}

/**
 * Add New Department
 * Creates a new department (Admin Total only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function addDepartment(req, res) {
    try {
        const { db } = req.app.locals;
        
        // Only Admin Total can add departments
        if (req.session.user.role !== 'admin_total') {
            return res.status(403).json({ error: 'Chỉ Admin Tổng mới được thêm phòng ban' });
        }

        const { name } = req.body;
        
        // Validation
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Tên phòng ban không được để trống' });
        }

        // Generate a simple unique code based on UUID
        const code = name.trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
            .replace(/\s+/g, '_')                              
            .replace(/[^a-z0-9_]/g, '');                      
        const id = uuid.v4();
        
        await db.runAsync(
            'INSERT INTO departments (id, code, name) VALUES (?, ?, ?)', 
            [id, code, name.trim()]
        );
        
        return res.json({ message: 'Đã thêm phòng ban thành công' });
        
    } catch (error) {
        console.error('Add department error:', error);
        
        // Handle duplicate department name
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Tên phòng ban đã tồn tại' });
        }
        
        return res.status(500).json({ error: 'Lỗi khi thêm phòng ban' });
    }
}
/**
 * Update Department
 * Updates department name (Admin Total only)
 */
async function updateDepartment(req, res) {
    try {
        const { db } = req.app.locals;
        
        // Check Admin Total role
        if (req.session.user.role !== 'admin_total') {
            return res.status(403).json({ error: 'Chỉ Admin Tổng mới được sửa phòng ban' });
        }

        const { id, name } = req.body;

        if (!id || !name || name.trim() === '') {
            return res.status(400).json({ error: 'Thiếu thông tin cần sửa' });
        }

        await db.runAsync(
            'UPDATE departments SET name = ? WHERE id = ?', 
            [name.trim(), id]
        );

        return res.json({ message: 'Cập nhật thành công' });

    } catch (error) {
        console.error('Update dept error:', error);
        return res.status(500).json({ error: 'Lỗi khi sửa phòng ban' });
    }
}

/**
 * Delete Department
 * Deletes a department (Admin Total only)
 * Business Rule: Cannot delete if users exist in that department
 */
async function deleteDepartment(req, res) {
    try {
        const { db } = req.app.locals;
        
        if (req.session.user.role !== 'admin_total') {
            return res.status(403).json({ error: 'Chỉ Admin Tổng mới được xóa phòng ban' });
        }

        const { id } = req.body;

        // 1. Get department info first
        const dept = await db.getAsync('SELECT code FROM departments WHERE id = ?', [id]);
        if (!dept) {
            return res.status(404).json({ error: 'Phòng ban không tồn tại' });
        }

        // 2. Check if any users are in this department
        const userCount = await db.getAsync(
            'SELECT COUNT(*) as count FROM users WHERE department = ?', 
            [dept.code]
        );

        if (userCount.count > 0) {
            return res.status(400).json({ 
                error: `Không thể xóa! Có ${userCount.count} nhân viên đang thuộc phòng ban này.` 
            });
        }

        // 3. Delete if safe
        await db.runAsync('DELETE FROM departments WHERE id = ?', [id]);

        return res.json({ message: 'Đã xóa phòng ban' });

    } catch (error) {
        console.error('Delete dept error:', error);
        return res.status(500).json({ error: 'Lỗi khi xóa phòng ban' });
    }
}
module.exports = {
    getDepartments,
    addDepartment,
    updateDepartment, 
    deleteDepartment 
};