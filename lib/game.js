const crypto = require("crypto");

function randomId(length) {
  return crypto.randomBytes(length).toString("hex").slice(0, length).toUpperCase();
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pattern(row, col) {
  return (row * 3 + Math.floor(row / 3) + col) % 9;
}

function generateSolvedBoard() {
  const rows = shuffle([0, 1, 2]).flatMap((group) => shuffle([0, 1, 2]).map((row) => group * 3 + row));
  const cols = shuffle([0, 1, 2]).flatMap((group) => shuffle([0, 1, 2]).map((col) => group * 3 + col));
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return rows.map((row) => cols.map((col) => nums[pattern(row, col)]));
}

function isValidPlacement(board, row, col, num) {
  for (let index = 0; index < 9; index += 1) {
    if (board[row][index] === num || board[index][col] === num) {
      return false;
    }
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = startRow; r < startRow + 3; r += 1) {
    for (let c = startCol; c < startCol + 3; c += 1) {
      if (board[r][c] === num) {
        return false;
      }
    }
  }
  return true;
}

function countSolutions(board, limit = 2) {
  let solutions = 0;

  function search() {
    if (solutions >= limit) {
      return;
    }

    let target = null;
    for (let row = 0; row < 9 && !target; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (board[row][col] === 0) {
          target = [row, col];
          break;
        }
      }
    }

    if (!target) {
      solutions += 1;
      return;
    }

    const [row, col] = target;
    for (let num = 1; num <= 9; num += 1) {
      if (!isValidPlacement(board, row, col, num)) {
        continue;
      }
      board[row][col] = num;
      search();
      board[row][col] = 0;
    }
  }

  search();
  return solutions;
}

function generatePuzzle(solution, clues = 36) {
  const puzzle = solution.map((row) => [...row]);
  const positions = shuffle(Array.from({ length: 81 }, (_, index) => index));
  let filled = 81;

  for (const position of positions) {
    if (filled <= clues) {
      break;
    }

    const row = Math.floor(position / 9);
    const col = position % 9;
    const backup = puzzle[row][col];
    puzzle[row][col] = 0;

    if (countSolutions(puzzle.map((current) => [...current]), 2) !== 1) {
      puzzle[row][col] = backup;
      continue;
    }

    filled -= 1;
  }

  return puzzle;
}

function encodeBoard(board) {
  return board.map((row) => row.join("")).join("");
}

function decodeBoard(value) {
  if (typeof value !== "string" || value.length !== 81 || /[^0-9]/.test(value)) {
    return null;
  }

  const board = [];
  for (let row = 0; row < 9; row += 1) {
    const current = [];
    for (let col = 0; col < 9; col += 1) {
      current.push(Number(value[row * 9 + col]));
    }
    board.push(current);
  }
  return board;
}

function getElapsedMs(room, player) {
  if (!player.joinedAt || !room.startedAt) {
    return 0;
  }
  const end = player.completedAt || Date.now();
  return Math.max(0, end - room.startedAt);
}

function buildRoomState(room, viewerId) {
  const viewer = room.players.find((player) => player.id === viewerId);
  const opponent = room.players.find((player) => player.id !== viewerId);

  return {
    roomCode: room.code,
    status: room.status,
    winnerId: room.winnerId,
    puzzle: encodeBoard(room.puzzle),
    player: viewer
      ? {
          id: viewer.id,
          name: viewer.name,
          joined: Boolean(viewer.joinedAt),
          completed: Boolean(viewer.completedAt),
          elapsedMs: getElapsedMs(room, viewer)
        }
      : null,
    opponent: opponent
      ? {
          id: opponent.id,
          name: opponent.name,
          joined: Boolean(opponent.joinedAt),
          completed: Boolean(opponent.completedAt),
          elapsedMs: getElapsedMs(room, opponent)
        }
      : null,
    joinedCount: room.players.filter((player) => player.joinedAt).length
  };
}

function createRoom(hostName) {
  const solution = generateSolvedBoard();
  return {
    code: randomId(6),
    puzzle: generatePuzzle(solution),
    solution,
    status: "waiting",
    winnerId: null,
    players: [
      {
        id: randomId(12),
        name: hostName || "玩家 1",
        joinedAt: Date.now(),
        completedAt: null
      }
    ],
    startedAt: null,
    createdAt: Date.now()
  };
}

function joinRoom(room, name) {
  if (room.players.length >= 2) {
    return null;
  }

  const player = {
    id: randomId(12),
    name: name || `玩家 ${room.players.length + 1}`,
    joinedAt: Date.now(),
    completedAt: null
  };

  room.players.push(player);
  if (room.players.length === 2) {
    room.status = "playing";
    room.startedAt = Date.now();
  }
  return player;
}

function validateSubmission(room, board) {
  if (!board) {
    return { ok: false, reason: "棋盘数据无效" };
  }

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const original = room.puzzle[row][col];
      const submitted = board[row][col];

      if (submitted < 1 || submitted > 9) {
        return { ok: false, reason: "请先填完整数独" };
      }
      if (original !== 0 && submitted !== original) {
        return { ok: false, reason: "修改了题目给定数字" };
      }
      if (submitted !== room.solution[row][col]) {
        return { ok: false, reason: "答案不正确" };
      }
    }
  }

  return { ok: true };
}

module.exports = {
  buildRoomState,
  createRoom,
  decodeBoard,
  joinRoom,
  validateSubmission
};
