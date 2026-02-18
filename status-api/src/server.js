import express from "express";
import { buildKafka, ORDERS_TOPIC, STATUS_TOPIC, GROUP_ID } from "./kafka.js";

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const port = Number(argValue("--port") || process.env.PORT || 8082);

const app = express();
app.use(express.json());

const kafka = buildKafka();
const consumer = kafka.consumer({ groupId: GROUP_ID });
const producer = kafka.producer();

const state = new Map(); // orderId -> lastStatus
let consumed = 0;
let produced = 0;

app.get("/health", (_req, res) => {
  res.json({ ok: true, consumed, produced, cached: state.size, groupId: GROUP_ID });
});

app.get("/status/:orderId", (req, res) => {
  const s = state.get(req.params.orderId);
  if (!s) return res.status(404).json({ ok: false, error: "not_found" });
  res.json({ ok: true, status: s });
});

async function startStream() {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: ORDERS_TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const raw = message.value?.toString("utf-8") || "{}";
      let order;
      try { order = JSON.parse(raw); } catch { order = { raw }; }

      const orderId = order.orderId || "unknown";
      const statusEvent = {
        eventType: "OrderStatusUpdated",
        orderId,
        status: "RECEIVED",
        at: new Date().toISOString()
      };

      state.set(orderId, statusEvent);
      consumed++;

      await producer.send({
        topic: STATUS_TOPIC,
        messages: [{ value: JSON.stringify(statusEvent) }]
      });
      produced++;
    }
  });

  console.log(`[status-api] consuming ${ORDERS_TOPIC} -> producing ${STATUS_TOPIC} | group=${GROUP_ID}`);
}

async function main() {
  startStream().catch(err => {
    console.error("[status-api] stream fatal:", err);
    process.exit(1);
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`[status-api] up on :${port}`);
  });
}

main().catch(err => {
  console.error("[status-api] fatal:", err);
  process.exit(1);
});
