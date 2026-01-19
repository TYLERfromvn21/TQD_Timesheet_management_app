/**
 * TASK CONTROLLER
 * ---------------
 * Handles timesheet task operations
 * List tasks, save/update tasks, delete tasks
 * Includes business rules like curfew checking
 * Uses async/await for database operations
 */

const uuid = require('uuid');

/**
 * Get Tasks by Date
 * Retrieves tasks for a specific date and user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function getTasksByDate(req, res) {
    try {
        const { db } = req.app.locals;
        const { date } = req.params;
        const userId = req.session.user.id;
        
        if (!date) {
            return res.status(400).json({ error: 'Ngày là bắt buộc' });
        }
        
        const tasks = await db.allAsync(
            'SELECT * FROM tasks WHERE user_id = ? AND date = ?', 
            [userId, date]
        );
        
        return res.json(tasks || []);
        
    } catch (error) {
        console.error('Get tasks error:', error);
        return res.status(500).json({ error: 'Lỗi khi lấy danh sách công việc' });
    }
}

/**
 * Save or Update Task
 * Creates a new task or updates an existing one
 * Includes business rule: Curfew check (23:00-06:00 restriction)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function saveTask(req, res) {
    try {
        const { db } = req.app.locals;
        const { task_id, department, job_code, task_description, start_time, end_time, date } = req.body;
        
        // Validation
        if (!department || !job_code || !start_time || !end_time || !date) {
            return res.status(400).json({ error: 'Tất cả các trường là bắt buộc' });
        }
        
        // Convert times to numbers for comparison
        const startTimeNum = parseInt(start_time);
        const endTimeNum = parseInt(end_time);
        
        if (isNaN(startTimeNum) || isNaN(endTimeNum)) {
            return res.status(400).json({ error: 'Thời gian không hợp lệ' });
        }
        
        if (endTimeNum <= startTimeNum) {
            return res.status(400).json({ error: 'Giờ kết thúc phải lớn hơn bắt đầu' });
        }
        
        // BUSINESS RULE: Curfew Check
        // Restrict standard users from submitting tasks between 23:00 and 06:00
        const now = new Date();
        const currentHour = now.getHours();
        
        if (req.session.user.role !== 'admin_total') {
            if (currentHour >= 23 || currentHour < 6) {
                return res.status(403).json({ 
                    error: 'Hệ thống khóa chức năng khai báo từ 23:00 đến 06:00 sáng!' 
                });
            }
        }
        
        if (task_id) {
            // Update existing task
            await db.runAsync(
                `UPDATE tasks SET department=?, job_code=?, task_description=?, start_time=?, end_time=? 
                 WHERE task_id=? AND user_id=?`,
                [department, job_code, task_description || '', startTimeNum, endTimeNum, task_id, req.session.user.id]
            );
            return res.json({ message: 'Updated' });
        } else {
            // Create new task
            const newTaskId = uuid.v4();
            await db.runAsync(
                `INSERT INTO tasks (task_id, user_id, department, job_code, task_description, start_time, end_time, completed, date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                [newTaskId, req.session.user.id, department, job_code, task_description || '', startTimeNum, endTimeNum, date]
            );
            return res.json({ message: 'Saved' });
        }
        
    } catch (error) {
        console.error('Save task error:', error);
        return res.status(500).json({ error: 'Lỗi khi lưu công việc' });
    }
}

/**
 * Delete Task
 * Deletes a specific task
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function deleteTask(req, res) {
    try {
        const { db } = req.app.locals;
        const { task_id } = req.body;
        
        if (!task_id) {
            return res.status(400).json({ error: 'ID công việc là bắt buộc' });
        }
        
        await db.runAsync(
            'DELETE FROM tasks WHERE task_id = ? AND user_id = ?', 
            [task_id, req.session.user.id]
        );
        
        return res.json({ msg: 'Deleted' });
        
    } catch (error) {
        console.error('Delete task error:', error);
        return res.status(500).json({ error: 'Lỗi khi xóa công việc' });
    }
}

module.exports = {
    getTasksByDate,
    saveTask,
    deleteTask
};