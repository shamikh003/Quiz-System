const mongoose = require('mongoose');
const { VALID_GRADES } = require('../grades');
const { sectionName, sectionKey } = require('../sections');
const sectionFields = {
    section: { type: String, trim: true, maxlength: 80, default: 'Unassigned' },
    sectionKey: { type: String, default: 'unassigned' }
};
function normalizeSection(next) {
    try { this.section = sectionName(this.section); this.sectionKey = sectionKey(this.section); next(); }
    catch (error) { next(error); }
}

// --- Admin (Teacher login) ---
const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true }
});

// --- Question ---
const QuestionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    grade: { type: Number, required: true, enum: VALID_GRADES },
    options: {
        type: [{ id: String, text: String }],
        required: true,
        validate: v => Array.isArray(v) && v.length >= 3
    },
    correct: { type: String, required: true }, // e.g. 'A', 'B', 'C', 'D'
    imageUrl: { type: String, default: null },
    imagePath: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

// --- Result ---
const ResultSchema = new mongoose.Schema({
    ...sectionFields,
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt' },
    completedAt: Date,
    elapsedMs: Number,
    timeLimitMs: Number,
    rankingPercentage: Number,
    speedBonus: Number,
    rankingVersion: Number,
    name: String,
    rollNum: String,
    grade: { type: Number, required: true, enum: VALID_GRADES },
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
ResultSchema.pre('validate', normalizeSection);
ResultSchema.index({ attempt: 1 }, { unique: true, sparse: true });
ResultSchema.index({ rollNum: 1, grade: 1, date: -1 });

// --- Settings (quiz timer) ---
const SettingsSchema = new mongoose.Schema({
    settings_id: { type: String, default: 'main' },
    time: { type: Number, default: 10 }
});

// --- Assignment (teacher-uploaded Word/Excel/PowerPoint file) ---
const AssignmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    grade: { type: Number, required: true, enum: VALID_GRADES },
    maxMarks: { type: Number, required: true, default: 100 },
    fileName: { type: String, required: true },   // original file name shown to users
    fileUrl: { type: String, required: function () { return !this.deletedAt; } },
    filePath: { type: String, required: function () { return !this.deletedAt; } },
    // Keep compact assignment metadata for earned-mark history after file deletion.
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

// --- Submission (student's completed file for an Assignment) ---
const SubmissionSchema = new mongoose.Schema({
    ...sectionFields,
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    name: { type: String, required: true },
    rollNum: { type: String, required: true },
    grade: { type: Number, required: true, enum: VALID_GRADES },
    fileName: { type: String, required: true },   // original file name
    fileUrl: { type: String, required: function () { return !this.assignmentDeletedAt; } },
    filePath: { type: String, required: function () { return !this.assignmentDeletedAt; } },
    assignmentDeletedAt: { type: Date, default: null },
    marks: { type: Number, default: null },
    percentage: { type: Number, default: null },
    status: { type: String, enum: ['pending', 'graded'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    gradedAt: { type: Date, default: null }
});
// A student can only submit a given assignment once (one-time submit rule).
SubmissionSchema.pre('validate', normalizeSection);
SubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true, partialFilterExpression: { student: { $type: 'objectId' } } });

const StudentSchema = new mongoose.Schema({
    ...sectionFields,
    name: { type: String, required: true, maxlength: 100 },
    rollNum: { type: String, required: true, maxlength: 40 },
    grade: { type: Number, required: true, enum: VALID_GRADES },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
StudentSchema.pre('validate', normalizeSection);
StudentSchema.index({ rollNum: 1, grade: 1, sectionKey: 1 }, { unique: true });

// Compact question keys freeze marking even when the teacher edits the bank.
// No repeated question text/options and no embedded subdocument IDs.
const AttemptSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    day: { type: String, required: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'submitted'], default: 'active' },
    // Temporary attempt keys expire; permanent scores remain in Result.
    purgeAt: Date,
    reportDeleted: { type: Boolean, default: false },
    questions: [{ _id: false, questionId: mongoose.Schema.Types.ObjectId, correct: String, options: [String] }],
    answers: [{ _id: false, questionId: mongoose.Schema.Types.ObjectId, selected: String }],
    revision: { type: Number, default: 0 },
    tabSwitchCount: { type: Number, default: 0 },
    fullscreenExitCount: { type: Number, default: 0 }
});
AttemptSchema.index({ student: 1, day: 1 }, { unique: true });
AttemptSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = {
    Student: mongoose.model('Student', StudentSchema),
    Attempt: mongoose.model('Attempt', AttemptSchema),
    Admin: mongoose.model('Admin', AdminSchema),
    Question: mongoose.model('Question', QuestionSchema),
    Result: mongoose.model('Result', ResultSchema),
    Settings: mongoose.model('Settings', SettingsSchema),
    Assignment: mongoose.model('Assignment', AssignmentSchema),
    Submission: mongoose.model('Submission', SubmissionSchema)
};
