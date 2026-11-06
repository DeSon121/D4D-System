// ==================== ENVIRONMENT & CONFIGURATION ====================
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config(); // MUST be loaded before accessing process.env

const db = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Secure JWT Secret Check (Fails safely if missing in environment)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

// ==================== AUTHENTICATION MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user; // Contains { id, email, role }
    next();
  });
};

// ==================== ROLE AUTHORIZATION MIDDLEWARE ====================
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
};

// 1. Health Check
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await db.query('SELECT NOW()');
    res.json({
      status: 'ok',
      message: 'Server and Database connected successfully',
      dbTime: dbResult.rows[0].now,
    });
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 2. Get Tickets (Role-Aware & Whitelisted Roles)
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role;

    // Explicitly validate supported roles
    if (!['admin', 'technician', 'user'].includes(role)) {
      return res.status(403).json({ error: 'Invalid user role permissions.' });
    }

    let query;
    let values = [];

    if (role === 'user') {
      // Submitter can only view their own created tickets
      query = `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.created_at,
               c.name AS category_name,
               u.name AS created_by_name
        FROM tickets t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.created_by = $1
        ORDER BY t.created_at DESC
      `;
      values = [req.user.id];
    } else {
      // Technicians and Admins can view all tickets
      query = `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.created_at,
               c.name AS category_name,
               u.name AS created_by_name
        FROM tickets t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.created_by = u.id
        ORDER BY t.created_at DESC
      `;
    }

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tickets:', err.message);
    res.status(500).json({ error: 'Server error fetching tickets' });
  }
});

// 3. Get All Categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err.message);
    res.status(500).json({ error: 'Server error fetching categories' });
  }
});

// 4. Create a New Ticket (Protected - Uses Authenticated User ID)
app.post('/api/tickets', authenticateToken, async (req, res) => {
  const { title, description, priority, category_id } = req.body;
  const created_by = req.user.id; // Securely extracted from verified JWT token!

  try {
    const query = `
      INSERT INTO tickets (title, description, priority, category_id, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      title,
      description,
      priority || 'medium',
      category_id ? parseInt(category_id, 10) : null,
      created_by
    ];
    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating ticket:', err.message);
    res.status(500).json({ error: 'Server error creating ticket' });
  }
});

// 5. Update Ticket Status or Priority (Technician & Admin Only + Input Validation)
app.patch('/api/tickets/:id', authenticateToken, authorizeRoles('technician', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { status, priority } = req.body;

  // Validation: Reject requests containing neither field
  if (!status && !priority) {
    return res.status(400).json({ error: 'Request body must contain at least "status" or "priority" to update.' });
  }

  // Validation: Check status if provided
  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed values are: ${validStatuses.join(', ')}` });
  }

  // Validation: Check priority if provided
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: `Invalid priority. Allowed values are: ${validPriorities.join(', ')}` });
  }

  try {
    const query = `
      UPDATE tickets
      SET status = COALESCE($1, status),
          priority = COALESCE($2, priority),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query(query, [status, priority, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating ticket:', err.message);
    res.status(500).json({ error: 'Server error updating ticket' });
  }
});

// 6. Delete a Ticket (Admin Only)
app.delete('/api/tickets/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ message: 'Ticket deleted successfully', ticket: result.rows[0] });
  } catch (err) {
    console.error('Error deleting ticket:', err.message);
    res.status(500).json({ error: 'Server error deleting ticket' });
  }
});

// ==================== AUTHENTICATION ROUTES ====================

// Register a New User (Public - Restricts Role Assignment)
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email, and password' });
  }

  try {
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Bcrypt Password Hashing
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Enforce strict default role for public registrations ('user' / Submitter)
    const assignedRole = 'user';

    const query = `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
    `;
    const result = await db.query(query, [name, email, passwordHash, assignedRole]);

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Error registering user:', err.message);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Bcrypt Password Comparison
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // JWT Token Generation
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Error logging in:', err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});