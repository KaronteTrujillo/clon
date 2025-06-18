const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const { randomBytes } = require("crypto");
const pino = require("pino");

const app = express();
app.use(express.json());

const PORT = 3003;
const SUBBOT_NUMBER = process.env.NUMBER || "default-number";
console.log(`SUBBOT_NUMBER inicializado como: ${SUBBOT_NUMBER}`);

// Estado de autenticación y linking
let isReady = false;
let linkingCode = null;

// Generar código aleatorio de vinculación
function generateLinkingCode() {
  return randomBytes(8).toString("hex").toUpperCase(); // e.g., A1B2C3D4E5F6G7H8
}

// Iniciar subbot
async function startSubbot() {
  console.log(`Iniciando subbot para ${SUBBOT_NUMBER}`);
  const { state, saveCreds } = await useMultiFileAuthState(`auth_subbot_${SUBBOT_NUMBER}`);
  const logger = pino({ level: "silent" });

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`Escanea el código QR para autenticar el subbot de ${SUBBOT_NUMBER}:`, qr);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`Conexión cerrada. StatusCode: ${statusCode}, Error: ${lastDisconnect?.error?.message}`);
      isReady = false;
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("Intentando reconectar...");
        startSubbot();
      } else {
        console.log("Subbot desconectado permanentemente (logged out).");
      }
    } else if (connection === "open") {
      console.log(`Subbot conectado exitosamente para ${SUBBOT_NUMBER}`);
      linkingCode = generateLinkingCode();
      isReady = true;

      console.log(`Código de vinculación generado: ${linkingCode}`);

      try {
        await sock.sendMessage(
          `${SUBBOT_NUMBER.replace("+", "")}@s.whatsapp.net`,
          { text: `Tu subbot ha sido iniciado. Código de vinculación: ${linkingCode}` }
        );
      } catch (err) {
        console.error("Error al enviar confirmación al subbot:", err);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Endpoint para obtener el código de vinculación
  app.post("/generate-linking-code", async (req, res) => {
    try {
      const { number } = req.body;
      console.log(`Solicitud recibida con número: ${number}, SUBBOT_NUMBER: ${SUBBOT_NUMBER}`);

      if (!number || number !== SUBBOT_NUMBER) {
        console.log(`Error: Número inválido o no coincide. Enviado: ${number}, Esperado: ${SUBBOT_NUMBER}`);
        return res.status(400).json({ error: "Número inválido o no coincide", code: "INVALID_NUMBER" });
      }

      if (!isReady || !linkingCode) {
        console.log("Subbot aún no está autenticado o sin código.");
        return res.status(503).json({
          error: "Subbot aún no está autenticado",
          code: "WAIT_FOR_AUTH",
          number: SUBBOT_NUMBER,
        });
      }

      console.log(`Enviando código de vinculación: ${linkingCode}`);
      res.status(200).json({
        message: `Código de vinculación generado para ${number}`,
        linkingCode,
      });
    } catch (error) {
      console.error("Error en /generate-linking-code:", error);
      res.status(500).json({ error: "Fallo interno al generar el código de vinculación", code: "INTERNAL_ERROR" });
    }
  });

  // Endpoint de verificación de estado
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: isReady ? "ready" : "not_ready",
      subbot: SUBBOT_NUMBER,
    });
  });

  app.listen(PORT, () => {
    console.log(`Subbot para ${SUBBOT_NUMBER} corriendo en el puerto ${PORT}`);
  });
}

startSubbot().catch((err) => {
  console.error("Error crítico al iniciar subbot:", err);
});
