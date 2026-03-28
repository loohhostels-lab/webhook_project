import express from "express";
import { verifyWebhook, handleWebhook } from "../controller/webhookController.js";

const router = express.Router();

router.get("/", verifyWebhook);
router.post("/", handleWebhook);

export default router;

