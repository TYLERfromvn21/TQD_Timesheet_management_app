/**
 * AUTHENTICATION ROUTES
 * ---------------------
 * Defines all authentication-related endpoints
 * Maps HTTP methods to controller functions
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Page Routes (GET)
router.get('/', authController.serveLoginPage);
router.get('/dashboard', requireAuth, authController.serveDashboard);
router.get('/admin-auth', authController.serveAdminAuth);
router.get('/admin-create', authController.serveAdminCreate);

// API Routes (POST)
router.post('/login', authController.login);
router.post('/api/admin-auth-login', authController.adminAuthLogin);
router.post('/create-account', authController.createAccount);
router.get('/logout', authController.logout);
router.get('/user-info', requireAuth, authController.getUserInfo);
router.get('/check-system-status', authController.checkSystemStatus);

module.exports = router;