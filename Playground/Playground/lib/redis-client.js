const net = require("net");
const tls = require("tls");

function parseRedisUrl() {
  const value = process.env.KV_REST_API_REDIS_URL || process.env.REDIS_URL || "";
  if (!value) {
    return null;
  }

  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === "rediss:" ? 6380 : 6379)),
    username: decodeURIComponent(url.username || "default"),
    password: decodeURIComponent(url.password || ""),
    useTls: url.protocol === "rediss:"
  };
}

function encodeBulk(value) {
  const stringValue = String(value);
  return `$${Buffer.byteLength(stringValue)}\r\n${stringValue}\r\n`;
}

function encodeCommand(parts) {
  return `*${parts.length}\r\n${parts.map(encodeBulk).join("")}`;
}

function createParser() {
  let buffer = Buffer.alloc(0);

  function readLine(offset) {
    const lineEnd = buffer.indexOf("\r\n", offset, "utf8");
    if (lineEnd === -1) {
      return null;
    }
    return {
      line: buffer.toString("utf8", offset, lineEnd),
      nextOffset: lineEnd + 2
    };
  }

  function parseValue(offset = 0) {
    if (buffer.length <= offset) {
      return null;
    }

    const type = String.fromCharCode(buffer[offset]);
    const header = readLine(offset + 1);
    if (!header) {
      return null;
    }

    if (type === "+") {
      return { value: header.line, nextOffset: header.nextOffset };
    }

    if (type === "-") {
      const error = new Error(header.line);
      error.name = "RedisError";
      return { error, nextOffset: header.nextOffset };
    }

    if (type === ":") {
      return { value: Number(header.line), nextOffset: header.nextOffset };
    }

    if (type === "$") {
      const size = Number(header.line);
      if (size === -1) {
        return { value: null, nextOffset: header.nextOffset };
      }
      const end = header.nextOffset + size;
      if (buffer.length < end + 2) {
        return null;
      }
      const value = buffer.toString("utf8", header.nextOffset, end);
      return { value, nextOffset: end + 2 };
    }

    if (type === "*") {
      const count = Number(header.line);
      if (count === -1) {
        return { value: null, nextOffset: header.nextOffset };
      }
      const values = [];
      let nextOffset = header.nextOffset;
      for (let index = 0; index < count; index += 1) {
        const result = parseValue(nextOffset);
        if (!result) {
          return null;
        }
        if (result.error) {
          return result;
        }
        values.push(result.value);
        nextOffset = result.nextOffset;
      }
      return { value: values, nextOffset };
    }

    throw new Error(`Unsupported Redis response type: ${type}`);
  }

  return {
    push(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
    },
    consume() {
      const result = parseValue(0);
      if (!result) {
        return null;
      }
      buffer = buffer.subarray(result.nextOffset);
      return result.error ? { error: result.error } : { value: result.value };
    }
  };
}

class RedisConnection {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.pending = [];
    this.connected = false;
  }

  async connect() {
    if (this.connected) {
      return;
    }

    const parser = createParser();
    const socket = this.config.useTls
      ? tls.connect({
          host: this.config.host,
          port: this.config.port,
          servername: this.config.host
        })
      : net.createConnection({
          host: this.config.host,
          port: this.config.port
        });

    this.socket = socket;

    socket.on("data", (chunk) => {
      parser.push(chunk);
      while (true) {
        const result = parser.consume();
        if (!result) {
          break;
        }
        const pending = this.pending.shift();
        if (!pending) {
          continue;
        }
        if (result.error) {
          pending.reject(result.error);
        } else {
          pending.resolve(result.value);
        }
      }
    });

    socket.on("error", (error) => {
      while (this.pending.length) {
        this.pending.shift().reject(error);
      }
    });

    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });

    this.connected = true;

    if (this.config.password) {
      const authArgs = this.config.username && this.config.username !== "default"
        ? ["AUTH", this.config.username, this.config.password]
        : ["AUTH", this.config.password];
      await this.command(...authArgs);
    }
  }

  command(...parts) {
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.socket.write(encodeCommand(parts));
    });
  }

  async close() {
    if (!this.socket) {
      return;
    }
    await new Promise((resolve) => {
      this.socket.end(resolve);
    });
    this.connected = false;
    this.socket = null;
  }
}

async function runRedisCommand(...parts) {
  const config = parseRedisUrl();
  if (!config) {
    throw new Error("Missing Redis configuration");
  }

  const connection = new RedisConnection(config);
  await connection.connect();
  try {
    return await connection.command(...parts);
  } finally {
    await connection.close();
  }
}

module.exports = {
  parseRedisUrl,
  runRedisCommand
};
