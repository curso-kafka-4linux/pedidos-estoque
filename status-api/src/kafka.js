import { Kafka, logLevel } from "kafkajs";

const brokers = (process.env.KAFKA_BOOTSTRAP_SERVERS || "localhost:9092")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export const ORDERS_TOPIC = process.env.ORDERS_TOPIC || "orders.v1";
export const STATUS_TOPIC = process.env.STATUS_TOPIC || "order_status.v1";
export const GROUP_ID = process.env.GROUP_ID || "status-api-v1";

export function buildKafka() {
  return new Kafka({
    clientId: "status-api",
    brokers,
    logLevel: logLevel.NOTHING
  });
}
