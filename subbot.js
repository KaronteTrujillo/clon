const express = require("express");
const { randomBytes } = require("crypto");
const fs = require("fs").promises;
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const SUBBOT_NUMBER = process.env.NUMBER || "default-number";
const LINKING_CODE_PATH = path.resolve("linking-code.txt");

function generateLinkingCode() {
  return randomBytes(8).toString("hex").toUpperCase();
}

app.post("/generate-linking-code", async (req, res) => {
  try {
    const { number } = req.body;

    if (!number || number !== SUBBOT_NUMBER) {
      return res.status(400).json({ error: "Número inválido o no coincide" });
    }

    const linkingCode = generateLinkingCode();
    await fs.writeFile(LINKING_CODE_PATH, linkingCode);

    console.log(`Código de vinculación para ${number}: ${linkingCode}`);

    res.status(200).json({
      message: `Código de vinculación generado para ${number}`,
      linkingCode,
    });
  } catch (error) {
    console.error("Error al generar el código de vinculación:", error);
    res.status(500).json({ error: "Fallo al generar el código de vinculación" });
  }
});

app.get("/get-linking-code", async (req, res) => {
  try {
    const linkingCode = await fs.readFile(LINKING_CODE_PATH, "utf8");
    res.status(200).json({ linkingCode });
  } catch (error) {
    console.error("Error al recuperar el código de vinculación:", error);
    res.status(500).json({ error: "No se encontró el código de vinculación" });
  }
});

app.listen(PORT, () => {
  console.log(`Subbot para ${SUBBOT_NUMBER} corriendo en el puerto ${PORT}`);
});
