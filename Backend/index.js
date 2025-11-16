// 1. IMPORT PACKAGES
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // .env file se password load karega

// 2. SETUP APP & MIDDLEWARE
const app = express();
const port = process.env.PORT || 5000;
app.use(cors()); // CORS error ko fix karta hai
app.use(express.json()); // Server ko JSON parhna sikhaata hai

// 3. DATABASE CONNECTION
// process.env.MONGO_URI se password .env file se uthaye ga
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected... 🗄️'))
    .catch(err => console.log('MongoDB Connection Error:', err));

// 4. SCHEMAS (Database ke Blueprints)
const QuestionSchema = new mongoose.Schema({
    text: String,
    options: Array,
    correct: String,
});

const ResultSchema = new mongoose.Schema({
    name: String,
    rollNum: String,
    score: Number,
    total: Number,
    date: { type: Date, default: Date.now }
});

// Settings Schema (Timer ke liye)
const SettingsSchema = new mongoose.Schema({
    settings_id: { type: String, default: 'main' }, 
    time: Number
});

// 5. MODELS (Database se baat karne ke tools)
const Question = mongoose.model('Question', QuestionSchema);
const Result = mongoose.model('Result', ResultSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

// 6. API ROUTES (Aap ka "Menu")

// --- Question Routes (Teacher ke liye) ---
app.get('/api/questions', async (req, res) => {
    const questions = await Question.find();
    res.json(questions);
});

app.post('/api/questions', async (req, res) => {
    const newQuestion = new Question(req.body);
    await newQuestion.save();
    res.json(newQuestion);
});

app.delete('/api/questions', async (req, res) => {
    await Question.deleteMany({}); // Sab delete kar do
    res.send('All questions deleted.');
});

// --- Settings Route (Timer ke liye) ---
app.post('/api/settings', async (req, res) => {
    const newSettings = await Settings.findOneAndUpdate(
        { settings_id: 'main' }, 
        req.body, 
        { new: true, upsert: true } 
    );
    res.json(newSettings);
});

app.get('/api/settings', async (req, res) => {
    const settings = await Settings.findOne({ settings_id: 'main' });
    res.json(settings);
});

// --- Result Routes (Student/Teacher ke liye) ---
app.get('/api/results', async (req, res) => {
    const results = await Result.find().sort({ score: -1 }); // High score pehle
    res.json(results);
});

app.post('/api/results', async (req, res) => {
    const newResult = new Result(req.body);
    await newResult.save();
    res.json(newResult);
});

app.delete('/api/results', async (req, res) => {
    await Result.deleteMany({});
    res.send('All results deleted.');
});

// 7. START SERVER
app.listen(port, () => {
    console.log(`Backend server is live on http://localhost:${port} 🚀`);
});