export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { createEvent } from "@/domain/events";

const CancelSchema = z.object({
  reason: z.string().optional(),
});

// ─── POST /api/orders/[id]/cancel ─────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  let body: unknown = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    // empty body is fine
  }

  const { reason } = CancelSchema.parse(body);
  const correlationId = uuidv4();

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const TERMINAL = ["DELIVERED", "CANCELLED"];
    if (TERMINAL.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot cancel an order with status ${order.status}` },
        { status: 409 }
      );
    }

    // Get next version
    const eventCount = await prisma.orderEvent.count({ where: { orderId } });
    const version = eventCount + 1;

    const payload = { reason: reason ?? "Cancelled by user" };
    const event = createEvent("ORDER_CANCELLED", orderId, payload, version, correlationId);

    await prisma.$transaction(async (tx) => {
      // Update write model
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
      });

      // Append to event store
      await tx.orderEvent.create({
        data: {
          id: event.eventId,
          orderId,
          correlationId,
          type: event.type,
          payload: payload as object,
          version,
        },
      });

      // Outbox
      await tx.outbox.create({
        data: { orderId, eventType: event.type, payload: event as object },
      });
    });

    logger.info({ orderId, correlationId, reason }, "Order cancelled");

    return NextResponse.json({ orderId, status: "CANCELLED", correlationId });
  } catch (err) {
    logger.error({ err, orderId }, "Failed to cancel order");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
