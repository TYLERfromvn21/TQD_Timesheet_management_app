/**
 * EXCEL REPORT SERVICE
 * --------------------
 * Handles all Excel report generation logic
 * Extracted from the original monolithic app.js file (lines 217-524)
 * Uses async/await and ExcelJS for report generation
 */

const ExcelJS = require('exceljs');

/**
 * Generate User Timesheet Report
 * Creates an Excel file detailing a specific user's activities for a month
 * Features:
 * - Joins 'tasks' with 'job_codes' to get the static description
 * - Merges multiple task entries for the same job in a single day
 * - Includes summary statistics and idle days
 * 
 * @param {string} userId - User ID to generate report for
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g., 2025)
 * @param {Object} db - Database instance with async methods
 * @returns {Promise<Object>} - Excel workbook ready for writing
 */
async function generateUserReport(userId, month, year, db) {
    try {
        // Fetch User Info
        const user = await db.getAsync('SELECT username FROM users WHERE id = ?', [userId]);
        if (!user) {
            throw new Error('User not found');
        }

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

        const tasks = await db.allAsync(sql, [userId, startDate, endDate]);

        // Create Excel workbook
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

        return {
            workbook,
            fileName: `BAOCAO_USER_${user.username}_${month}_${year}.xlsx`
        };

    } catch (error) {
        console.error('Error generating user report:', error);
        throw error;
    }
}

/**
 * Generate Job Summary Report
 * Creates an overview of all jobs, grouped by department
 * Features:
 * - Dynamic generation of tables based on active departments in the DB
 * - Adds 'Static Content' column to report
 * - Creates detailed sheets for each department
 * 
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g., 2025)
 * @param {Object} db - Database instance with async methods
 * @returns {Promise<Object>} - Excel workbook ready for writing
 */
async function generateJobReport(month, year, db) {
    try {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
        
        // Step 1: Fetch all departments to generate dynamic tables
        const departments = await db.allAsync("SELECT * FROM departments ORDER BY name");
        
        // Step 2: Fetch task data joined with job descriptions
        const query = `
            SELECT t.job_code, t.department, t.start_time, t.end_time, u.username, j.task_description as static_desc 
            FROM tasks t 
            JOIN users u ON t.user_id = u.id 
            LEFT JOIN job_codes j ON t.job_code = j.job_code AND t.department = j.department
            WHERE t.date BETWEEN ? AND ?
        `;

        const rows = await db.allAsync(query, [startDate, endDate]);

        // Create Excel workbook
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
        
        departments.forEach((d, index) => {
            const color = colors[index % colors.length];
            drawTable(`${tableIndex}. PHÒNG ${d.name.toUpperCase()}`, processDataForTable(d.code), color, false);
            tableIndex++;
        });

        // CREATE DETAILED SHEETS (One sheet per department)
        departments.forEach((d, index) => {
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

        return {
            workbook,
            fileName: `BAOCAO_JOBCODE_THANG_${month}_NAM_${year}.xlsx`
        };

    } catch (error) {
        console.error('Error generating job report:', error);
        throw error;
    }
}

module.exports = {
    generateUserReport,
    generateJobReport
};