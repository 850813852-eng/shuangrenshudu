const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { createRoomHandler, joinRoomHandler, moveHandler, stateHandler, submitHandler } = require("./lib/api");
const { parseBody, sendJson } = require("./lib/http");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

function serveStatic(req, res, pathname) {
  const targetPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, targetPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8"
    };
    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  });
}

async function handleApi(req, res, pathname, searchParams) {
  try {
    if (req.method === "POST" && pathname === "/api/rooms") {
      const body = await parseBody(req);
      const result = await createRoomHandler(body.name);
      sendJson(res, result.statusCode, result.data);
      return;
    }

    if (req.method === "POST" && pathname === "/api/join") {
      const body = await parseBody(req);
      const result = await joinRoomHandler(body.roomCode, body.name);
      sendJson(res, result.statusCode, result.data);
      return;
    }

    if (req.method === "GET" && pathname === "/api/state") {
      const result = await stateHandler(searchParams.get("roomCode"), searchParams.get("playerId"));
      sendJson(res, result.statusCode, result.data);
      return;
    }

    if (req.method === "POST" && pathname === "/api/move") {
      const body = await parseBody(req);
      const result = await moveHandler(body.roomCode, body.playerId, body.row, body.col, body.value);
      sendJson(res, result.statusCode, result.data);
      return;
    }

    if (req.method === "POST" && pathname === "/api/submit") {
      const body = await parseBody(req);
      const result = await submitHandler(body.roomCode, body.playerId, body.board);
      sendJson(res, result.statusCode, result.data);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url.pathname, url.searchParams);
    return;
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Sudoku PK server running at http://localhost:${PORT}`);
});
