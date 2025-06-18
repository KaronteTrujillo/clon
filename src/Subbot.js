const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const { randomBytes } = require("crypto");
const pino = require("pino");

class Subbot {
  constructor({ number, port, onStatusUpdate }) {
    this.number = number;
    this.port = port;
    this.onStatusUpdate = onStatusUpdate;
    this.app = express();
    this.app.use(express.json());
    this.status = "initializing";
    this.linkingCode = null;
    this.error = null;
    this.sock = null;
  }

  async start() {
    try {
      console.log(`Iniciando subbot para ${this.number} en puerto ${this.port}`);
      const { state, saveCreds } = await useMultiFileAuthState(`auth_subbot_${this.number}`);
      const logger = pino({ level: "silent" });

      this.sock = makeWASocket({ auth: state, logger });

      this.sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = "authenticating";
          this.onStatusUpdate({ status: this.status, qr });
          console.log(`Código QR para ${this.number}:\n${qr}`);
        }

        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          this.error = lastDisconnect?.error?.message || "Desconexión desconocida";
          this.status = "disconnected";
          this.onStatusUpdate({ status: this.status, error: this.error, statusCode });

          if (statusCode !== DisconnectReason.loggedOut) {
            console.log(`Reintentando conexión para ${this.number}`);
            this.start();
          } else {
            console.log(`Subbot ${this.number} desconectado permanentemente`);
          }
        } else if (connection === "open") {
          this.status = "connected";
          this.linkingCode = this.linkingCode || randomBytes(8).toString("hex").toUpperCase();
          this.onStatusUpdate({ status: this.status, linkingCode: this.linkingCode });
          console.log(`Subbot ${this.number} conectado, código: ${this.linkingCode}`);
        }
      });

      this.sock.ev.on("creds.update", saveCreds);

      // Endpoint para el código de vinculación
      this.app.get("/linking-code", (req, res) => {
        if (!this.linkingCode) {
          return res.status(503).json({ error: "Subbot no autenticado" });
        }
        res.json({ number: this.number, linkingCode: this.linkingCode });
      });

      // Iniciar servidor HTTP
      await new Promise((resolve) => {
        this.server = this.app.listen(this.port, () => {
          console.log(`Subbot ${this.number} corriendo en puerto ${this.port}`);
          resolve();
        });
      });

    } catch (error) {
      this.status = "error";
      this.error = error.message;
      this.onStatusUpdate({ status: this.status, error: this.error });
      throw error;
    }
  }

  async stop() {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.status = "stopped";
    this.onStatusUpdate({ status: this.status });
  }
}

module.exports = Subbot;
