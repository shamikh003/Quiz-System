// ============================================================
// ONE-TIME SCRIPT — change the admin username/password
// Usage:
//   node change-admin.js <new-username> <new-password>
// Example:
//   node change-admin.js admin MyNewSecurePass123
// ============================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { Admin } = require('./models/models');

async function main() {
    const [, , newUsername, newPassword] = process.argv;

    if (!newUsername || !newPassword) {
        console.log('❌ Usage: node change-admin.js <new-username> <new-password>');
        process.exit(1);
    }

    if (newPassword.length < 6) {
        console.log('❌ Password should be at least 6 characters.');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update the existing admin (there should only be one), or create one if none exists.
        const existing = await Admin.findOne({});

        if (existing) {
            existing.username = newUsername;
            existing.passwordHash = passwordHash;
            await existing.save();
            console.log(`✅ Admin credentials updated.`);
        } else {
            await Admin.create({ username: newUsername, passwordHash });
            console.log(`✅ New admin created.`);
        }

        console.log(`   Username: ${newUsername}`);
        console.log(`   Password: ${newPassword}`);
        console.log('\nYou can now log in with these new credentials.');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error updating admin:', err);
        process.exit(1);
    }
}

main();
