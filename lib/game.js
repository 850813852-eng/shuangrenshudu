const crypto = require("crypto");

const DIFFICULTIES = {
  easy: { label: "容易", clues: 40 },
  medium: { label: "中度", clues: 34 },
  hard: { label: "困难", clues: 28 }
};

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

function normalizeDifficulty(value) {
  return DIFFICULTIES[value] ? value : "easy";
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

function buildPlayerState(room, player) {
  return {
    id: player.id,
    name: player.name,
    joined: Boolean(player.joinedAt),
    completed: Boolean(player.completedAt),
    failed: Boolean(player.failedAt),
    mistakes: player.mistakes || 0,
    mistakesLeft: Math.max(0, 3 - (player.mistakes || 0)),
    elapsedMs: getElapsedMs(room, player)
  };
}

function buildRoomState(room, viewerId) {
  const viewer = room.players.find((player) => player.id === viewerId);
  const opponent = room.players.find((player) => player.id !== viewerId);

  return {
    roomCode: room.code,
    mode: room.mode,
    status: room.status,
    winnerId: room.winnerId,
    difficulty: room.difficulty,
    difficultyLabel: DIFFICULTIES[room.difficulty].label,
    puzzle: encodeBoard(room.puzzle),
    player: viewer ? buildPlayerState(room, viewer) : null,
    opponent: opponent ? buildPlayerState(room, opponent) : null,
    joinedCount: room.players.filter((player) => player.joinedAt).length
  };
}

function createPlayer(name) {
  return {
    id: randomId(12),
    name: name || "玩家",
    joinedAt: Date.now(),
    completedAt: null,
    failedAt: null,
    mistakes: 0
  };
}

function createRoom(hostName, difficulty = "easy", mode = "multi") {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const normalizedMode = mode === "single" ? "single" : "multi";
  const solution = generateSolvedBoard();
  return {
    code: randomId(6),
    mode: normalizedMode,
    difficulty: normalizedDifficulty,
    puzzle: generatePuzzle(solution, DIFFICULTIES[normalizedDifficulty].clues),
    solution,
    status: normalizedMode === "single" ? "playing" : "waiting",
    winnerId: null,
    players: [createPlayer(hostName || "玩家 1")],
    startedAt: normalizedMode === "single" ? Date.now() : null,
    createdAt: Date.now()
  };
}

function joinRoom(room, name) {
  if (room.players.length >= 2) {
    return null;
  }

  const player = createPlayer(name || `玩家 ${room.players.length + 1}`);

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

function validateMove(room, player, row, col, value) {
  if (!Number.isInteger(row) || !Number.isInteger(col) || !Number.isInteger(value)) {
    return { ok: false, reason: "输入无效" };
  }

  if (row < 0 || row > 8 || col < 0 || col > 8 || value < 1 || value > 9) {
    return { ok: false, reason: "输入无效" };
  }

  if (room.puzzle[row][col] !== 0) {
    return { ok: false, reason: "题目给定数字不能修改" };
  }

  if (player.failedAt) {
    return { ok: false, reason: "你已判负" };
  }

  if (room.solution[row][col] === value) {
    return { ok: true, correct: true };
  }

  player.mistakes = (player.mistakes || 0) + 1;
  if (player.mistakes >= 3) {
    player.failedAt = Date.now();
    room.status = "finished";
    const opponent = room.players.find((item) => item.id !== player.id);
    room.winnerId = room.mode === "single" ? null : opponent && !opponent.failedAt ? opponent.id : null;
    return {
      ok: false,
      correct: false,
      failed: true,
      reason: "错误次数已用完，判定失败"
    };
  }

  return {
    ok: false,
    correct: false,
    failed: false,
    reason: `数字错误，还剩 ${Math.max(0, 3 - player.mistakes)} 次机会`
  };
}

module.exports = {
  buildRoomState,
  createRoom,
  decodeBoard,
  joinRoom,
  normalizeDifficulty,
  validateMove,
  validateSubmission
};
