const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();

app.use(cors());
app.use(express.json());

// In-memory user store
const users = [];

// JWT secret key
const JWT_SECRET = 'your_jwt_secret_key';

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Route to get study progress (dummy response) - protected
app.get('/progress', authenticateToken, (req, res) => {
  res.json({
    user: req.user.username,
    studyProgress: {
      webDev: 50,
      dataStructures: 30
    },
    recentAchievements: {
      quickLearner: 'Completed 5 modules quickly',
      focusMaster: 'Studied 3 hours straight'
    }
  });
});

// Sign-in route (register new user)
app.post('/signin', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Missing username, email or password' });
    }
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      return res.status(409).json({ message: 'Username or email already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = { username, email, passwordHash };
    users.push(newUser);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing email or password' });
    }
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    // Generate JWT token
    const token = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: 'Login successful', username: user.username, token });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Start server
app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
