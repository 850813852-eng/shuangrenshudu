const { createRoom } = require("./game");
const { parseRedisUrl, runRedisCommand } = require("./redis-client");

const ROOM_TTL_SECONDS = 60 * 60 * 6;
const memoryRooms = new Map();

function getKvConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function hasRedisUrlConfig() {
  return Boolean(parseRedisUrl());
}

async function runStoreCommand(command, ...args) {
  if (getKvConfig()) {
    return kvCommand(command, ...args);
  }
  if (hasRedisUrlConfig()) {
    return runRedisCommand(command, ...args);
  }
  throw new Error("Missing storage configuration");
}

async function kvCommand(command, ...args) {
  const config = getKvConfig();
  if (!config) {
    throw new Error("Missing KV configuration");
  }

  const payload = { command: [command, ...args] };
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KV request failed: ${text}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return data.result;
}

function roomKey(code) {
  return `room:${code}`;
}

function lockKey(code) {
  return `lock:${code}`;
}

async function loadRoom(code) {
  if (!getKvConfig() && !hasRedisUrlConfig()) {
    return memoryRooms.get(code) || null;
  }

  const raw = await runStoreCommand("GET", roomKey(code));
  return raw ? JSON.parse(raw) : null;
}

async function saveRoom(room) {
  if (!getKvConfig() && !hasRedisUrlConfig()) {
    memoryRooms.set(room.code, room);
    return;
  }

  await runStoreCommand("SET", roomKey(room.code), JSON.stringify(room), "EX", String(ROOM_TTL_SECONDS));
}

async function acquireLock(code, ttlSeconds = 5) {
  if (!getKvConfig() && !hasRedisUrlConfig()) {
    return { release: async () => {} };
  }

  const token = `${Date.now()}-${Math.random()}`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < ttlSeconds * 1000) {
    const result = await runStoreCommand("SET", lockKey(code), token, "NX", "EX", String(ttlSeconds));
    if (result === "OK") {
      return {
        release: async () => {
          const current = await runStoreCommand("GET", lockKey(code));
          if (current === token) {
            await runStoreCommand("DEL", lockKey(code));
          }
        }
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("系统繁忙，请重试");
}

async function withRoomLock(code, callback) {
  const lock = await acquireLock(code);
  try {
    return await callback();
  } finally {
    await lock.release();
  }
}

async function createAndSaveRoom(hostName) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const room = createRoom(hostName);
    const existing = await loadRoom(room.code);
    if (existing) {
      continue;
    }
    await saveRoom(room);
    return room;
  }

  throw new Error("创建房间失败，请重试");
}

module.exports = {
  createAndSaveRoom,
  loadRoom,
  saveRoom,
  withRoomLock
};
