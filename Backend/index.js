// 1. IMPORT PACKAGES
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { Admin } = require('./models/models');
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const resultRoutes = require('./routes/results');
const settingsRoutes = require('./routes/settings');
const assignmentRoutes = require('./routes/assignments');

// 2. SETUP APP & MIDDLEWARE
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// General rate limit for the whole API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', apiLimiter);

// Stricter limit on login attempts to slow down brute-forcing the admin password
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/auth/login', loginLimiter);

// 3. DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB Connected... 🗄️');
        await seedAdminIfNeeded();
    })
    .catch(err => console.log('MongoDB Connection Error:', err));

// Creates a default admin account on first run so there's always a way to log in.
async function seedAdminIfNeeded() {
    const existing = await Admin.findOne({});
    if (existing) return;

    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'changeme123';
    const passwordHash = await bcrypt.hash(password, 10);

    await Admin.create({ username, passwordHash });
    console.log(`No admin found — created default admin account "${username}". Please log in and consider changing this password.`);
}

// 4. ROUTES
app.use('/api/auth', authRoutes);
app.use('/api', questionRoutes);
app.use('/api', resultRoutes);
app.use('/api', settingsRoutes);
app.use('/api', assignmentRoutes);

app.get('/', (req, res) => {
    res.send('Quiz System backend is running.');
});

// 5. START SERVER
app.listen(port, () => {
    console.log(`Backend server is live on http://localhost:${port} 🚀`);
});
