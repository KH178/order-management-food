#!/usr/bin/env ts-node
/**
 * Projection Consumer: Maintains the denormalized read model (orders_read + order_items_read).
 */

import { PrismaClient, OrderStatus } from "@prisma/client";
import { Kafka } from "kafkajs";
import pino from "pino";
import type { DomainEvent, OrderCreatedPayload, OrderStatusUpdatedPayload } from "../domain/events";
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
  clientId: "projection-consumer",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  ...connectionConfig,
  retry: { retries: 8 },
});

const consumer = kafka.consumer({
  groupId: (process.env.KAFKA_GROUP_ID_PROJECTION || "projection-service") + "-v2",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleEvent(event: DomainEvent<any>) {
  const { orderId, type, payload } = event;

  switch (type) {
    case "ORDER_CREATED": {
      const p = payload as OrderCreatedPayload;
      await prisma.$transaction(async (tx) => {

        await tx.orderRead.upsert({
          where: { id: orderId },
          create: {
            id: orderId,
            customerId: p.customerId,
            status: "PENDING",
            totalAmount: p.totalAmount,
            itemCount: p.items.length,
            itemsSummary: p.items as object,
            createdAt: new Date(event.timestamp),
            updatedAt: new Date(event.timestamp),
          },
          update: {},
        });


        for (const item of p.items) {
          const itemId = `${orderId}_${item.productId}`;
          await tx.orderItemRead.upsert({
            where: { id: itemId },
            create: {
              id: itemId,
              orderId,
              productId: item.productId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.price * item.quantity,
            },
            update: {},
          });
        }
      });
      break;
    }

    case "ORDER_STATUS_UPDATED":
    case "ORDER_CANCELLED":
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_FAILED":
    case "INVENTORY_RESERVED":
    case "INVENTORY_FAILED": {
      const statusMap: Record<string, OrderStatus> = {
        ORDER_STATUS_UPDATED: (payload as OrderStatusUpdatedPayload).newStatus as OrderStatus,
        ORDER_CANCELLED: "CANCELLED",
        PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
        PAYMENT_FAILED: "CANCELLED",
        INVENTORY_RESERVED: "PREPARING",
        INVENTORY_FAILED: "CANCELLED",
      };
      const newStatus = statusMap[type];
      if (newStatus) {
        await prisma.orderRead.updateMany({
          where: { id: orderId },
          data: { status: newStatus, updatedAt: new Date(event.timestamp) },
        });
      }
      break;
    }

    default:
      logger.warn({ type, orderId }, "Unknown event type — skipping");
  }
}

async function main() {
  await ensureTopics();
  await consumer.connect();
  await consumer.subscribe({ topic: "orders.events", fromBeginning: true });

  logger.info("Projection consumer started");

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let event: DomainEvent;
      try {
        event = JSON.parse(message.value.toString());
      } catch {
        logger.error("Failed to parse Kafka message");
        return;
      }

      try {
        await handleEvent(event);
        logger.info({ eventId: event.eventId, type: event.type, orderId: event.orderId }, "Projection updated");
      } catch (err) {
        logger.error({ err, event }, "Projection consumer error");
        // TODO: DLQ fallback
      }
    },
  });
}

main().catch((err) => {
  logger.error(err, "Fatal error in projection consumer");
  process.exit(1);
});
