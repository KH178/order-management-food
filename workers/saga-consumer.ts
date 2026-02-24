#!/usr/bin/env ts-node
/**
 * Saga Consumer: Orchestrates the order fulfillment flow (Payment -> Inventory).
 */

import { PrismaClient, SagaStep, OrderStatus } from "@prisma/client";
import { Kafka, Partitioners, Producer } from "kafkajs";
import pino from "pino";
import { v4 as uuidv4 } from "uuid";
import type { DomainEvent } from "../domain/events";
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
  clientId: "saga-consumer",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  ...connectionConfig,
  retry: { retries: 8 },
});

const consumer = kafka.consumer({
  groupId: (process.env.KAFKA_GROUP_ID_SAGA || "saga-service") + "-v2",
});

let producer: Producer;



async function emitEvent(
  topic: string,
  orderId: string,
  type: string,
  payload: object,
  correlationId: string
) {
  const event = {
    eventId: uuidv4(),
    orderId,
    correlationId,
    timestamp: new Date().toISOString(),
    type,
    version: 0,
    payload,
  };

  await producer.send({
    topic,
    messages: [{ key: orderId, value: JSON.stringify(event) }],
  });

  // Emit to orders.events for the projection consumer
  await producer.send({
    topic: "orders.events",
    messages: [{ key: orderId, value: JSON.stringify(event) }],
  });

  return event;
}

async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await prisma.order.update({ where: { id: orderId }, data: { status } });
}



async function processPayment(
  orderId: string,
  correlationId: string
): Promise<"PAYMENT_CONFIRMED" | "PAYMENT_FAILED"> {
  // Simulate logic, 10% failure rate
  const success = Math.random() > 0.1;

  if (success) {
    const txId = uuidv4();
    await emitEvent("orders.saga", orderId, "PAYMENT_CONFIRMED", { transactionId: txId }, correlationId);
    return "PAYMENT_CONFIRMED";
  } else {
    await emitEvent("orders.saga", orderId, "PAYMENT_FAILED", { reason: "Payment gateway declined" }, correlationId);
    return "PAYMENT_FAILED";
  }
}

async function reserveInventory(
  orderId: string,
  correlationId: string
): Promise<"INVENTORY_RESERVED" | "INVENTORY_FAILED"> {
  // Simulate logic
  const success = Math.random() > 0.05;

  if (success) {
    const reservationId = uuidv4();
    await emitEvent("orders.saga", orderId, "INVENTORY_RESERVED", { reservationId }, correlationId);
    return "INVENTORY_RESERVED";
  } else {
    await emitEvent("orders.saga", orderId, "INVENTORY_FAILED", { reason: "Insufficient stock" }, correlationId);
    return "INVENTORY_FAILED";
  }
}

async function compensate(orderId: string, correlationId: string, reason: string) {
  // Compensating transaction: order cancellation
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });

    const eventCount = await tx.orderEvent.count({ where: { orderId } });
    await tx.orderEvent.create({
      data: {
        id: uuidv4(),
        orderId,
        correlationId,
        type: "ORDER_CANCELLED",
        payload: { reason } as object,
        version: eventCount + 1,
      },
    });

    await tx.outbox.create({
      data: {
        orderId,
        eventType: "ORDER_CANCELLED",
        payload: {
          eventId: uuidv4(),
          orderId,
          correlationId,
          timestamp: new Date().toISOString(),
          type: "ORDER_CANCELLED",
          version: eventCount + 1,
          payload: { reason },
        } as object,
      },
    });

    await tx.sagaInstance.update({
      where: { orderId },
      data: { status: "FAILED", currentStep: "FAILED" },
    });
  });

  logger.info({ orderId, reason }, "Compensating transaction applied — order cancelled");
}



// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSagaEvent(event: DomainEvent<any>) {
  const { orderId, type, correlationId, eventId } = event;

  // Idempotency check
  const saga = await prisma.sagaInstance.findUnique({ where: { orderId } });
  if (saga?.lastEventId === eventId) {
    logger.info({ eventId, orderId }, "Duplicate saga event — skipping");
    return;
  }

  switch (type) {
    case "ORDER_CREATED": {
      await prisma.sagaInstance.upsert({
        where: { orderId },
        create: { orderId, currentStep: "PAYMENT_PROCESSING", status: "RUNNING", lastEventId: eventId },
        update: { currentStep: "PAYMENT_PROCESSING", lastEventId: eventId },
      });

      await updateOrderStatus(orderId, "PAYMENT_PROCESSING");
      const result = await processPayment(orderId, correlationId);
      logger.info({ orderId, result }, "Payment processed");
      break;
    }

    case "PAYMENT_CONFIRMED": {
      await prisma.sagaInstance.update({
        where: { orderId },
        data: { currentStep: "INVENTORY_PENDING", lastEventId: eventId },
      });
      await updateOrderStatus(orderId, "PAYMENT_CONFIRMED");

      const result = await reserveInventory(orderId, correlationId);
      logger.info({ orderId, result }, "Inventory reservation result");
      break;
    }

    case "INVENTORY_RESERVED": {
      await prisma.$transaction(async (tx) => {
        await tx.sagaInstance.update({
          where: { orderId },
          data: { currentStep: "COMPLETED", status: "COMPLETED", lastEventId: eventId },
        });
        await tx.order.update({ where: { id: orderId }, data: { status: "PREPARING" } });
      });
      logger.info({ orderId }, "Saga completed successfully — order PREPARING. Waiting for manual restaurant/driver app update.");
      break;
    }

    case "PAYMENT_FAILED": {
      await prisma.sagaInstance.update({
        where: { orderId },
        data: { currentStep: "COMPENSATING", lastEventId: eventId },
      });
      await compensate(orderId, correlationId, "Payment failed");
      break;
    }

    case "INVENTORY_FAILED": {
      await prisma.sagaInstance.update({
        where: { orderId },
        data: { currentStep: "COMPENSATING", lastEventId: eventId },
      });
      await compensate(orderId, correlationId, "Inventory reservation failed");
      break;
    }

    default:
      logger.debug({ type, orderId }, "Unhandled saga event type");
  }
}



async function main() {
  await ensureTopics();
  producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: "orders.saga", fromBeginning: true });
  await consumer.subscribe({ topic: "orders.events", fromBeginning: true });

  logger.info("Saga consumer started and subscribed to orders.saga & orders.events");

  await consumer.run({
    eachMessage: async ({ message, topic }) => {
      logger.info({ topic }, "Saga consumer received a message");
      if (!message.value) {
         logger.warn("Message value was empty");
         return;
      }

      let event: DomainEvent;
      try {
        event = JSON.parse(message.value.toString());
      } catch {
        logger.error("Failed to parse saga Kafka message");
        return;
      }

      try {
        await handleSagaEvent(event);
      } catch (err) {
        logger.error({ err, eventId: event.eventId }, "Saga consumer error");
        // DLQ fallback
        await producer.send({
          topic: "orders.deadletter",
          messages: [{ key: event.orderId, value: JSON.stringify({ event, error: String(err) }) }],
        });
      }
    },
  });
}

main().catch((err) => {
  logger.error(err, "Fatal error in saga consumer");
  process.exit(1);
});
