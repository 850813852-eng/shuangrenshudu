const { createRoomHandler } = require("../lib/api");
const { parseBody, sendJson } = require("../lib/http");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await parseBody(req);
    const result = await createRoomHandler(body.name, body.difficulty, body.mode);
    sendJson(res, result.statusCode, result.data);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
};
