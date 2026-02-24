#!/usr/bin/env ts-node
/**
 * Outbox Processor: Polls the outbox table and emits events to Kafka.
 */
import pino from "pino";
import { PrismaClient } from "@prisma/client";
import { Kafka, Partitioners, Producer } from "kafkajs";
import { ensureTopics } from "../lib/kafka";
import fs from "fs";
import path from "path";

const logger = pino({ level: "info" });
const prisma = new PrismaClient();

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

const kafka = new Kafka({
  clientId: "outbox-processor",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  ...connectionConfig,
  retry: { retries: 8 },
});

let producer: Producer;

const TOPIC_MAP: Record<string, string> = {
  ORDER_CREATED: "orders.events",
  ORDER_STATUS_UPDATED: "orders.events",
  ORDER_CANCELLED: "orders.events",
  PAYMENT_CONFIRMED: "orders.saga",
  PAYMENT_FAILED: "orders.saga",
  INVENTORY_RESERVED: "orders.saga",
  INVENTORY_FAILED: "orders.saga",
};

async function processOutbox() {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; orderId: string; eventType: string; payload: string }>
  >`
    SELECT id, "orderId", "eventType", payload::text
    FROM outbox
    WHERE published = false
    ORDER BY "createdAt" ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  `;

  if (rows.length > 0) {
    logger.info({ count: rows.length }, "Found unpublished rows in outbox. Preparing to send to Kafka...");
  } else {
    return;
  }

  const messages = rows.map((row: { id: string; orderId: string; eventType: string; payload: string }) => ({
    topic: TOPIC_MAP[row.eventType] || "orders.events",
    messages: [
      {
        key: row.orderId,
        value: typeof row.payload === "string" ? row.payload : JSON.stringify(row.payload),
      },
    ],
  }));


  for (const { topic, messages: msgs } of messages) {
    await producer.send({ topic, messages: msgs });
  }


  const ids = rows.map((r: { id: string }) => r.id);
  await prisma.outbox.updateMany({
    where: { id: { in: ids } },
    data: { published: true, publishedAt: new Date() },
  });

  logger.info({ count: rows.length }, "Outbox events published to Kafka");
}

async function main() {
  await ensureTopics();
  producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });
  await producer.connect();
  logger.info("Outbox processor started. Polling every 500ms...");


  while (true) {
    try {
      const start = Date.now();
      await processOutbox();
      if (Date.now() - start > 100) logger.debug("Outbox processed a batch");
    } catch (err) {
      logger.error({ err }, "Outbox processing error");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

main().catch((err) => {
  logger.error(err, "Fatal error in outbox processor");
  process.exit(1);
});
