// game-utils.ts

export interface WinResult {
  winner: string; // 'X' | 'O' | 'draw'
  line: number[] | null;
}

/**
 * ตรวจสอบผู้ชนะจากตาราง
 * @param board ตาราง OX ขนาด 9 ช่อง
 */
export function checkWinner(board: (string | null)[]): WinResult | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // แนวนอน
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // แนวตั้ง
    [0, 4, 8], [2, 4, 6]             // แนวทแยง
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: lines[i] };
    }
  }
  if (board.every(cell => cell !== null)) {
    return { winner: 'draw', line: null };
  }
  return null;
}

/**
 * อัลกอริทึม Minimax ในการประเมินการเคลื่อนไหวที่ดีที่สุด
 */
export function minimax(board: (string | null)[], depth: number, isMax: boolean): number {
  const result = checkWinner(board);
  if (result) {
    if (result.winner === 'O') return 10 - depth;
    if (result.winner === 'X') return -10 + depth;
    if (result.winner === 'draw') return 0;
  }

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, depth + 1, false));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, depth + 1, true));
        board[i] = null;
      }
    }
    return best;
  }
}

/**
 * หาช่องเดินที่ดีที่สุดสำหรับบอท O
 */
export function findBestMove(board: (string | null)[]): number {
  let bestVal = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'O';
      const moveVal = minimax(board, 0, false);
      board[i] = null;
      if (moveVal > bestVal) {
        bestVal = moveVal;
        bestMove = i;
      }
    }
  }
  return bestMove;
}
