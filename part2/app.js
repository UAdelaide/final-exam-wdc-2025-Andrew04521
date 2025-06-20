const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express(); // 一定要先定义 app，再使用 app.use！

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));

// Session 中间件（必须在 route 之前）
app.use(session({
  secret: 'dog-secret',
  resave: false,
  saveUninitialized: true
}));

// Routes
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);

// ✅ 登录用的 API
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const mysql = require('mysql2/promise');

  try {
    const pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '', // 根据你设置的 MySQL 密码修改
      database: 'DogWalkService'
    });

    const [rows] = await pool.query(
      'SELECT * FROM Users WHERE username = ? AND password_hash = ?',
      [username, password]
    );

    if (rows.length === 1) {
      req.session.user = {
        user_id: rows[0].user_id,
        username: rows[0].username,
        role: rows[0].role
      };
      res.json({ message: 'Login successful', role: rows[0].role });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Export app
module.exports = app;
