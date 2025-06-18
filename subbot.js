const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const { randomBytes } = require("crypto");
const pino = require("pino");

const app = express();
app.use(express.json());

const PORT = 3003;
const SUBBOT_NUMBER = process.env.NUMBER || "default-number";
console.log(`SUBBOT_NUMBER inicializado como: ${SUBBOT_NUMBER}`); // Depuración

function generateLinkingCode() {
  return randomBytes(8).toString("hex").toUpperCase(); // e.g., A1B2C3D4E5F6G7H8
}

async function startSubbot() {
  console.log(`Iniciando subbot para ${SUBBOT_NUMBER}`);
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
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`Conexión cerrada. StatusCode: ${statusCode}, Error: ${lastDisconnect?.error?.message}`);
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("Intentando reconectar...");
        startSubbot();
      } else {
        console.log("Subbot desconectado permanentemente (logged out).");
        // No salir, mantener el servidor HTTP activo
        // process.exit(1);
      }
    } else if (connection === "open") {
      console.log(`Subbot conectado exitosamente para ${SUBBOT_NUMBER}`);
      linkingCode = generateLinkingCode();
      console.log(`Código de vinculación generado: ${linkingCode}`);

      // Opcional: Enviar confirmación al número del subbot
      await sock.sendMessage(`${SUBBOT_NUMBER.replace("+", "")}@s.whatsapp.net`, {
        text: `Tu subbot ha sido iniciado. Código de vinculación: ${linkingCode}`,
      }).catch((err) => console.error("Error al enviar confirmación al subbot:", err));
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Endpoint para el bot principal
  app.post("/generate-linking-code", async (req, res) => {
    try {
      const { number } = req.body;
      console.log(`Solicitud recibida con número: ${number}, SUBBOT_NUMBER: ${SUBBOT_NUMBER}`); // Depuración
      if (!number || number !== SUBBOT_NUMBER) {
        console.log(`Error: Número inválido o no coincide. Enviado: ${number}, Esperado: ${SUBBOT_NUMBER}`);
        return res.status(400).json({ error: "Número inválido o no coincide" });
      }
      if (!linkingCode) {
        console.log("Error: Subbot aún no está autenticado, no hay linkingCode");
        return res.status(503).json({ error: "Subbot aún no está autenticado, intenta de nuevo en unos segundos" });
      }
      console.log(`Enviando código de vinculación: ${linkingCode}`);
      res.status(200).json({
        message: `Código de vinculación generado para ${number}`,
        linkingCode,
      });
    } catch (error) {
      console.error("Error en /generate-linking-code:", error);
      res.status(500).json({ error: "Fallo al generar el código de vinculación" });
    }
  });

  app.listen(PORT, () => {
    console.log(`Subbot para ${SUBBOT_NUMBER} corriendo en el puerto ${PORT}`);
  });
}

startSubbot().catch((err) => {
  console.error("Error crítico al iniciar subbot:", err);
  // No salir, mantener el servidor HTTP activo
  // process.exit(1);
});
