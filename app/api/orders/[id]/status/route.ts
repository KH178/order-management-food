export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { createEvent, OrderStatusUpdatedPayload } from "@/domain/events";
import { OrderStatus } from "@prisma/client";
import { isTerminal } from "@/domain/order";

const UpdateStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "PAYMENT_PROCESSING",
    "PAYMENT_CONFIRMED",
    "PREPARING",
    "READY",
    "DELIVERED",
    "CANCELLED",
  ]),
});

// ─── POST /api/orders/[id]/status ─────────────────────────
// Allows admin to manually transition an order's status
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { status: newStatus } = parsed.data;

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (isTerminal(order.status) || order.status === newStatus) {
      return NextResponse.json(
        { error: "Cannot transition from terminal state or to same state" },
        { status: 400 }
      );
    }

    const payload: OrderStatusUpdatedPayload = {
      previousStatus: order.status,
      newStatus,
    };
    const correlationId = uuidv4();
    const event = createEvent("ORDER_STATUS_UPDATED", orderId, payload, 1, correlationId);

    // Atomic transaction: update write model + event store + outbox
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus as OrderStatus },
      });

      await tx.orderEvent.create({
        data: {
          id: event.eventId,
          orderId,
          correlationId,
          type: event.type,
          payload: payload as object,
          version: 1, // Simplified versioning for manual updates
        },
      });

      await tx.outbox.create({
        data: {
          orderId,
          eventType: event.type,
          payload: event as object,
        },
      });
    });

    logger.info({ orderId, oldStatus: order.status, newStatus }, "Order status manually updated");

    return NextResponse.json({ success: true, newStatus });
  } catch (err) {
    logger.error({ err, orderId }, "Failed to update order status");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
