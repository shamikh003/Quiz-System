// 1. IMPORT PACKAGES
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const dns = require('dns');
require('dotenv').config();

// Force Node's own DNS resolver to use Google/Cloudflare DNS. Some local
// networks/ISPs fail to resolve MongoDB Atlas's SRV records even after the
// OS-level DNS is changed — this guarantees the app itself always asks a
// resolver that works, regardless of Windows network settings.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { Admin } = require('./models/models');
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const resultRoutes = require('./routes/results');
const settingsRoutes = require('./routes/settings');
const assignmentRoutes = require('./routes/assignments');
const dashboardRoutes = require('./routes/dashboard');

// 2. SETUP APP & MIDDLEWARE
const app = express();
const port = process.env.PORT || 5000;

// Render sits behind a proxy — this tells Express to trust its
// X-Forwarded-For header so rate limiting sees the real client IP.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// General rate limit for the whole API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Shared school IP: authenticated answer saves from a whole lab.
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
        // Unique indexes must exist before concurrent quiz starts are accepted.
        await Promise.all(Object.values(require('./models/models')).map(model => model.init()));
        await require('./services/sections').migrateSections();
        app.listen(port, () => console.log(`Backend server is live on http://localhost:${port}`));
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
app.use('/api', require('./routes/students'));
app.use('/api', require('./routes/attempts'));
app.use('/api', questionRoutes);
app.use('/api', resultRoutes);
app.use('/api', settingsRoutes);
app.use('/api', assignmentRoutes);
app.use('/api', dashboardRoutes);

app.get('/', (req, res) => {
    res.send('Quiz System backend is running.');
});

// Consistent JSON errors, without exposing internals.
app.use((err, req, res, next) => {
    console.error('Request failed:', err.message);
    res.status(err.name === 'CastError' || err.name === 'ValidationError' ? 400 : 500)
        .json({ error: err.name === 'CastError' ? 'Invalid record ID.' : 'Could not complete the request. Please try again.' });
});
