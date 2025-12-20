/**
 * TÍN VIỆT TIMESHEET - BACKEND SERVER
 * -----------------------------------
 * Main entry point for the Node.js application.
 * This file handles:
 * 1. Server configuration and Security Middleware.
 * 2. Database connection and Schema initialization (SQLite).
 * 3. Authentication and Session management.
 * 4. API Endpoints for Frontend communication.
 * 5. Business Logic (Timesheet rules, Reporting, User Management).
 */

// --- 1. IMPORTS & DEPENDENCIES ---
const express = require('express');           // Web framework for Node.js
const sqlite3 = require('sqlite3').verbose(); // SQLite database driver
const uuid = require('uuid');                 // Generates unique IDs
const path = require('path');                 // File path utilities
const session = require('express-session');   // Session middleware for authentication
const bcrypt = require('bcrypt');             // Library for hashing passwords
const helmet = require('helmet');             // Security middleware (HTTP headers)
const rateLimit = require('express-rate-limit'); // Security middleware (DDoS protection)
const ExcelJS = require('exceljs');           // Library to generate Excel reports

// Initialize Express App
const app = express();
const port = 3000;

// --- 2. SECURITY & CONFIGURATION ---

// Apply Helmet for security headers (Content Security Policy disabled for inline scripts compatibility)
app.use(helmet({ contentSecurityPolicy: false }));

// Rate Limiting: Prevent brute-force attacks (Max 200 requests per 15 minutes)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Body parsing middleware to handle form data and JSON payloads
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (HTML, CSS, Client-side JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'))); 

// Session Configuration
// Stores user login state securely using cookies
app.use(session({
  secret: 'secret_key_2025_final_v4', // Secret key used to sign the session ID cookie
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 86400000 } // Session expires in 24 hours
}));

// --- 3. DATABASE INITIALIZATION ---

// Connect to SQLite database file
const db = new sqlite3.Database('timesheet.db');

// Initialize Database Schema
// Creates tables if they do not exist when the server starts
db.serialize(() => {
    // Table: Users (Stores account credentials and roles)
    db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password TEXT, role TEXT, department TEXT)`);
    
    // Table: Job Codes (Stores selectable tasks for departments)
    db.run(`CREATE TABLE IF NOT EXISTS job_codes (job_id TEXT PRIMARY KEY, department TEXT, job_code TEXT, task_description TEXT, is_active INTEGER DEFAULT 1, UNIQUE(department, job_code))`);
    
    // Table: Tasks (Stores actual timesheet entries)
    db.run(`CREATE TABLE IF NOT EXISTS tasks (task_id TEXT PRIMARY KEY, user_id TEXT, department TEXT, job_code TEXT, task_description TEXT, start_time INTEGER, end_time INTEGER, completed BOOLEAN DEFAULT 1, date TEXT, FOREIGN KEY (user_id) REFERENCES users(id))`);
    
    // Table: Departments (Stores dynamic department list)
    db.run(`CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT)`);
    
    // Seeding: Insert default departments if the table is empty
    db.get("SELECT count(*) as count FROM departments", (err, row) => {
        if (row && row.count === 0) {
            const depts = [
                {code: 'ke_toan', name: 'Kế toán'},
                {code: 'kiem_toan_bc_tc', name: 'Kiểm toán BCTC'},
                {code: 'kiem_toan_xdcb', name: 'Kiểm toán XDCB'},
                {code: 'tham_dinh_gia_tv_thue', name: 'Thẩm định giá'},
                {code: 'khac', name: 'Khác'}
            ];
            const stmt = db.prepare("INSERT INTO departments (id, code, name) VALUES (?, ?, ?)");
            depts.forEach(d => stmt.run(uuid.v4(), d.code, d.name));
            stmt.finalize();
        }
    });
});

// --- 4. MIDDLEWARE FUNCTIONS ---

/**
 * Middleware: requireAuth
 * Ensures the user is logged in before accessing protected routes.
 */
const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ error: 'Vui lòng đăng nhập' });
};

/**
 * Middleware: requireAdminOrManager
 * Restricts access to Admins (Total or Dept) only.
 */
const requireAdminOrManager = (req, res, next) => {
    if (req.session.user && (req.session.user.role.includes('admin'))) return next();
    return res.status(403).json({ error: 'Không có quyền truy cập' });
};

// ==================================================================
// SECTION 5: API ENDPOINTS
// ==================================================================

// --- 5.1 DEPARTMENT MANAGEMENT ---

// GET: Retrieve all departments for dropdown lists
app.get('/api/departments', (req, res) => {
    db.all('SELECT * FROM departments ORDER BY name', [], (err, rows) => res.json(rows || []));
});

// POST: Add a new department (Admin Total only)
app.post('/api/add-department', requireAdminOrManager, (req, res) => {
    if(req.session.user.role !== 'admin_total') return res.status(403).json({error: 'Chỉ Admin Tổng mới được thêm'});
    const { name } = req.body;
    // Generate a simple unique code based on UUID
    const code = 'dept_' + uuid.v4().split('-')[0]; 
    db.run('INSERT INTO departments (id, code, name) VALUES (?, ?, ?)', [uuid.v4(), code, name], (err) => {
        if(err) return res.status(500).json({error: 'Lỗi DB'});
        res.json({message: 'Đã thêm'});
    });
});

// --- 5.2 USER MANAGEMENT ---

// GET: Retrieve list of users (Filtered by department for Admin Dept)
app.get('/api/manage-users', requireAdminOrManager, (req, res) => {
    let sql = 'SELECT id, username, role, department FROM users';
    let params = [];
    // If the requester is a Dept Manager, limit the scope to their department
    if (req.session.user.role === 'admin_dept') {
        sql += ' WHERE department = ?';
        params.push(req.session.user.department);
    }
    db.all(sql, params, (err, rows) => res.json(rows || []));
});

// POST: Update user credentials (username or password reset)
app.post('/api/update-user', requireAdminOrManager, (req, res) => {
    const { id, username, password } = req.body;
    if (password) {
        // If password is provided, hash it before saving
        const hash = bcrypt.hashSync(password, 10);
        db.run('UPDATE users SET username = ?, password = ? WHERE id = ?', [username, hash, id], (err) => res.json({msg: 'OK'}));
    } else {
        db.run('UPDATE users SET username = ? WHERE id = ?', [username, id], (err) => res.json({msg: 'OK'}));
    }
});

// POST: Delete a user account
app.post('/api/delete-user', requireAdminOrManager, (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.body.id], (err) => res.json({msg: 'Deleted'}));
});

// --- 5.3 JOB CODE MANAGEMENT ---

// GET: Retrieve active job codes for a specific department
app.get('/job-codes/:department', requireAuth, (req, res) => {
    let targetDept = req.params.department;
    // Security check: Regular users can only see jobs from their own department
    if (req.session.user.role === 'user' && req.session.user.department !== targetDept) {
        targetDept = req.session.user.department;
    }
    db.all('SELECT job_id, job_code, task_description FROM job_codes WHERE department = ? AND is_active = 1 ORDER BY job_code', [targetDept], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST: Create a new Job Code
app.post('/save-job-code', requireAdminOrManager, (req, res) => {
    const { department, job_code, task_description } = req.body;
    // Validation: Dept Admin can only create jobs for their own department
    if (req.session.user.role === 'admin_dept' && department !== req.session.user.department) {
        return res.status(403).json({ error: 'Bạn chỉ được tạo Job cho phòng của mình!' });
    }
    const id = uuid.v4();
    db.run('INSERT INTO job_codes (job_id, department, job_code, task_description, is_active) VALUES (?, ?, ?, ?, 1)',
        [id, department, job_code, task_description],
        function(err) {
            if (err) return res.status(400).json({ error: `Mã Job "${job_code}" đã tồn tại!` });
            res.json({ message: 'Tạo thành công' });
        }
    );
});

// POST: Soft delete a Job Code (Mark as inactive)
app.post('/delete-job-code-def', requireAdminOrManager, (req, res) => {
    const { job_id } = req.body;
    db.run('UPDATE job_codes SET is_active = 0 WHERE job_id = ?', [job_id], (err) => {
        if (err) return res.status(500).json({ error: 'Lỗi DB' });
        res.json({ message: 'Đã xóa Job Code' });
    });
});

// GET: Retrieve all users for the reporting dropdown (Admin Total only)
app.get('/admin/all-users', requireAdminOrManager, (req, res) => {
    if(req.session.user.role !== 'admin_total') return res.status(403).json([]);
    db.all('SELECT id, username, role, department FROM users ORDER BY username', [], (err, rows) => {
        res.json(rows || []);
    });
});

// ==================================================================
// SECTION 6: REPORTING LOGIC (EXCEL)
// ==================================================================

/**
 * Endpoint: User Timesheet Report
 * Generates an Excel file detailing a specific user's activities for a month.
 * Features:
 * - Joins 'tasks' with 'job_codes' to get the static description.
 * - Merges multiple task entries for the same job in a single day (Description aggregation).
 */
app.get('/export/user-report', requireAdminOrManager, async (req, res) => {
    if(req.session.user.role !== 'admin_total') return res.status(403).send("Quyền hạn chế");
    const { userId, month, year } = req.query;
    
    // Fetch User Info
    db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
        if (!user) return res.status(404).send("User not found");
        
        // Calculate date range for the selected month
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${daysInMonth}`;
        
        // Fetch tasks with JOIN to get the original (static) job description
        const sql = `
            SELECT t.*, j.task_description as static_desc 
            FROM tasks t 
            LEFT JOIN job_codes j ON t.job_code = j.job_code AND t.department = j.department
            WHERE t.user_id = ? AND t.date BETWEEN ? AND ? 
            ORDER BY t.date ASC, t.start_time ASC
        `;
        
        db.all(sql, [userId, startDate, endDate], async (err, tasks) => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Chi tiết công việc');

            // Define Excel Columns
            sheet.columns = [
                { header: 'Ngày', key: 'date', width: 12 },
                { header: 'Mã Job', key: 'job', width: 15 },
                { header: 'Nội dung Job (Gốc)', key: 'job_static', width: 30 },
                { header: 'Mô tả chi tiết', key: 'desc', width: 40 },
                { header: 'Thời gian làm', key: 'time_range', width: 25 },
                { header: 'Tổng giờ', key: 'hours', width: 10 },
                { header: 'Số Job/Ngày', key: 'job_count', width: 12 },
            ];

            // Style Header Row
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB22222' } };

            let totalWorkedHours = 0;
            let totalIdleDays = 0;
            let totalJobCount = 0;

            // Iterate through each day of the month
            for (let d = 1; d <= daysInMonth; d++) {
                const dayStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                const rawDailyTasks = tasks.filter(t => t.date === dayStr);

                if (rawDailyTasks.length > 0) {
                    // Logic to merge tasks with the same Job Code in one day
                    const mergedTasks = {};
                    rawDailyTasks.forEach(t => {
                        const code = t.job_code;
                        const duration = (t.end_time - t.start_time) / 3600000;
                        const timeStr = `${new Date(t.start_time).toTimeString().substr(0,5)}-${new Date(t.end_time).toTimeString().substr(0,5)}`;
                        
                        if (!mergedTasks[code]) {
                            mergedTasks[code] = { 
                                job_code: code, 
                                static_desc: t.static_desc || '', 
                                user_descs: [], // Array to store user descriptions
                                total_hours: 0, 
                                time_ranges: [] 
                            };
                        }
                        mergedTasks[code].total_hours += duration;
                        mergedTasks[code].time_ranges.push(timeStr);
                        // Push description to array for later joining
                        if(t.task_description) mergedTasks[code].user_descs.push(t.task_description);
                    });

                    const finalDailyTasks = Object.values(mergedTasks);
                    
                    finalDailyTasks.forEach((t, index) => {
                        totalWorkedHours += t.total_hours;
                        totalJobCount++; 

                        const timeRangeText = t.time_ranges.join('\n');
                        // Aggregate user descriptions with new lines
                        const userDescText = t.user_descs.join('\n');

                        const row = sheet.addRow({
                            date: dayStr, 
                            job: t.job_code, 
                            job_static: t.static_desc,
                            desc: userDescText,
                            time_range: timeRangeText,
                            hours: t.total_hours.toFixed(2),
                            job_count: (index === 0) ? finalDailyTasks.length : ''
                        });

                        // Formatting: Wrap text for multi-line cells
                        row.getCell('desc').alignment = { vertical: 'middle', wrapText: true };
                        row.getCell('time_range').alignment = { vertical: 'middle', wrapText: true };
                        row.getCell('job_static').alignment = { vertical: 'middle', wrapText: true };

                        if(index === 0) {
                            row.getCell('job_count').font = { bold: true, color: { argb: 'FF0000FF' } };
                            row.getCell('job_count').alignment = { horizontal: 'center', vertical: 'top' };
                        }
                    });
                } else {
                    // Handle idle days
                    totalIdleDays++;
                    const row = sheet.addRow({
                        date: dayStr, job: '---', job_static: '-', desc: 'Không chọn Job Code (Nghỉ/Không làm)',
                        time_range: '-', hours: 0, job_count: 0
                    });
                    row.eachCell((cell) => { 
                        cell.fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FFF0F0F0'} }; 
                        cell.font = { color: { argb: 'FF888888' }, italic: true };
                    });
                }
            }

            // Report Footer: Summary Statistics
            sheet.addRow({});
            let rStart = sheet.rowCount + 1;
            const r1 = sheet.addRow(['TỔNG KẾT THÁNG:', '', '', '', '', '', '']);
            sheet.mergeCells(`A${rStart}:E${rStart}`);
            r1.getCell(1).font = { bold: true, size: 12 };

            rStart++;
            const r2 = sheet.addRow(['1. Tổng giờ làm việc thực tế:', '', '', '', '', totalWorkedHours.toFixed(2) + ' giờ']);
            sheet.mergeCells(`A${rStart}:E${rStart}`);
            r2.getCell(6).font = { bold: true, color: { argb: 'FF008000' } };

            rStart++;
            const r3 = sheet.addRow(['2. Tổng số ngày không làm (trống):', '', '', '', '', totalIdleDays + ' ngày']);
            sheet.mergeCells(`A${rStart}:E${rStart}`);
            r3.getCell(6).font = { bold: true, color: { argb: 'FFFF0000' } };

            rStart++;
            const r4 = sheet.addRow(['3. Tổng số đầu việc (Job) đã làm:', '', '', '', '', totalJobCount + ' job']);
            sheet.mergeCells(`A${rStart}:E${rStart}`);
            r4.getCell(6).font = { bold: true, color: { argb: 'FF0000FF' } };

            const fileName = `BAOCAO_USER_${user.username}_${month}_${year}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
            await workbook.xlsx.write(res);
            res.end();
        });
    });
});

/**
 * Endpoint: Job Summary Report
 * Generates an overview of all jobs, grouped by department.
 * Features:
 * - Dynamic generation of tables based on active departments in the DB.
 * - Adds 'Static Content' column to report.
 */
app.get('/export/job-report', requireAdminOrManager, async (req, res) => {
    if(req.session.user.role !== 'admin_total') return res.status(403).send("Quyền hạn chế");
    const { month, year } = req.query;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
    
    // Step 1: Fetch all departments to generate dynamic tables
    db.all("SELECT * FROM departments", [], (err, depts) => {
        if(err) depts = []; 
        
        // Step 2: Fetch task data joined with job descriptions
        const query = `
            SELECT t.job_code, t.department, t.start_time, t.end_time, u.username, j.task_description as static_desc 
            FROM tasks t 
            JOIN users u ON t.user_id = u.id 
            LEFT JOIN job_codes j ON t.job_code = j.job_code AND t.department = j.department
            WHERE t.date BETWEEN ? AND ?
        `;

        db.all(query, [startDate, endDate], async (err, rows) => {
            const workbook = new ExcelJS.Workbook();
            const summarySheet = workbook.addWorksheet('TỔNG HỢP');
            
            // Helper function to process data for specific department filters
            const processDataForTable = (filterDept) => {
                const map = {};
                rows.forEach(r => {
                    if (filterDept && r.department !== filterDept) return;
                    const key = r.job_code;
                    if (!map[key]) {
                        map[key] = { 
                            code: r.job_code, 
                            desc: r.static_desc || '', 
                            dept: r.department, 
                            totalTime: 0, 
                            users: new Set() 
                        };
                    }
                    map[key].totalTime += (r.end_time - r.start_time);
                    map[key].users.add(r.username);
                });
                return Object.values(map).sort((a,b) => a.code.localeCompare(b.code));
            };

            let currentRow = 1;
            
            // Function to draw a data table in Excel
            const drawTable = (title, data, headerColor, showDeptCol = true) => {
                const titleRow = summarySheet.getRow(currentRow);
                titleRow.getCell(1).value = title.toUpperCase();
                titleRow.font = { bold: true, size: 14, color: { argb: headerColor } };
                currentRow++;

                const headerRow = summarySheet.getRow(currentRow);
                // Configure Headers based on context
                if (showDeptCol) {
                    headerRow.values = ['Mã Job', 'Nội dung Job', 'Phòng ban', 'Số lượng NV', 'Tổng giờ làm (h)'];
                    ['A','B','C','D','E'].forEach(c => {
                        headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
                        headerRow.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    });
                } else {
                    headerRow.values = ['Mã Job', 'Nội dung Job', 'Số lượng NV', 'Tổng giờ làm (h)'];
                    ['A','B','C','D'].forEach((c, i) => {
                        headerRow.getCell(String.fromCharCode(65+i)).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
                        headerRow.getCell(String.fromCharCode(65+i)).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    });
                }
                currentRow++;

                if (data.length === 0) { 
                    summarySheet.getRow(currentRow).getCell(1).value = "(Không có dữ liệu)"; 
                    currentRow++; 
                } else {
                    data.forEach(item => {
                        const r = summarySheet.getRow(currentRow);
                        if (showDeptCol) {
                            r.values = [item.code, item.desc, item.dept, item.users.size, (item.totalTime / 3600000).toFixed(2)];
                        } else {
                            r.values = [item.code, item.desc, item.users.size, (item.totalTime / 3600000).toFixed(2)];
                        }
                        r.getCell(2).alignment = { wrapText: true };
                        currentRow++;
                    });
                }
                currentRow += 2;
            };

            // Set column widths
            summarySheet.columns = [{width: 15}, {width: 35}, {width: 20}, {width: 15}, {width: 20}];

            // DRAW TABLE 1: Overall Summary (All Departments)
            drawTable('1. TỔNG HỢP TOÀN CÔNG TY', processDataForTable(null), 'FF000000', true);
            
            // DRAW TABLES 2...N: Detail for each department (Dynamic Loop)
            let tableIndex = 2;
            const colors = ['FFB22222', 'FF2E8B57', 'FF4169E1', 'FFDAA520', 'FF8E44AD', 'FFF39C12'];
            
            depts.forEach((d, index) => {
                const color = colors[index % colors.length];
                drawTable(`${tableIndex}. PHÒNG ${d.name.toUpperCase()}`, processDataForTable(d.code), color, false);
                tableIndex++;
            });

            // CREATE DETAILED SHEETS (One sheet per department)
            depts.forEach((d, index) => {
                const color = colors[index % colors.length];
                const sheet = workbook.addWorksheet(d.name.substring(0, 30)); // Sheet name max length 31
                
                sheet.columns = [
                    { header: 'Mã Job', key: 'code', width: 20 }, 
                    { header: 'Nội dung Job', key: 'desc', width: 35 },
                    { header: 'Nhân viên thực hiện', key: 'user', width: 30 }, 
                    { header: 'Tổng thời gian (h)', key: 'time', width: 20 }
                ];
                sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
                sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                
                const deptRows = rows.filter(r => r.department === d.code);
                const detailMap = {}; 
                deptRows.forEach(r => {
                    const k = `${r.job_code}|${r.username}`;
                    if (!detailMap[k]) detailMap[k] = {time: 0, desc: r.static_desc};
                    detailMap[k].time += (r.end_time - r.start_time);
                });
                
                Object.keys(detailMap).sort().forEach(key => {
                    const [job, user] = key.split('|');
                    sheet.addRow({ 
                        code: job, 
                        desc: detailMap[key].desc || '', 
                        user: user, 
                        time: (detailMap[key].time / 3600000).toFixed(2) 
                    });
                });
            });

            // Write File
            const fileName = `BAOCAO_JOBCODE_THANG_${month}_NAM_${year}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
            await workbook.xlsx.write(res);
            res.end();
        });
    });
});

// ==================================================================
// SECTION 7: AUTHENTICATION & CORE ROUTES
// ==================================================================

// Basic Page Routes
app.get('/', (req, res) => { if (req.session.user) return res.redirect('/dashboard'); res.sendFile(path.join(__dirname, 'public/index.html')); });
app.get('/dashboard', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public/index_dashboard.html')));
app.get('/admin-auth', (req, res) => res.sendFile(path.join(__dirname, 'public/admin-auth.html')));
app.get('/admin-create', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/manage-users', requireAdminOrManager, (req, res) => res.sendFile(path.join(__dirname, 'public/manage_users.html')));

// POST: User Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (user && bcrypt.compareSync(password, user.password)) {
            req.session.user = user; return res.redirect('/dashboard');
        }
        res.redirect('/?error=' + encodeURIComponent('Sai thông tin'));
    });
});

// POST: Create New Account
app.post('/create-account', (req, res) => {
    // Check if the system is in "Setup Mode" (No Admins exist)
    db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin_total"', (err, row) => {
        const isSetupMode = (row && row.count === 0);
        
        // Security: Prevent unauthorized account creation if not in Setup Mode
        if (!isSetupMode && (!req.session.user || !req.session.user.role.includes('admin'))) {
            return res.status(403).json({ error: 'Cấm truy cập' });
        }
        const { username, password, type, department, hidden_dept, id } = req.body;
        const finalDept = department || hidden_dept;
        const roleToSave = isSetupMode ? 'admin_total' : type;
        
        db.run('INSERT INTO users (id, username, password, role, department) VALUES (?, ?, ?, ?, ?)', 
           [id || uuid.v4(), username, bcrypt.hashSync(password, 10), roleToSave, finalDept], 
           (err) => {
               if (err) return res.redirect('/admin-create?error=' + encodeURIComponent('Trùng tên'));
               if (isSetupMode) return res.redirect('/admin-auth');
               res.redirect('/admin-create?message=' + encodeURIComponent('Tạo thành công!'));
           });
    });
});

// ==================================================================
// SECTION 8: TIMESHEET TASK OPERATIONS
// ==================================================================

// GET: Retrieve tasks for a specific date
app.get('/tasks/:date', requireAuth, (req, res) => {
    db.all('SELECT * FROM tasks WHERE user_id = ? AND date = ?', [req.session.user.id, req.params.date], (err, rows) => res.json(rows || []));
});

// POST: Save or Update a task
app.post('/save-task', requireAuth, (req, res) => {
    const { task_id, department, job_code, task_description, start_time, end_time, date } = req.body;
    
    // BUSINESS RULE: Curfew Check
    // Restrict standard users from submitting tasks between 23:00 and 06:00
    const now = new Date();
    const currentHour = now.getHours();
    if (req.session.user.role !== 'admin_total') {
        if (currentHour >= 23 || currentHour < 6) {
            return res.status(403).json({ error: 'Hệ thống khóa chức năng khai báo từ 23:00 đến 06:00 sáng!' });
        }
    }

    if (end_time <= start_time) return res.status(400).json({ error: 'Giờ kết thúc phải lớn hơn bắt đầu' });

    if (task_id) { 
        // Update existing task
        db.run(`UPDATE tasks SET department=?, job_code=?, task_description=?, start_time=?, end_time=? WHERE task_id=? AND user_id=?`,
            [department, job_code, task_description, start_time, end_time, task_id, req.session.user.id],
            (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Updated' }));
    } else { 
        // Create new task
        db.run(`INSERT INTO tasks (task_id, user_id, department, job_code, task_description, start_time, end_time, completed, date) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [uuid.v4(), req.session.user.id, department, job_code, task_description, start_time, end_time, date],
            (err) => err ? res.status(500).json({ error: err.message }) : res.json({ message: 'Saved' }));
    }
});

// POST: Delete a task
app.post('/delete-task', requireAuth, (req, res) => {
    db.run('DELETE FROM tasks WHERE task_id = ? AND user_id = ?', [req.body.task_id, req.session.user.id], (err) => res.json({msg:'Deleted'}));
});

// Helper Routes
app.get('/check-system-status', (req, res) => { db.get('SELECT COUNT(*) as c FROM users WHERE role="admin_total"', (e,r)=> res.json({isSetupMode: r.c===0}));});

app.post('/api/admin-auth-login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if(user && bcrypt.compareSync(password, user.password)) {
            if(user.role === 'user') return res.status(403).json({error: 'Nhân viên không được vào'});
            req.session.user = user; return res.json({msg:'OK'});
        }
        res.status(401).json({error: 'Sai mật khẩu'});
    });
});

app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });
app.get('/user-info', requireAuth, (req, res) => res.json(req.session.user));

// Start Server
app.listen(port, () => console.log(`Server is running on port ${port}`));