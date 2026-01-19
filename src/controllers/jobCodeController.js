/**
 * JOB CODE CONTROLLER
 * -------------------
 * Handles job code management operations
 * List job codes, create new job codes, delete job codes
 * Uses async/await for database operations
 */

const uuid = require('uuid');

/**
 * Get Job Codes by Department
 * Retrieves active job codes for a specific department
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function getJobCodesByDepartment(req, res) {
    try {
        const { db } = req.app.locals;
        let targetDept = req.params.department;
        
        // Security check: Regular users can only see jobs from their own department
        if (req.session.user.role === 'user' && req.session.user.department !== targetDept) {
            targetDept = req.session.user.department;
        }
        
        const jobCodes = await db.allAsync(
            'SELECT job_id, job_code, task_description FROM job_codes WHERE department = ? AND is_active = 1 ORDER BY job_code', 
            [targetDept]
        );
        
        return res.json(jobCodes);
        
    } catch (error) {
        console.error('Get job codes error:', error);
        return res.status(500).json({ error: 'Lỗi khi lấy danh sách Job Code' });
    }
}

/**
 * Create New Job Code
 * Creates a new Job Code entry
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function createJobCode(req, res) {
    try {
        const { db } = req.app.locals;
        const { department, job_code, task_description } = req.body;
        
        // Validation
        if (!department || !job_code || !task_description) {
            return res.status(400).json({ error: 'Tất cả các trường là bắt buộc' });
        }
        
        if (job_code.trim() === '' || task_description.trim() === '') {
            return res.status(400).json({ error: 'Mã Job và nội dung không được để trống' });
        }
        
        // Validation: Dept Admin can only create jobs for their own department
        if (req.session.user.role === 'admin_dept' && department !== req.session.user.department) {
            return res.status(403).json({ error: 'Bạn chỉ được tạo Job cho phòng của mình!' });
        }
        
        const id = uuid.v4();
        
        await db.runAsync(
            'INSERT INTO job_codes (job_id, department, job_code, task_description, is_active) VALUES (?, ?, ?, ?, 1)',
            [id, department, job_code.trim(), task_description.trim()]
        );
        
        return res.json({ message: 'Tạo thành công' });
        
    } catch (error) {
        console.error('Create job code error:', error);
        
        // Handle duplicate job code
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: `Mã Job "${req.body.job_code}" đã tồn tại!` });
        }
        
        return res.status(500).json({ error: 'Lỗi khi tạo Job Code' });
    }
}

/**
 * Delete Job Code
 * Soft deletes a Job Code (Mark as inactive)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function deleteJobCode(req, res) {
    try {
        const { db } = req.app.locals;
        const { job_id } = req.body;
        
        if (!job_id) {
            return res.status(400).json({ error: 'ID Job Code là bắt buộc' });
        }
        
        await db.runAsync('UPDATE job_codes SET is_active = 0 WHERE job_id = ?', [job_id]);
        return res.json({ message: 'Đã xóa Job Code' });
        
    } catch (error) {
        console.error('Delete job code error:', error);
        return res.status(500).json({ error: 'Lỗi khi xóa Job Code' });
    }
}

module.exports = {
    getJobCodesByDepartment,
    createJobCode,
    deleteJobCode
};