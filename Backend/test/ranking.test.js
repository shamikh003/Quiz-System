const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resultMetrics } = require('../result-ranking');

test('speed never changes marks percentage', () => {
    const result = resultMetrics({ score: 8, total: 10, elapsedMs: 300000, timeLimitMs: 600000 });
    assert.equal(result.percentage, 80);
    assert.equal(result.speedBonus, 0);
    assert.equal(result.rankingPercentage, 80);
    assert.equal(resultMetrics({ score: 8, total: 10, elapsedMs: 120000, timeLimitMs: 600000 }).rankingPercentage, 80);
    assert.equal(resultMetrics({ score: 8, total: 10, elapsedMs: 600000, timeLimitMs: 1200000 }).rankingPercentage, 80);
});
test('missing timing gets no invented speed bonus; timeout and zero marks get none', () => {
    const old = resultMetrics({ score: 17, total: 24 });
    assert.equal(old.elapsedMs, null); assert.equal(old.timingKnown, false);
    assert.equal(old.speedBonus, 0); assert.equal(old.rankingPercentage, old.percentage);
    assert.equal(resultMetrics({ score: 10, total: 10, elapsedMs: 999999, timeLimitMs: 600000 }).rankingPercentage, 100);
    assert.equal(resultMetrics({ score: 0, total: 10, elapsedMs: 1, timeLimitMs: 600000 }).rankingPercentage, 0);
});
