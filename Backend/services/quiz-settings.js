const { validGrade } = require('../grades');

function quizMinutes(value) {
    const time = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
    if (!Number.isInteger(time) || time < 1 || time > 1440) throw Object.assign(new Error('Quiz time must be a whole number from 1 to 1440 minutes.'), { status: 400 });
    return time;
}

function quizTime(settings, grade) {
    const times = settings?.gradeTimes;
    const value = times instanceof Map ? times.get(String(grade)) : times?.[String(grade)];
    return value ?? settings?.time ?? 10;
}

async function saveGradeTime(Settings, grade, time) {
    if (!validGrade(grade)) throw Object.assign(new Error('Choose Grade 4, 5, 6, 7 or Hifz.'), { status: 400 });
    return Settings.findOneAndUpdate({ settings_id: 'main' },
        { $set: { [`gradeTimes.${Number(grade)}`]: quizMinutes(time) } }, { upsert: true, new: true });
}

module.exports = { quizMinutes, quizTime, saveGradeTime };
