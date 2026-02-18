import express from "express";
import { nanoid } from "nanoid";
import { buildKafka, ORDERS_TOPIC } from "./kafka.js";

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const port = Number(argValue("--port") || process.env.PORT || 8081);

const app = express();
app.use(express.json());

const kafka = buildKafka();
const producer = kafka.producer();
const ACKS = Number(process.env.PRODUCER_ACKS ?? "1");

let produced = 0;

app.get("/health", (_req, res) => res.json({ ok: true, produced, topic: ORDERS_TOPIC }));

app.post("/orders", async (req, res) => {
  const now = new Date().toISOString();
  const orderId = req.body?.orderId || nanoid(10);
  const customerId = req.body?.customerId || `c-${Math.floor(Math.random() * 1000)}`;
  const total = Number(req.body?.total ?? (Math.random() * 500 + 10).toFixed(2));

  const event = {
    eventType: "OrderCreated",
    orderId,
    customerId,
    total,
    createdAt: now
  };

  // Aula 03: simples (sem key). Aula 05: key=orderId/customerId.
  await producer.send({
    topic: ORDERS_TOPIC,
    messages: [{ key: String(customerId), value: JSON.stringify(event) }],
    acks: ACKS
  });

  produced++;
  res.status(201).json({ ok: true, event });
});

async function main() {
  await producer.connect();
  app.listen(port, "0.0.0.0", () => {
    console.log(`[orders-api] up on :${port} | topic=${ORDERS_TOPIC}`);
  });
}

main().catch(err => {
  console.error("[orders-api] fatal:", err);
  process.exit(1);
});
