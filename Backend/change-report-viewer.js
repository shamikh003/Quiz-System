const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { Admin } = require('./models/models');

async function main() {
    const [, , username, password, ...nameParts] = process.argv;
    const displayName = nameParts.join(' ').trim() || 'Report Viewer';
    if (!username || !password || password.length < 6 || Buffer.byteLength(password) > 72) {
        console.log('Usage: node change-report-viewer.js <username> <password> [display name]');
        console.log('Password must contain 6–72 bytes.');
        process.exit(1);
    }
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const duplicate = await Admin.findOne({ username, role: { $ne: 'viewer' } });
        if (duplicate) throw new Error('That username belongs to the teacher account. Choose another username.');
        const passwordHash = await bcrypt.hash(password, 10);
        await Admin.findOneAndUpdate({ role: 'viewer' }, { $set: { username, passwordHash, displayName, active: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        console.log(`Report viewer account saved for ${displayName} (${username}).`);
        process.exit(0);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
main();
