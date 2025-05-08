const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// Ensure upload directory exists
const uploadDir = 'studyflow/uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

// Log all incoming requests middleware
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'studyflow/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Upload route to handle file and link uploads
app.post('/upload', upload.single('file'), (req, res) => {
  console.log('Upload route hit');
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);
  try {
    if (req.file) {
      // File upload
      const newMaterial = {
        id: materials.length + 1,
        title: req.file.originalname,
        type: path.extname(req.file.originalname).substring(1).toUpperCase(),
        dateAdded: new Date().toISOString().split('T')[0],
        size: (req.file.size / (1024 * 1024)).toFixed(2) + ' MB',
        url: `/uploads/${req.file.filename}`
      };
      materials.push(newMaterial);
      res.status(201).json({ message: 'File uploaded successfully', material: newMaterial });
    } else if (req.body.link) {
      // Link upload
      const newMaterial = {
        id: materials.length + 1,
        title: req.body.link,
        type: 'LINK',
        dateAdded: new Date().toISOString().split('T')[0],
        size: '-',
        url: req.body.link
      };
      materials.push(newMaterial);
      res.status(201).json({ message: 'Link submitted successfully', material: newMaterial });
    } else {
      res.status(400).json({ message: 'No file or link provided' });
    }
  } catch (err) {
    console.error('Upload error:', err);
    console.error(err.stack);
    res.status(500).json({ message: 'Upload error', error: err.message });
  }
});


// Serve frontend static files
app.use(express.static(path.join(__dirname, '../studyflow/public')));

// Serve uploads folder statically
app.use('/uploads', express.static(path.join(__dirname, '../studyflow/uploads')));

// In-memory user store
const users = [];

// In-memory materials store
const materials = [];


// On server start, load existing files from uploads folder to populate materials array
const loadMaterialsFromUploads = () => {
  const uploadPath = path.join(__dirname, '../studyflow/uploads');
  if (!fs.existsSync(uploadPath)) {
    console.log('Uploads folder does not exist');
    return;
  }
  const files = fs.readdirSync(uploadPath);
  files.forEach((file, index) => {
    const filePath = path.join(uploadPath, file);
    const stats = fs.statSync(filePath);
    const ext = path.extname(file).substring(1).toUpperCase();
    const material = {
      id: index + 1,
      title: file,
      type: ext || 'FILE',
      dateAdded: stats.birthtime.toISOString().split('T')[0],
      size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
      url: `/uploads/${file}`
    };
    materials.push(material);
  });
  console.log(`Loaded ${materials.length} materials from uploads folder`);
};

loadMaterialsFromUploads();

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

// Route to get all materials
app.get('/materials', (req, res) => {
  res.json(materials);
});

// Route to delete a material by id
app.delete('/materials/:id', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`DELETE request received for material id: ${id}`);
  const index = materials.findIndex(m => m.id === id);
  if (index === -1) {
    console.log('Material not found for deletion');
    return res.status(404).json({ message: 'Material not found' });
  }
  const material = materials[index];
  // Remove material from array
  materials.splice(index, 1);
  console.log(`Material with id ${id} removed from materials array`);

  // If material is a file (not a link), delete the file from uploads folder
  if (material.type !== 'LINK' && material.url) {
    const filePath = path.join(__dirname, '../studyflow', material.url);
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
        // Continue even if file deletion fails
      } else {
        console.log(`File ${filePath} deleted successfully`);
      }
    });
  }

  res.json({ message: 'Material deleted successfully' });
});

// Catch-all 404 handler for unknown API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/upload') || req.path.startsWith('/materials') || req.path.startsWith('/signin') || req.path.startsWith('/login') || req.path.startsWith('/progress')) {
    return res.status(404).json({ message: 'API route not found' });
  }
  next();
});

// Error handling middleware for multer and other errors
app.use((err, req, res, next) => {
  console.error('Error middleware caught:', err);
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    return res.status(400).json({ message: 'Multer error', error: err.message });
  }
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
