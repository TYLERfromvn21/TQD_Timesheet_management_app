/**
 * VALIDATION UTILITIES
 * --------------------
 * Common validation functions for request data
 * Used by controllers to ensure data integrity
 */

/**
 * Validate user registration/update data
 * @param {Object} data - User data to validate
 * @returns {Object} - {valid: boolean, errors: string[]}
 */
function validateUser(data) {
    const errors = [];
    
    if (!data.username || data.username.trim() === '') {
        errors.push('Tên đăng nhập là bắt buộc');
    } else if (data.username.length < 3) {
        errors.push('Tên đăng nhập phải có ít nhất 3 ký tự');
    } else if (data.username.length > 50) {
        errors.push('Tên đăng nhập không được quá 50 ký tự');
    }
    
    if (data.password && data.password.length < 6) {
        errors.push('Mật khẩu phải có ít nhất 6 ký tự');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate job code creation data
 * @param {Object} data - Job code data to validate
 * @returns {Object} - {valid: boolean, errors: string[]}
 */
function validateJobCode(data) {
    const errors = [];
    
    if (!data.department || data.department.trim() === '') {
        errors.push('Phòng ban là bắt buộc');
    }
    
    if (!data.job_code || data.job_code.trim() === '') {
        errors.push('Mã Job là bắt buộc');
    } else if (data.job_code.length > 20) {
        errors.push('Mã Job không được quá 20 ký tự');
    }
    
    if (!data.task_description || data.task_description.trim() === '') {
        errors.push('Nội dung công việc là bắt buộc');
    } else if (data.task_description.length > 500) {
        errors.push('Nội dung công việc không được quá 500 ký tự');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate task creation/update data
 * @param {Object} data - Task data to validate
 * @returns {Object} - {valid: boolean, errors: string[]}
 */
function validateTask(data) {
    const errors = [];
    
    if (!data.department || data.department.trim() === '') {
        errors.push('Phòng ban là bắt buộc');
    }
    
    if (!data.job_code || data.job_code.trim() === '') {
        errors.push('Mã Job là bắt buộc');
    }
    
    if (!data.start_time) {
        errors.push('Thời gian bắt đầu là bắt buộc');
    }
    
    if (!data.end_time) {
        errors.push('Thời gian kết thúc là bắt buộc');
    }
    
    if (!data.date || data.date.trim() === '') {
        errors.push('Ngày là bắt buộc');
    } else {
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(data.date)) {
            errors.push('Ngày không đúng định dạng (YYYY-MM-DD)');
        }
    }
    
    // Check if end time is after start time
    if (data.start_time && data.end_time) {
        const start = parseInt(data.start_time);
        const end = parseInt(data.end_time);
        
        if (isNaN(start) || isNaN(end)) {
            errors.push('Thời gian không hợp lệ');
        } else if (end <= start) {
            errors.push('Giờ kết thúc phải lớn hơn giờ bắt đầu');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate department creation data
 * @param {Object} data - Department data to validate
 * @returns {Object} - {valid: boolean, errors: string[]}
 */
function validateDepartment(data) {
    const errors = [];
    
    if (!data.name || data.name.trim() === '') {
        errors.push('Tên phòng ban là bắt buộc');
    } else if (data.name.length < 2) {
        errors.push('Tên phòng ban phải có ít nhất 2 ký tự');
    } else if (data.name.length > 100) {
        errors.push('Tên phòng ban không được quá 100 ký tự');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate report request parameters
 * @param {Object} query - Query parameters
 * @returns {Object} - {valid: boolean, errors: string[]}
 */
function validateReportParams(query) {
    const errors = [];
    
    // Validate month
    if (!query.month) {
        errors.push('Tháng là bắt buộc');
    } else {
        const month = parseInt(query.month);
        if (isNaN(month) || month < 1 || month > 12) {
            errors.push('Tháng không hợp lệ (1-12)');
        }
    }
    
    // Validate year
    if (!query.year) {
        errors.push('Năm là bắt buộc');
    } else {
        const year = parseInt(query.year);
        if (isNaN(year) || year < 2000 || year > 2100) {
            errors.push('Năm không hợp lệ');
        }
    }
    
    // For user reports, validate userId
    if (query.userId && query.userId.trim() === '') {
        errors.push('ID người dùng không được để trống');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Sanitize string input
 * @param {string} input - String to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, ''); // Basic XSS prevention
}

/**
 * Validate email format (if needed in future)
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

module.exports = {
    validateUser,
    validateJobCode,
    validateTask,
    validateDepartment,
    validateReportParams,
    sanitizeString,
    isValidEmail
};