const net = require("net");

function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== "string") {
    return null;
  }
  const cleaned = phone.trim().replace(/[\s()-]/g, "");
  if (!/^\+\d+$/.test(cleaned) || cleaned.length < 9 || cleaned.length > 15) {
    return null;
  }
  return cleaned;
}

async function findFreePort(startPort) {
  let port = startPort;
  while (true) {
    const available = await isPortFree(port);
    if (available) return port;
    port++;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

module.exports = { normalizePhoneNumber, findFreePort };
