/**
 * TASK ROUTES
 * -----------
 * Defines all timesheet task operation endpoints
 */

const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { requireAuth } = require('../middleware/authMiddleware');

// GET: Retrieve tasks for a specific date
router.get('/tasks/:date', requireAuth, taskController.getTasksByDate);

// POST: Save or Update a task
router.post('/save-task', requireAuth, taskController.saveTask);

// POST: Delete a task
router.post('/delete-task', requireAuth, taskController.deleteTask);

module.exports = router;