const express = require("express");
const path = require("path");

class WebServer {
  constructor({ manager, port }) {
    this.app = express();
    this.manager = manager;
    this.port = port;
  }

  async start() {
    this.app.use(express.static(path.join(__dirname, "public")));
    this.app.use(express.json());

    // Endpoint para la lista de subbots
    this.app.get("/api/subbots", (req, res) => {
      res.json(this.manager.getAllSubbots());
    });

    // Endpoint para iniciar un subbot
    this.app.post("/api/subbots", async (req, res) => {
      try {
        const { number } = req.body;
        const result = await this.manager.startSubbot(number);
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Endpoint para detener un subbot
    this.app.delete("/api/subbots/:number", async (req, res) => {
      try {
        await this.manager.stopSubbot(req.params.number);
        res.json({ message: `Subbot ${req.params.number} detenido` });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    await new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`Interfaz web corriendo en http://localhost:${this.port}`);
        resolve();
      });
    });
  }
}

module.exports = WebServer;
