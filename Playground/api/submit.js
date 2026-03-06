const { submitHandler } = require("../lib/api");
const { parseBody, sendJson } = require("../lib/http");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await parseBody(req);
    const result = await submitHandler(body.roomCode, body.playerId, body.board);
    sendJson(res, result.statusCode, result.data);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
};
