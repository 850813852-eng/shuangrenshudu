const state = {
  roomCode: "",
  playerId: "",
  puzzle: "",
  board: "",
  pollTimer: null
};

const elements = {
  lobbyCard: document.querySelector("#lobby-card"),
  gameCard: document.querySelector("#game-card"),
  playerName: document.querySelector("#player-name"),
  roomCodeInput: document.querySelector("#room-code-input"),
  roomCode: document.querySelector("#room-code"),
  copyRoomCode: document.querySelector("#copy-room-code"),
  matchStatus: document.querySelector("#match-status"),
  selfName: document.querySelector("#self-name"),
  selfTime: document.querySelector("#self-time"),
  selfState: document.querySelector("#self-state"),
  opponentName: document.querySelector("#opponent-name"),
  opponentTime: document.querySelector("#opponent-time"),
  opponentState: document.querySelector("#opponent-state"),
  board: document.querySelector("#board"),
  messageBox: document.querySelector("#message-box"),
  createRoom: document.querySelector("#create-room"),
  joinRoom: document.querySelector("#join-room"),
  submitBoard: document.querySelector("#submit-board"),
  resetBoard: document.querySelector("#reset-board")
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

function getCellValue(index) {
  return state.board[index] || "0";
}

function setCellValue(index, value) {
  const chars = state.board.split("");
  chars[index] = value;
  state.board = chars.join("");
}

function renderBoard() {
  elements.board.innerHTML = "";
  for (let index = 0; index < 81; index += 1) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const input = document.createElement("input");
    input.className = "cell";
    if ((col + 1) % 3 === 0 && col !== 8) {
      input.classList.add("block-right");
    }
    if ((row + 1) % 3 === 0 && row !== 8) {
      input.classList.add("block-bottom");
    }
    input.inputMode = "numeric";
    input.pattern = "[1-9]*";
    input.maxLength = 1;

    const original = state.puzzle[index];
    const current = getCellValue(index);
    if (original !== "0") {
      input.value = original;
      input.disabled = true;
      input.classList.add("fixed");
    } else {
      input.value = current === "0" ? "" : current;
      input.addEventListener("input", () => {
        const next = input.value.replace(/[^1-9]/g, "").slice(0, 1);
        input.value = next;
        setCellValue(index, next || "0");
      });
    }
    elements.board.appendChild(input);
  }
}

function updateRoomView(payload) {
  state.roomCode = payload.roomCode;
  state.puzzle = payload.puzzle;
  if (!state.board) {
    state.board = payload.puzzle;
    renderBoard();
  }

  elements.lobbyCard.classList.add("hidden");
  elements.gameCard.classList.remove("hidden");
  elements.roomCode.textContent = payload.roomCode;
  elements.selfName.textContent = payload.player?.name || "-";
  elements.selfTime.textContent = formatMs(payload.player?.elapsedMs || 0);
  elements.selfState.textContent = payload.player?.completed ? "已完成" : payload.player?.joined ? "作答中" : "等待中";

  elements.opponentName.textContent = payload.opponent?.name || "待加入";
  elements.opponentTime.textContent = formatMs(payload.opponent?.elapsedMs || 0);
  elements.opponentState.textContent = payload.opponent
    ? payload.opponent.completed
      ? "已完成"
      : payload.opponent.joined
        ? "作答中"
        : "等待中"
    : "未加入";

  if (payload.status === "waiting") {
    elements.matchStatus.textContent = "等待对手加入";
  } else if (payload.status === "playing") {
    elements.matchStatus.textContent = "对战进行中";
  } else if (payload.status === "finished") {
    elements.matchStatus.textContent = payload.winnerId === state.playerId ? "你赢了" : "对手获胜";
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

async function createRoom() {
  const data = await requestJson("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ name: normalizeName() })
  });
  state.playerId = data.playerId;
  state.board = "";
  updateRoomView(data.state);
  showMessage("房间已创建，把邀请码发给对手。");
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
  state.board = "";
  updateRoomView(data.state);
  showMessage("已加入房间，比赛开始。");
  startPolling();
}

async function refreshState() {
  if (!state.roomCode || !state.playerId) {
    return;
  }
  try {
    const data = await requestJson(`/api/state?roomCode=${state.roomCode}&playerId=${state.playerId}`);
    updateRoomView(data);
    if (data.status === "finished") {
      showMessage(data.winnerId === state.playerId ? "你率先完成，获胜。" : "对手先完成，比赛结束。");
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
    showMessage(data.message);
    stopPolling();
  } catch (error) {
    showMessage(error.message);
  }
}

function resetBoard() {
  state.board = state.puzzle;
  renderBoard();
  showMessage("已恢复到初始题面。");
}

async function copyRoomCode() {
  try {
    await navigator.clipboard.writeText(state.roomCode);
    showMessage("邀请码已复制。");
  } catch (error) {
    showMessage("复制失败，请手动复制。");
  }
}

elements.createRoom.addEventListener("click", () => {
  createRoom().catch((error) => showMessage(error.message));
});
elements.joinRoom.addEventListener("click", () => {
  joinRoom().catch((error) => showMessage(error.message));
});
elements.submitBoard.addEventListener("click", () => {
  submitBoard();
});
elements.resetBoard.addEventListener("click", resetBoard);
elements.copyRoomCode.addEventListener("click", copyRoomCode);
