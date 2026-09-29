const { test } = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../../frontend/admin/report-utils');
test('combined grade, section and roll filters export exactly the visible rows', () => {
    const rows = [{ name: 'Ali', rollNum: '01', grade: 0, section: 'Section A', score: 2, total: 3 },
        { name: 'Sara', rollNum: '01', grade: 0, section: 'Section B' },
        { name: 'Other', rollNum: '02', grade: 0, section: 'Section A' },
        { name: 'Older', rollNum: '01', grade: 4, section: 'Section A' }];
    const filtered = utils.filterRows(rows, { grade: '0', section: ' section a ', roll: '01' });
    assert.equal(filtered.length, 1);
    const csv = utils.resultCsv(filtered);
    assert.ok(csv.includes('"Ali","01","Hifz","Section A","2","3"'));
    assert.ok(!csv.includes('Sara')); assert.equal(csv.split('\r\n').length, 2);
    assert.deepEqual(utils.sections([{ grade: 0 }, ...rows], '0'), ['Section A', 'Section B', 'Unassigned']);
});
test('CSV preserves Urdu, quotes, commas and neutralizes formulas', () => {
    const csv = utils.studentCsv([{ name: 'علی, "طالب"', rollNum: '=1+1', grade: 0 }]);
    assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('علی, ""طالب""'));
    assert.ok(csv.includes("\"'=1+1\"")); assert.ok(csv.includes('"Unassigned"'));
});
