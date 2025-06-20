const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const PORT = 8080;

// Create MySQL pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Replace with your MySQL password if set
  database: 'DogWalkService',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Insert test data on startup
async function insertTestData() {
  try {
    const conn = await pool.getConnection();

    // Clear and reinsert data
    await conn.query(`DELETE FROM WalkRatings`);
    await conn.query(`DELETE FROM WalkApplications`);
    await conn.query(`DELETE FROM WalkRequests`);
    await conn.query(`DELETE FROM Dogs`);
    await conn.query(`DELETE FROM Users`);

    // Insert users
    await conn.query(`
      INSERT INTO Users (username, email, password_hash, role)
      VALUES
      ('alice123', 'alice@example.com', 'hashed123', 'owner'),
      ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
      ('carol123', 'carol@example.com', 'hashed789', 'owner'),
      ('newwalker', 'new@example.com', 'hashed999', 'walker'),
      ('eveowner', 'eve@example.com', 'hashed000', 'owner')
    `);

    // Insert dogs
    await conn.query(`
      INSERT INTO Dogs (owner_id, name, size)
      VALUES
      ((SELECT user_id FROM Users WHERE username='alice123'), 'Max', 'medium'),
      ((SELECT user_id FROM Users WHERE username='carol123'), 'Bella', 'small')
    `);

    // Insert walk requests
    await conn.query(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
      VALUES
      ((SELECT dog_id FROM Dogs WHERE name='Max' LIMIT 1), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name='Bella' LIMIT 1), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted')
    `);

    conn.release();
    console.log("Test data inserted.");
  } catch (err) {
    console.error("Error inserting test data:", err.message);
  }
}

insertTestData();

// /api/dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT Dogs.name AS dog_name, Dogs.size, Users.username AS owner_username
      FROM Dogs
      JOIN Users ON Dogs.owner_id = Users.user_id
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error in /api/dogs:", err.message);
    res.status(500).json({ error: "Failed to fetch dogs" });
  }
});

// /api/walkrequests/open
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT WalkRequests.request_id, Dogs.name AS dog_name, WalkRequests.requested_time,
             WalkRequests.duration_minutes, WalkRequests.location, Users.username AS owner_username
      FROM WalkRequests
      JOIN Dogs ON WalkRequests.dog_id = Dogs.dog_id
      JOIN Users ON Dogs.owner_id = Users.user_id
      WHERE WalkRequests.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error in /api/walkrequests/open:", err.message);
    res.status(500).json({ error: "Failed to fetch open walk requests" });
  }
});

// /api/walkers/summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.username AS walker_username,
        COUNT(r.rating_id) AS total_ratings,
        ROUND(AVG(r.rating), 1) AS average_rating,
        (
          SELECT COUNT(*)
          FROM WalkRequests wr
          JOIN WalkApplications wa ON wr.request_id = wa.request_id
          WHERE wa.walker_id = u.user_id AND wr.status = 'completed' AND wa.status = 'accepted'
        ) AS completed_walks
      FROM Users u
      LEFT JOIN WalkRatings r ON u.user_id = r.walker_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error in /api/walkers/summary:", err.message);
    res.status(500).json({ error: "Failed to fetch walker summary" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
