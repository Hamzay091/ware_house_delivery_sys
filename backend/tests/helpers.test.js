const test = require('node:test');
const assert = require('node:assert/strict');

const { escapeRegex, searchRegex, paginate, sortSpec, pageMeta, sortLink } = require('../utils/query');
const { toCsv } = require('../utils/csv');

test('escapeRegex neutralises regex metacharacters', () => {
    assert.equal(escapeRegex('a.b*c'), 'a\\.b\\*c');
    // A search for ".*" must match that literal text, not everything.
    assert.ok(!new RegExp(escapeRegex('.*')).test('anything'));
    assert.ok(new RegExp(escapeRegex('.*')).test('x.*y'));
});

test('searchRegex ignores blank input', () => {
    assert.equal(searchRegex(''), null);
    assert.equal(searchRegex('   '), null);
    assert.equal(searchRegex(undefined), null);
    assert.ok(searchRegex('kraken').test('RZR-KRAKEN-V3'));
});

test('paginate clamps page and limit', () => {
    assert.deepEqual(paginate({}), { page: 1, limit: 20, skip: 0 });
    assert.deepEqual(paginate({ page: '3', limit: '10' }), { page: 3, limit: 10, skip: 20 });
    // Hostile input must not produce a negative skip or an unbounded limit.
    assert.deepEqual(paginate({ page: '-5' }), { page: 1, limit: 20, skip: 0 });
    assert.equal(paginate({ limit: '99999' }).limit, 100);
    assert.equal(paginate({ limit: '0' }).limit, 20);
    assert.deepEqual(paginate({ page: 'abc' }), { page: 1, limit: 20, skip: 0 });
});

test('sortSpec only honours whitelisted fields', () => {
    const allowed = ['name', 'price'];
    assert.deepEqual(sortSpec({ sort: 'price', dir: 'asc' }, allowed, 'name').spec, { price: 1 });
    // An unknown field falls back rather than sorting on arbitrary input.
    assert.deepEqual(sortSpec({ sort: 'secret', dir: 'asc' }, allowed, 'name').spec, { name: 1 });
    assert.deepEqual(sortSpec({ sort: 'name' }, allowed, 'name').spec, { name: -1 });
});

test('pageMeta computes page counts and preserves filters', () => {
    const meta = pageMeta({ page: 2, limit: 20 }, 45, { search: 'abc', page: '2', empty: '' });
    assert.equal(meta.pages, 3);
    assert.equal(meta.total, 45);
    assert.equal(meta.baseQuery, 'search=abc');
});

test('pageMeta reports at least one page when there is nothing to show', () => {
    assert.equal(pageMeta({ page: 1, limit: 20 }, 0, {}).pages, 1);
});

test('sortLink flips direction on the active column', () => {
    assert.equal(sortLink({ search: 'x' }, 'name', 'name', 'asc'), '?search=x&sort=name&dir=desc');
    assert.equal(sortLink({ search: 'x' }, 'name', 'price', 'asc'), '?search=x&sort=name&dir=asc');
});

test('toCsv quotes values and escapes embedded quotes', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'say "hi"']]);
    assert.ok(csv.includes('"x,y","say ""hi"""'));
});

test('toCsv defuses spreadsheet formula injection', () => {
    const csv = toCsv(['a'], [['=1+1'], ['+cmd'], ['-2'], ['@SUM(A1)']]);
    assert.ok(csv.includes('"\'=1+1"'));
    assert.ok(csv.includes('"\'+cmd"'));
    assert.ok(csv.includes('"\'-2"'));
    assert.ok(csv.includes('"\'@SUM(A1)"'));
});

test('toCsv renders null and undefined as empty cells', () => {
    const csv = toCsv(['a', 'b'], [[null, undefined]]);
    assert.ok(csv.includes('"",""'));
});
