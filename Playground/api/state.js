const { stateHandler } = require("../lib/api");
const { sendJson } = require("../lib/http");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const result = await stateHandler(req.query.roomCode, req.query.playerId);
    sendJson(res, result.statusCode, result.data);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
};
