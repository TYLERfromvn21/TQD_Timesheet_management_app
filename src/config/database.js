/**
 * DATABASE CONFIGURATION
 * ----------------------
 * Promisified SQLite3 wrapper for async/await operations
 * Includes schema initialization and default data seeding
 */

const sqlite3 = require('sqlite3').verbose();
const util = require('util');
const path = require('path');
const uuid = require('uuid');

// Database file path from environment or default
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../timesheet.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH);

// Promisify database methods for async/await usage
db.runAsync = util.promisify(db.run.bind(db));
db.getAsync = util.promisify(db.get.bind(db));
db.allAsync = util.promisify(db.all.bind(db));
db.execAsync = util.promisify(db.exec.bind(db));

/**
 * Initialize database schema and seed default data
 * This runs once when the server starts
 */
async function initializeDatabase() {
    try {
        console.log('Initializing database schema...');
        
        // Create tables if they don't exist
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, 
                username TEXT UNIQUE, 
                password TEXT, 
                role TEXT, 
                department TEXT
            );
            
            CREATE TABLE IF NOT EXISTS job_codes (
                job_id TEXT PRIMARY KEY, 
                department TEXT, 
                job_code TEXT, 
                task_description TEXT, 
                is_active INTEGER DEFAULT 1, 
                UNIQUE(department, job_code)
            );
            
            CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY, 
                user_id TEXT, 
                department TEXT, 
                job_code TEXT, 
                task_description TEXT, 
                start_time INTEGER, 
                end_time INTEGER, 
                completed BOOLEAN DEFAULT 1, 
                date TEXT, 
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            
            CREATE TABLE IF NOT EXISTS departments (
                id TEXT PRIMARY KEY, 
                code TEXT UNIQUE, 
                name TEXT
            );
        `);

        console.log('Database schema created successfully');

        // Seed default departments if table is empty
        await seedDefaultDepartments();
        
        console.log('Database initialization complete');
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

/**
 * Seed default departments if the departments table is empty
 */
async function seedDefaultDepartments() {
    try {
        const result = await db.getAsync("SELECT COUNT(*) as count FROM departments");
        
        if (result.count === 0) {
            console.log('Seeding default departments...');
            
            const departments = [
                { code: 'ke_toan', name: 'Kế toán' },
                { code: 'kiem_toan_bc_tc', name: 'Kiểm toán BCTC' },
                { code: 'kiem_toan_xdcb', name: 'Kiểm toán XDCB' },
                { code: 'tham_dinh_gia_tv_thue', name: 'Thẩm định giá' },
                { code: 'khac', name: 'Khác' }
            ];

            const stmt = db.prepare("INSERT INTO departments (id, code, name) VALUES (?, ?, ?)");
            
            for (const dept of departments) {
                await new Promise((resolve, reject) => {
                    stmt.run([uuid.v4(), dept.code, dept.name], function(err) {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            
            stmt.finalize();
            console.log('Default departments seeded successfully');
        }
    } catch (error) {
        console.error('Error seeding departments:', error);
        throw error;
    }
}

/**
 * Gracefully close database connection
 */
async function closeDatabase() {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Export database instance and helper functions
module.exports = {
    db,
    initializeDatabase,
    closeDatabase
};