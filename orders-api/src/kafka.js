import { Kafka, logLevel } from "kafkajs";

const brokers = (process.env.KAFKA_BOOTSTRAP_SERVERS || "localhost:9092")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export const ORDERS_TOPIC = process.env.ORDERS_TOPIC || "orders.v1";

export function buildKafka() {
  return new Kafka({
    clientId: "orders-api",
    brokers,
    logLevel: logLevel.NOTHING
  });
}
