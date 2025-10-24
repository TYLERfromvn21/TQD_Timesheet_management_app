// app.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const uuid = require('uuid');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// Cấu hình body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session (lưu session trên memory - cho dev/demo)
app.use(session({
  secret: 'replace_this_with_a_strong_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 giờ
}));

// Init DB (file timesheet.db trong cùng thư mục)
const db = new sqlite3.Database('timesheet.db', (err) => {
  if (err) console.error(err);
  else console.log('Connected to DB');
});

// Tạo bảng users nếu chưa có
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT  -- 'admin' cho giám đốc, 'user' cho nhân viên
  )
`);

// Middleware bảo vệ route admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.redirect('/?error=access_denied');
}

// Luôn trả về index.html làm trang mặc định
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Đăng nhập (từ index hoặc admin form)
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.redirect('/?error=missing');
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.redirect('/?error=db');
    if (!user) return res.redirect('/?error=invalid');
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.redirect('/?error=invalid');
    // Lưu session
    req.session.user = { id: user.id, username: user.username, role: user.role };
    // Nếu admin, redirect đến admin dashboard, khác thì dashboard user
    if (user.role === 'admin') return res.redirect('/admin-dashboard');
    return res.redirect('/dashboard');
  });
});

// Simple dashboard route
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/?error=not_logged_in');
  res.send(`Xin chào ${req.session.user.username} (${req.session.user.role}). <a href="/logout">Đăng xuất</a>`);
});

// Admin dashboard
app.get('/admin-dashboard', requireAdmin, (req, res) => {
  res.send(`Trang admin - Xin chào ${req.session.user.username}. <a href="/admin">Quản trị</a> | <a href="/logout">Đăng xuất</a>`);
});

// GET /admin: nếu chưa có admin nào -> cho tạo admin (trả về admin.html).
// Nếu đã có admin -> bắt phải là admin (session) mới truy cập.
app.get('/admin', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"', (err, row) => {
    if (err) return res.status(500).send('DB error');
    if (row.count === 0) {
      // Cho phép tạo admin đầu tiên (mở trang admin.html)
      return res.sendFile(path.join(__dirname, 'public/admin.html'));
    }
    // Nếu đã có admin, chỉ cho truy cập nếu session là admin
    if (req.session.user && req.session.user.role === 'admin') {
      return res.sendFile(path.join(__dirname, 'public/admin.html'));
    }
    return res.redirect('/?error=access_denied');
  });
});

// POST tạo tài khoản (từ admin.html)
// body: { username, password, type } - type = 'admin' or 'user'
app.post('/create-account', async (req, res) => {
  const { username, password, type } = req.body;
  if (!username || !password || !type) return res.status(400).send('Missing fields');

  // Nếu tạo admin và đã có admin, chỉ admin hiện tại mới được tạo
  db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"', async (err, row) => {
    if (err) return res.status(500).send('DB error');

    const wantsAdmin = (type === 'admin');
    if (row.count > 0 && wantsAdmin) {
      // Đã có admin rồi -> chỉ admin mới tạo admin
      if (!(req.session.user && req.session.user.role === 'admin')) {
        return res.status(403).send('Chỉ admin tổng mới được tạo admin mới');
      }
    }

    // Nếu không có admin (row.count === 0) thì cho phép tạo admin đầu tiên
    try {
      const hashed = await bcrypt.hash(password, 10);
      const id = uuid.v4();
      const role = wantsAdmin ? 'admin' : 'user';
      db.run('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)', [id, username, hashed, role], (err) => {
        if (err) {
          if (err.message && err.message.includes('UNIQUE constraint')) {
            return res.status(400).send('Username đã tồn tại');
          }
          return res.status(500).send('DB insert error');
        }
        // Nếu tạo admin đầu tiên, tự login luôn
        if (role === 'admin') {
          req.session.user = { id, username, role };
        }
        return res.send(`Tạo thành công! ID của bạn: ${id}`);
      });
    } catch (e) {
      return res.status(500).send('Hash error');
    }
  });
});

// Route tạo user (admin tạo user) — cũng có thể dùng /create-account với type='user'
// Thêm route optional để admin xem danh sách users
app.get('/users', requireAdmin, (req, res) => {
  db.all('SELECT id, username, role FROM users', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.json(rows);
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
