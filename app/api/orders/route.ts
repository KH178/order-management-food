export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { createEvent } from "@/domain/events";
import type { OrderCreatedPayload } from "@/domain/events";


const CreateOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        name: z.string().min(1),
        price: z.number().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});


export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { customerId, items } = parsed.data;
  const orderId = uuidv4();
  const correlationId = uuidv4();
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const version = 1;

  const payload: OrderCreatedPayload = { customerId, totalAmount, items };
  const event = createEvent("ORDER_CREATED", orderId, payload, version, correlationId);

  try {
    // Atomic transaction
    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          id: orderId,
          customerId,
          totalAmount,
          status: "PENDING",
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })),
          },
        },
      });

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

      await tx.outbox.create({
        data: {
          orderId,
          eventType: event.type,
          payload: event as object,
        },
      });
    });

    logger.info({ orderId, correlationId }, "Order created");

    return NextResponse.json(
      { orderId, status: "PENDING", correlationId, totalAmount },
      { status: 201 }
    );
  } catch (err) {
    logger.error({ err, orderId }, "Failed to create order");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "20", 10));
  const skip = (page - 1) * limit;

  try {
    const [orders, total] = await Promise.all([
      prisma.orderRead.findMany({
        where: status ? { status: status as never } : undefined,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.orderRead.count({
        where: status ? { status: status as never } : undefined,
      }),
    ]);

    return NextResponse.json({
      data: orders,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error({ err }, "Failed to list orders");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
