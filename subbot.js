const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const { randomBytes } = require("crypto");
const pino = require("pino");

const app = express();
app.use(express.json());

const PORT = 3003;
const SUBBOT_NUMBER = process.env.NUMBER || "default-number";

function generateLinkingCode() {
  return randomBytes(8).toString("hex").toUpperCase(); // e.g., A1B2C3D4E5F6G7H8
}

async function startSubbot() {
  const { state, saveCreds } = await useMultiFileAuthState(`auth_subbot_${SUBBOT_NUMBER}`);
  const logger = pino({ level: "silent" });

  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true,
  });

  let linkingCode = null;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`Escanea el código QR para autenticar el subbot de ${SUBBOT_NUMBER}:`, qr);
    }

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Conexión cerrada:", lastDisconnect?.error?.message);
      if (shouldReconnect) {
        startSubbot();
      } else {
        console.log("Subbot desconectado permanentemente.");
        process.exit(1);
      }
    } else if (connection === "open") {
      console.log(`Subbot conectado para ${SUBBOT_NUMBER}`);
      linkingCode = generateLinkingCode();
      console.log(`Código de vinculación para ${SUBBOT_NUMBER}: ${linkingCode}`);

      // Opcional: Enviar confirmación al número del subbot
      await sock.sendMessage(`${SUBBOT_NUMBER.replace("+", "")}@s.whatsapp.net`, {
        text: `Tu subbot ha sido iniciado. Código de vinculación: ${linkingCode}`,
      }).catch((err) => console.error("Error al enviar al subbot:", err));
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Endpoint para que el bot principal obtenga el código
  app.post("/generate-linking-code", async (req, res) => {
    try {
      const { number } = req.body;
      if (!number || number !== SUBBOT_NUMBER) {
        return res.status(400).json({ error: "Número inválido o no coincide" });
      }
      if (!linkingCode) {
        return res.status(503).json({ error: "Subbot aún no está autenticado" });
      }
      res.status(200).json({
        message: `Código de vinculación generado para ${number}`,
        linkingCode,
      });
    } catch (error) {
      console.error("Error al generar el código:", error);
      res.status(500).json({ error: "Fallo al generar el código de vinculación" });
    }
  });

  // Iniciar el servidor Express
  app.listen(PORT, () => {
    console.log(`Subbot para ${SUBBOT_NUMBER} corriendo en el puerto ${PORT}`);
  });
}

startSubbot().catch((err) => {
  console.error("Error al iniciar subbot:", err);
  process.exit(1);
});
