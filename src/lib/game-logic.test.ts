// game-logic.test.ts
import { test } from 'node:test';
import assert from 'node:assert';
import { checkWinner, findBestMove } from './game-utils.js';

test('ตรรกะตรวจหาผู้ชนะ (checkWinner)', async (t) => {
  await t.test('ควรพบผู้ชนะในแนวนอนแถวแรก', () => {
    const board = [
      'X', 'X', 'X',
      null, 'O', null,
      'O', null, null
    ];
    const result = checkWinner(board);
    assert.ok(result);
    assert.strictEqual(result.winner, 'X');
    assert.deepStrictEqual(result.line, [0, 1, 2]);
  });

  await t.test('ควรพบผู้ชนะในแนวตั้งคอลัมน์สอง', () => {
    const board = [
      'X', 'O', null,
      null, 'O', 'X',
      'X', 'O', null
    ];
    const result = checkWinner(board);
    assert.ok(result);
    assert.strictEqual(result.winner, 'O');
    assert.deepStrictEqual(result.line, [1, 4, 7]);
  });

  await t.test('ควรพบผู้ชนะในแนวทแยงมุมกลับ', () => {
    const board = [
      'X', 'O', 'O',
      null, 'O', 'X',
      'O', 'X', null
    ];
    const result = checkWinner(board);
    assert.ok(result);
    assert.strictEqual(result.winner, 'O');
    assert.deepStrictEqual(result.line, [2, 4, 6]);
  });

  await t.test('ควรได้ผลลัพธ์เป็นเสมอเมื่อเต็มตารางและไม่มีผู้ชนะ', () => {
    const board = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', 'X'
    ];
    const result = checkWinner(board);
    assert.ok(result);
    assert.strictEqual(result.winner, 'draw');
    assert.strictEqual(result.line, null);
  });

  await t.test('ควรคืนค่า null หากยังไม่จบเกมและไม่มีผู้ชนะ', () => {
    const board = [
      'X', 'O', null,
      null, null, null,
      null, null, null
    ];
    const result = checkWinner(board);
    assert.strictEqual(result, null);
  });
});

test('ตรรกะการประมวลผลหมากเดินบอท AI (findBestMove)', async (t) => {
  await t.test('บอท O ควรเลือกตำแหน่งเดินเพื่อชนะทันทีหากมีโอกาส', () => {
    // แถวล่าง O สามารถชนะได้ที่ช่อง index 8
    const board = [
      'X', 'X', null,
      'X', null, null,
      'O', 'O', null
    ];
    const bestMove = findBestMove(board);
    assert.strictEqual(bestMove, 8);
  });

  await t.test('บอท O ควรบล็อกหมาก X หาก X กำลังจะชนะในตาถัดไป', () => {
    // แถวแรก X สามารถชนะได้ที่ช่อง index 2 บอท O ต้องไปบล็อกตรงนั้น
    const board = [
      'X', 'X', null,
      null, 'O', null,
      null, null, null
    ];
    const bestMove = findBestMove(board);
    assert.strictEqual(bestMove, 2);
  });
});
