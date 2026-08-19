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
    tabSwitchCount: { type: Number, default: 0 },
    fullscreenExitCount: { type: Number, default: 0 },
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

// --- Assignment (teacher-uploaded Word/Excel/PowerPoint file) ---
const AssignmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    grade: { type: Number, required: true, enum: [4, 5, 6, 7] },
    maxMarks: { type: Number, required: true, default: 100 },
    fileName: { type: String, required: true },   // original file name shown to users
    filePath: { type: String, required: true },   // name on disk inside uploads/assignments
    createdAt: { type: Date, default: Date.now }
});

// --- Submission (student's completed file for an Assignment) ---
const SubmissionSchema = new mongoose.Schema({
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    name: { type: String, required: true },
    rollNum: { type: String, required: true },
    grade: { type: Number, required: true, enum: [4, 5, 6, 7] },
    fileName: { type: String, required: true },   // original file name
    filePath: { type: String, required: true },   // name on disk inside uploads/submissions
    marks: { type: Number, default: null },
    percentage: { type: Number, default: null },
    status: { type: String, enum: ['pending', 'graded'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    gradedAt: { type: Date, default: null }
});
// A student can only submit a given assignment once (one-time submit rule).
SubmissionSchema.index({ assignment: 1, rollNum: 1 }, { unique: true });

module.exports = {
    Admin: mongoose.model('Admin', AdminSchema),
    Question: mongoose.model('Question', QuestionSchema),
    Result: mongoose.model('Result', ResultSchema),
    Settings: mongoose.model('Settings', SettingsSchema),
    Assignment: mongoose.model('Assignment', AssignmentSchema),
    Submission: mongoose.model('Submission', SubmissionSchema)
};
