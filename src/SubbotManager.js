const Subbot = require("./Subbot");
const WebServer = require("./WebServer");
const { findFreePort, normalizePhoneNumber } = require("./utils");

class SubbotManager {
  constructor({ basePort = 3000, webhookUrl = null }) {
    this.subbots = new Map(); // Almacena subbots por número
    this.basePort = basePort;
    this.webhookUrl = webhookUrl; // URL del bot principal para notificaciones
    this.webServer = new WebServer({ manager: this, port: basePort });
  }

  async startSubbot(number) {
    const normalizedNumber = normalizePhoneNumber(number);
    if (!normalizedNumber) {
      throw new Error("Número inválido");
    }

    if (this.subbots.has(normalizedNumber)) {
      throw new Error(`Subbot para ${normalizedNumber} ya existe`);
    }

    const port = await findFreePort(this.basePort + 1);
    const subbot = new Subbot({
      number: normalizedNumber,
      port,
      onStatusUpdate: (status) => this.handleStatusUpdate(normalizedNumber, status),
    });

    await subbot.start();
    this.subbots.set(normalizedNumber, subbot);

    return { number: normalizedNumber, port, linkingCode: subbot.linkingCode };
  }

  async stopSubbot(number) {
    const normalizedNumber = normalizePhoneNumber(number);
    const subbot = this.subbots.get(normalizedNumber);
    if (!subbot) {
      throw new Error(`Subbot para ${normalizedNumber} no existe`);
    }

    await subbot.stop();
    this.subbots.delete(normalizedNumber);
  }

  getSubbotStatus(number) {
    const normalizedNumber = normalizePhoneNumber(number);
    const subbot = this.subbots.get(normalizedNumber);
    if (!subbot) {
      return null;
    }
    return {
      number: normalizedNumber,
      status: subbot.status,
      linkingCode: subbot.linkingCode,
      port: subbot.port,
      error: subbot.error,
    };
  }

  getAllSubbots() {
    return Array.from(this.subbots.entries()).map(([number, subbot]) => ({
      number,
      status: subbot.status,
      linkingCode: subbot.linkingCode,
      port: subbot.port,
      error: subbot.error,
    }));
  }

  async handleStatusUpdate(number, status) {
    console.log(`Estado actualizado para ${number}: ${status.status}`);
    if (this.webhookUrl) {
      try {
        const axios = require("axios");
        await axios.post(this.webhookUrl, { number, ...status });
      } catch (error) {
        console.error(`Error al enviar webhook para ${number}:`, error.message);
      }
    }
  }

  async startWebServer() {
    await this.webServer.start();
  }
}

module.exports = SubbotManager;
