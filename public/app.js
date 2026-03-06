const state = {
  mode: "single",
  difficulty: "easy",
  roomCode: "",
  playerId: "",
  puzzle: "",
  board: "",
  pollTimer: null,
  selectedIndex: -1,
  invalidCells: new Set(),
  lastRejectedMove: null,
  resultAnnounced: false
};

const elements = {
  lobbyCard: document.querySelector("#lobby-card"),
  gameCard: document.querySelector("#game-card"),
  playerName: document.querySelector("#player-name"),
  roomCodeInput: document.querySelector("#room-code-input"),
  modeOptions: Array.from(document.querySelectorAll(".mode-option")),
  difficultyOptions: Array.from(document.querySelectorAll(".difficulty-option")),
  singleActions: document.querySelector("#single-actions"),
  multiActions: document.querySelector("#multi-actions"),
  startSingle: document.querySelector("#start-single"),
  createRoom: document.querySelector("#create-room"),
  joinRoom: document.querySelector("#join-room"),
  difficultyTag: document.querySelector("#difficulty-tag"),
  roomCode: document.querySelector("#room-code"),
  copyRoomCode: document.querySelector("#copy-room-code"),
  matchStatus: document.querySelector("#match-status"),
  selfHearts: document.querySelector("#self-hearts"),
  selfName: document.querySelector("#self-name"),
  selfTime: document.querySelector("#self-time"),
  selfState: document.querySelector("#self-state"),
  selfMistakes: document.querySelector("#self-mistakes"),
  opponentSummary: document.querySelector("#opponent-summary"),
  opponentName: document.querySelector("#opponent-name"),
  opponentTime: document.querySelector("#opponent-time"),
  opponentState: document.querySelector("#opponent-state"),
  opponentMistakes: document.querySelector("#opponent-mistakes"),
  board: document.querySelector("#board"),
  numberPad: document.querySelector("#number-pad"),
  messageBox: document.querySelector("#message-box"),
  submitBoard: document.querySelector("#submit-board"),
  resetBoard: document.querySelector("#reset-board"),
  undoMove: document.querySelector("#undo-move")
};

function showMessage(message) {
  elements.messageBox.textContent = message || "";
}

function formatMs(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function normalizeName() {
  return elements.playerName.value.trim() || "匿名玩家";
}

function syncModeView() {
  elements.singleActions.classList.toggle("hidden", state.mode !== "single");
  elements.multiActions.classList.toggle("hidden", state.mode !== "multi");
}

function resetLocalGameState() {
  state.board = "";
  state.selectedIndex = -1;
  state.invalidCells.clear();
  state.lastRejectedMove = null;
  state.resultAnnounced = false;
}

function getCellValue(index) {
  return state.board[index] || "0";
}

function setCellValue(index, value) {
  const chars = state.board.split("");
  chars[index] = value;
  state.board = chars.join("");
}

function selectedValue() {
  if (state.selectedIndex < 0) {
    return "";
  }
  const value = getCellValue(state.selectedIndex);
  return value !== "0" ? value : "";
}

function syncUndoButton() {
  elements.undoMove.classList.toggle("hidden", !state.lastRejectedMove);
}

function renderHearts(mistakesLeft) {
  elements.selfHearts.innerHTML = "";
  for (let index = 0; index < 3; index += 1) {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.textContent = "\u2665";
    if (index >= mistakesLeft) {
      heart.classList.add("empty");
    }
    elements.selfHearts.appendChild(heart);
  }
}

function clearInvalidCell(index) {
  if (index >= 0) {
    state.invalidCells.delete(index);
  }
}

function selectCell(index) {
  state.selectedIndex = index;
  renderBoard();
}

function renderBoard() {
  elements.board.innerHTML = "";
  const activeValue = selectedValue();
  for (let index = 0; index < 81; index += 1) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";

    if ((col + 1) % 3 === 0 && col !== 8) {
      cell.classList.add("block-right");
    }
    if ((row + 1) % 3 === 0 && row !== 8) {
      cell.classList.add("block-bottom");
    }

    const current = getCellValue(index);
    const displayValue = current === "0" ? "" : current;
    cell.textContent = displayValue;

    if (state.selectedIndex === index) {
      cell.classList.add("selected");
    }
    if (activeValue && displayValue === activeValue) {
      cell.classList.add("same-number");
    }
    if (state.invalidCells.has(index)) {
      cell.classList.add("invalid");
    }
    if (state.puzzle[index] !== "0") {
      cell.classList.add("fixed");
    }

    cell.addEventListener("click", () => selectCell(index));
    elements.board.appendChild(cell);
  }
}

function renderNumberPad() {
  elements.numberPad.innerHTML = "";
  for (let value = 1; value <= 9; value += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "number-key";
    button.textContent = String(value);
    button.addEventListener("click", () => {
      playMove(value).catch((error) => showMessage(error.message));
    });
    elements.numberPad.appendChild(button);
  }
}

function updateRoomView(payload) {
  state.mode = payload.mode || "single";
  state.roomCode = payload.roomCode;
  state.puzzle = payload.puzzle;
  if (!state.board) {
    state.board = payload.puzzle;
  }

  elements.lobbyCard.classList.add("hidden");
  elements.gameCard.classList.remove("hidden");
  elements.difficultyTag.textContent = payload.difficultyLabel || "容易";
  elements.roomCode.textContent = payload.roomCode;
  elements.copyRoomCode.classList.toggle("hidden", state.mode === "single");
  elements.opponentSummary.classList.toggle("hidden", state.mode === "single");
  elements.opponentMistakes.classList.toggle("hidden", state.mode === "single");
  elements.opponentTime.classList.toggle("hidden", state.mode === "single");

  elements.selfName.textContent = payload.player?.name || "-";
  elements.selfTime.textContent = formatMs(payload.player?.elapsedMs || 0);
  elements.selfState.textContent = payload.player?.failed
    ? "已判负"
    : payload.player?.completed
      ? "已完成"
      : payload.player?.joined
        ? "作答中"
        : "等待中";
  elements.selfMistakes.textContent = `剩余容错 ${payload.player?.mistakesLeft ?? 3} 次`;
  renderHearts(payload.player?.mistakesLeft ?? 3);

  elements.opponentName.textContent = payload.opponent?.name || "待加入";
  elements.opponentTime.textContent = formatMs(payload.opponent?.elapsedMs || 0);
  elements.opponentState.textContent = payload.opponent
    ? payload.opponent.failed
      ? "已判负"
      : payload.opponent.completed
        ? "已完成"
        : payload.opponent.joined
          ? "作答中"
          : "等待中"
    : "未加入";
  elements.opponentMistakes.textContent = payload.opponent
    ? `对手剩余容错 ${payload.opponent.mistakesLeft} 次`
    : "对手剩余容错 3 次";

  if (state.mode === "single") {
    elements.matchStatus.textContent = payload.status === "finished" ? "已结束" : "单人挑战";
  } else if (payload.status === "waiting") {
    elements.matchStatus.textContent = "等待对手加入";
  } else if (payload.status === "playing") {
    elements.matchStatus.textContent = "对战进行中";
  } else if (payload.status === "finished") {
    elements.matchStatus.textContent = payload.winnerId === state.playerId ? "你赢了" : "对手获胜";
  }

  renderBoard();
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "请求失败");
    error.state = data.state;
    throw error;
  }
  return data;
}

async function createRoom(mode) {
  const data = await requestJson("/api/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: normalizeName(),
      difficulty: state.difficulty,
      mode
    })
  });
  state.playerId = data.playerId;
  resetLocalGameState();
  updateRoomView(data.state);
  showMessage(mode === "single" ? "单人挑战已开始。" : "房间已创建，把邀请码发给对手。");
  syncUndoButton();
  startPolling();
}

async function joinRoom() {
  const roomCode = elements.roomCodeInput.value.trim().toUpperCase();
  if (!roomCode) {
    showMessage("请输入邀请码");
    return;
  }
  const data = await requestJson("/api/join", {
    method: "POST",
    body: JSON.stringify({
      roomCode,
      name: normalizeName()
    })
  });
  state.playerId = data.playerId;
  resetLocalGameState();
  updateRoomView(data.state);
  showMessage("已加入房间，比赛开始。");
  syncUndoButton();
  startPolling();
}

async function refreshState() {
  if (!state.roomCode || !state.playerId) {
    return;
  }
  try {
    const data = await requestJson(`/api/state?roomCode=${state.roomCode}&playerId=${state.playerId}`);
    updateRoomView(data);
    if (data.status === "finished" && !state.resultAnnounced) {
      state.resultAnnounced = true;
      if (data.player?.failed) {
        alert("你已用完 3 次错误机会，判定失败。");
      } else if (state.mode === "single") {
        alert("单人挑战完成。");
      } else if (data.winnerId === state.playerId) {
        alert("你获胜了。");
      } else {
        alert("对手获胜。");
      }
      stopPolling();
    }
  } catch (error) {
    showMessage(error.message);
    stopPolling();
  }
}

function startPolling() {
  stopPolling();
  state.pollTimer = window.setInterval(refreshState, 1000);
  refreshState();
}

function stopPolling() {
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

async function submitBoard() {
  try {
    const data = await requestJson("/api/submit", {
      method: "POST",
      body: JSON.stringify({
        roomCode: state.roomCode,
        playerId: state.playerId,
        board: state.board
      })
    });
    updateRoomView(data.state);
    state.resultAnnounced = true;
    alert(state.mode === "single" ? "答案正确，单人挑战完成。" : "答案正确，你获胜了。");
    stopPolling();
  } catch (error) {
    showMessage(error.message);
    alert(`提交结果：${error.message}`);
  }
}

function resetBoard() {
  state.board = state.puzzle;
  state.selectedIndex = -1;
  state.invalidCells.clear();
  state.lastRejectedMove = null;
  syncUndoButton();
  renderBoard();
  showMessage("已重置到初始题面。");
}

function undoRejectedMove() {
  if (!state.lastRejectedMove) {
    return;
  }
  setCellValue(state.lastRejectedMove.index, state.lastRejectedMove.previousValue);
  clearInvalidCell(state.lastRejectedMove.index);
  state.selectedIndex = state.lastRejectedMove.index;
  state.lastRejectedMove = null;
  syncUndoButton();
  renderBoard();
  showMessage("已撤回错误输入。");
}

async function playMove(value) {
  if (state.selectedIndex < 0) {
    showMessage("请先点击一个空格。");
    return;
  }
  if (state.puzzle[state.selectedIndex] !== "0") {
    showMessage("题目给定数字不能修改。");
    return;
  }

  const row = Math.floor(state.selectedIndex / 9);
  const col = state.selectedIndex % 9;
  const previousValue = getCellValue(state.selectedIndex);

  setCellValue(state.selectedIndex, String(value));
  renderBoard();

  try {
    const data = await requestJson("/api/move", {
      method: "POST",
      body: JSON.stringify({
        roomCode: state.roomCode,
        playerId: state.playerId,
        row,
        col,
        value
      })
    });
    clearInvalidCell(state.selectedIndex);
    state.lastRejectedMove = null;
    syncUndoButton();
    updateRoomView(data.state);
    showMessage("填写正确。");
  } catch (error) {
    state.invalidCells.add(state.selectedIndex);
    state.lastRejectedMove = {
      index: state.selectedIndex,
      previousValue
    };
    syncUndoButton();
    if (error.state) {
      updateRoomView(error.state);
    }
    renderBoard();
    showMessage(error.message);
    alert(error.message);
  }
}

async function copyRoomCode() {
  if (state.mode === "single") {
    return;
  }
  try {
    await navigator.clipboard.writeText(state.roomCode);
    showMessage("邀请码已复制。");
  } catch (error) {
    showMessage("复制失败，请手动复制。");
  }
}

elements.startSingle.addEventListener("click", () => {
  createRoom("single").catch((error) => showMessage(error.message));
});
elements.createRoom.addEventListener("click", () => {
  createRoom("multi").catch((error) => showMessage(error.message));
});
elements.joinRoom.addEventListener("click", () => {
  joinRoom().catch((error) => showMessage(error.message));
});
elements.submitBoard.addEventListener("click", submitBoard);
elements.resetBoard.addEventListener("click", resetBoard);
elements.copyRoomCode.addEventListener("click", copyRoomCode);
elements.undoMove.addEventListener("click", undoRejectedMove);

elements.difficultyOptions.forEach((button) => {
  button.addEventListener("click", () => {
    state.difficulty = button.dataset.difficulty;
    elements.difficultyOptions.forEach((item) => item.classList.toggle("active", item === button));
  });
});

elements.modeOptions.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    elements.modeOptions.forEach((item) => item.classList.toggle("active", item === button));
    syncModeView();
  });
});

syncModeView();
renderNumberPad();
