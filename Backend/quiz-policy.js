function pakistanDay(now = new Date()) {
    return new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function validateAnswers(questions, answers) {
    if (!Array.isArray(answers) || answers.length > questions.length) throw new Error('Invalid answers.');
    const keys = new Map(questions.map(q => [String(q.questionId), q]));
    const seen = new Set();
    return answers.map(answer => {
        const id = String(answer?.questionId);
        const question = keys.get(id);
        if (!question || seen.has(id) || !question.options.includes(answer.selected)) throw new Error('Invalid or duplicate answer.');
        seen.add(id);
        return { questionId: id, selected: answer.selected };
    });
}
function gradeAttempt(attempt) {
    const selected = new Map(attempt.answers.map(a => [String(a.questionId), a.selected]));
    return {
        score: attempt.questions.filter(q => selected.get(String(q.questionId)) === q.correct).length,
        total: attempt.questions.length
    };
}
module.exports = { pakistanDay, validateAnswers, gradeAttempt };
