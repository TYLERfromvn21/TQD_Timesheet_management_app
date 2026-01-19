/**
 * USER ROUTES
 * ----------
 * Defines all user management endpoints
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAdminOrManager } = require('../middleware/authMiddleware');

// GET: Retrieve list of users (Filtered by department for Admin Dept)
router.get('/api/manage-users', requireAdminOrManager, userController.getUsers);

// GET: Retrieve all users for the reporting dropdown (Admin Total only)
router.get('/admin/all-users', requireAdminOrManager, userController.getAllUsersForAdmin);

// POST: Update user credentials (username or password reset)
router.post('/api/update-user', requireAdminOrManager, userController.updateUser);

// POST: Delete a user account
router.post('/api/delete-user', requireAdminOrManager, userController.deleteUser);

module.exports = router;