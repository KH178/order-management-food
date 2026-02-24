import { Kafka, Partitioners } from "kafkajs";

import fs from "fs";
import path from "path";

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

const caPath = path.join(process.cwd(), "ca.pem");
const certPath = path.join(process.cwd(), "cert.pem");
const keyPath = path.join(process.cwd(), "key.pem");

const ca = fs.existsSync(caPath) ? fs.readFileSync(caPath, "utf-8") : undefined;
const cert = fs.existsSync(certPath) ? fs.readFileSync(certPath, "utf-8") : undefined;
const key = fs.existsSync(keyPath) ? fs.readFileSync(keyPath, "utf-8") : undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connectionConfig: any = {};
if (cert && key) {
  connectionConfig = {
    ssl: { rejectUnauthorized: false, ca: ca ? [ca] : undefined, cert, key },
  };
} else if (process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD) {
  connectionConfig = {
    ssl: { rejectUnauthorized: false, ca: ca ? [ca] : undefined },
    sasl: { mechanism: "plain", username: process.env.KAFKA_USERNAME, password: process.env.KAFKA_PASSWORD },
  };
}

export const kafka = new Kafka({
  clientId: "oms-service",
  brokers,
  ...connectionConfig,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

export const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});


export const TOPICS = {
  EVENTS: "orders.events",
  SAGA: "orders.saga",
  STATUS: "orders.status",
  DEAD_LETTER: "orders.deadletter",
} as const;


export async function ensureTopics() {
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: Object.values(TOPICS).map((topic) => ({
      topic,
      numPartitions: 1, // Note: Free tier Upstash usually prefers 1 partition
      replicationFactor: 1,
    })),
  });
  await admin.disconnect();
}
