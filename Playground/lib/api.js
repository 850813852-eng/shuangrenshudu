const { buildRoomState, decodeBoard, joinRoom, validateSubmission } = require("./game");
const { createAndSaveRoom, loadRoom, saveRoom, withRoomLock } = require("./store");

async function createRoomHandler(name) {
  const room = await createAndSaveRoom(String(name || "").trim());
  return {
    statusCode: 201,
    data: {
      roomCode: room.code,
      playerId: room.players[0].id,
      state: buildRoomState(room, room.players[0].id)
    }
  };
}

async function joinRoomHandler(roomCode, name) {
  const code = String(roomCode || "").trim().toUpperCase();

  return withRoomLock(code, async () => {
    const room = await loadRoom(code);
    if (!room) {
      return { statusCode: 404, data: { error: "房间不存在" } };
    }

    const player = joinRoom(room, String(name || "").trim());
    if (!player) {
      return { statusCode: 409, data: { error: "房间已满" } };
    }

    await saveRoom(room);
    return {
      statusCode: 200,
      data: {
        roomCode: room.code,
        playerId: player.id,
        state: buildRoomState(room, player.id)
      }
    };
  });
}

async function stateHandler(roomCode, playerId) {
  const code = String(roomCode || "").trim().toUpperCase();
  const player = String(playerId || "").trim();
  const room = await loadRoom(code);

  if (!room) {
    return { statusCode: 404, data: { error: "房间不存在" } };
  }

  if (!room.players.find((item) => item.id === player)) {
    return { statusCode: 404, data: { error: "玩家不存在" } };
  }

  return {
    statusCode: 200,
    data: buildRoomState(room, player)
  };
}

async function submitHandler(roomCode, playerId, boardValue) {
  const code = String(roomCode || "").trim().toUpperCase();
  const playerIdValue = String(playerId || "").trim();

  return withRoomLock(code, async () => {
    const room = await loadRoom(code);
    if (!room) {
      return { statusCode: 404, data: { error: "房间不存在" } };
    }

    const player = room.players.find((item) => item.id === playerIdValue);
    if (!player) {
      return { statusCode: 404, data: { error: "玩家不存在" } };
    }

    if (room.status === "finished") {
      return {
        statusCode: 409,
        data: { error: "比赛已结束", state: buildRoomState(room, player.id) }
      };
    }

    if (room.players.length < 2) {
      return { statusCode: 409, data: { error: "对手尚未加入" } };
    }

    const board = decodeBoard(boardValue);
    const result = validateSubmission(room, board);
    if (!result.ok) {
      return {
        statusCode: 400,
        data: { error: result.reason, state: buildRoomState(room, player.id) }
      };
    }

    player.completedAt = Date.now();
    room.status = "finished";
    room.winnerId = player.id;
    await saveRoom(room);

    return {
      statusCode: 200,
      data: {
        ok: true,
        message: "提交成功，已获胜",
        state: buildRoomState(room, player.id)
      }
    };
  });
}

module.exports = {
  createRoomHandler,
  joinRoomHandler,
  stateHandler,
  submitHandler
};
