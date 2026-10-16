const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    owner: { type: String, required: true, index: true },
    kind: { type: String, enum: ['questions', 'students'], required: true },
    filename: String,
    status: { type: String, enum: ['preview', 'queued', 'importing', 'completed', 'failed'], default: 'preview' },
    rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Passwords never appear in previews. Uncommitted values are encrypted at rest.
    secrets: { type: String, select: false },
    selected: [Number], warnings: [String], revision: { type: Number, default: 0 },
    lease: String, leaseUntil: Date, error: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 3600000) }
}, { minimize: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('ImportBatch', schema);
