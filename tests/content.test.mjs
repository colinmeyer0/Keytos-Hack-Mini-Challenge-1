import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COPY, pickCopy } from '../js/content.js';

test('every COPY list has >= 5 entries with non-empty title and body', () => {
  for (const type of ['normal', 'hydra', 'trap', 'dodger']) {
    const list = COPY[type];
    assert.ok(Array.isArray(list), `${type} is an array`);
    assert.ok(list.length >= 5, `${type} has >= 5 entries`);
    for (const entry of list) {
      assert.equal(typeof entry.title, 'string');
      assert.equal(typeof entry.body, 'string');
      assert.ok(entry.title.trim().length > 0, `${type} title non-empty`);
      assert.ok(entry.body.trim().length > 0, `${type} body non-empty`);
    }
  }
});

test("pickCopy('trap', () => 0) returns COPY.trap[0]", () => {
  assert.equal(pickCopy('trap', () => 0), COPY.trap[0]);
});

test("pickCopy('normal', () => 0.9999) returns the last COPY.normal entry", () => {
  assert.equal(pickCopy('normal', () => 0.9999), COPY.normal[COPY.normal.length - 1]);
});
