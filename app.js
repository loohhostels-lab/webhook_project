import express from "express";
import dotenv from "dotenv";
import webhookRoutes from "./routes/webhook.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/webhook", webhookRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));