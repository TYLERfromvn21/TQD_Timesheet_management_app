/**
 * REPORT CONTROLLER
 * -----------------
 * Handles Excel report generation and download
 * Calls excelService for actual report generation
 * Uses async/await and streams for file downloads
 */

const { generateUserReport, generateJobReport } = require('../services/excelService');

/**
 * Generate User Timesheet Report
 * Creates and streams an Excel file for a specific user's monthly activities
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function generateUserReportHandler(req, res) {
    try {
        const { db } = req.app.locals;
        // Only Admin Total can generate user reports
        if (req.session.user.role !== 'admin_total') {
            return res.status(403).send("Quyền hạn chế");
        }

        const { userId, month, year } = req.query;
        
        // Validation
        if (!userId || !month || !year) {
            return res.status(400).send('Thiếu tham số bắt buộc: userId, month, year');
        }
        
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        
        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).send('Tháng không hợp lệ (1-12)');
        }
        
        if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            return res.status(400).send('Năm không hợp lệ');
        }
        
        // Generate report using service
        const { workbook, fileName } = await generateUserReport(userId, monthNum, yearNum, db);
        
        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        
        // Write workbook to response stream
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Generate user report error:', error);
        
        if (error.message === 'User not found') {
            return res.status(404).send('User not found');
        }
        
        return res.status(500).send('Lỗi khi tạo báo cáo người dùng');
    }
}

/**
 * Generate Job Summary Report
 * Creates and streams an Excel file for job summary across all departments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} db - Database instance
 */
async function generateJobReportHandler(req, res) {
    try {
        const { db } = req.app.locals;
        // Only Admin Total can generate job reports
        if (req.session.user.role !== 'admin_total') {
            return res.status(403).send("Quyền hạn chế");
        }

        const { month, year } = req.query;
        
        // Validation
        if (!month || !year) {
            return res.status(400).send('Thiếu tham số bắt buộc: month, year');
        }
        
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        
        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).send('Tháng không hợp lệ (1-12)');
        }
        
        if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            return res.status(400).send('Năm không hợp lệ');
        }
        
        // Generate report using service
        const { workbook, fileName } = await generateJobReport(monthNum, yearNum, db);
        
        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        
        // Write workbook to response stream
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Generate job report error:', error);
        return res.status(500).send('Lỗi khi tạo báo cáo Job Code');
    }
}

module.exports = {
    generateUserReportHandler,
    generateJobReportHandler
};