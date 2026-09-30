// Marks always come first. Time only breaks equal marks percentages.
function resultMetrics(result) {
    const percentage = result.total > 0 ? Math.max(0, Math.min(100, result.score / result.total * 100)) : 0;
    const timingKnown = Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0 &&
        Number.isFinite(result.timeLimitMs) && result.timeLimitMs > 0;
    const elapsedMs = timingKnown ? Math.min(result.elapsedMs, result.timeLimitMs) : null;
    return { percentage, rankingPercentage: percentage, speedBonus: 0, timingKnown,
        elapsedMs, timeLimitMs: timingKnown ? result.timeLimitMs : null };
}

// Both teacher views use this exact ordering, before filtering/limiting the output.
function rankingStages() {
    return [
        { $match: { total: { $gt: 0 }, score: { $gte: 0 }, $expr: { $lte: ['$score', '$total'] } } },
        { $addFields: { percentage: { $multiply: [{ $divide: ['$score', '$total'] }, 100] } } },
        { $addFields: {
            rankingPercentage: '$percentage',
            speedBonus: { $literal: 0 },
            timingKnown: { $and: [{ $isNumber: '$elapsedMs' }, { $gte: ['$elapsedMs', 0] }, { $gt: ['$timeLimitMs', 0] }] },
            _elapsedSort: { $ifNull: ['$elapsedMs', Number.MAX_SAFE_INTEGER] }
        } },
        { $sort: { percentage: -1, _elapsedSort: 1, date: 1, _id: 1 } },
        { $project: { details: 0, _elapsedSort: 0 } }
    ];
}
module.exports = { resultMetrics, rankingStages };
