const mongoose = require('mongoose');

// --- Admin (Teacher login) ---
const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true }
});

// --- Question ---
const QuestionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    grade: { type: Number, required: true, enum: [4, 5, 6, 7] },
    options: {
        type: [{ id: String, text: String }],
        required: true,
        validate: v => Array.isArray(v) && v.length >= 3
    },
    correct: { type: String, required: true }, // e.g. 'A', 'B', 'C', 'D'
    createdAt: { type: Date, default: Date.now }
});

// --- Result ---
const ResultSchema = new mongoose.Schema({
    name: String,
    rollNum: String,
    grade: { type: Number, required: true, enum: [4, 5, 6, 7] },
    score: Number,
    total: Number,
    details: [
        {
            questionText: String,
            selected: String,
            correct: String,
            options: [{ id: String, text: String }]
        }
    ],
    date: { type: Date, default: Date.now }
});

// --- Settings (quiz timer) ---
const SettingsSchema = new mongoose.Schema({
    settings_id: { type: String, default: 'main' },
    time: { type: Number, default: 10 }
});

module.exports = {
    Admin: mongoose.model('Admin', AdminSchema),
    Question: mongoose.model('Question', QuestionSchema),
    Result: mongoose.model('Result', ResultSchema),
    Settings: mongoose.model('Settings', SettingsSchema)
};
