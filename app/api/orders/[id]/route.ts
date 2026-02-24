export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

// ─── GET /api/orders/[id] ─────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const order = await prisma.orderRead.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (err) {
    logger.error({ err, orderId: id }, "Failed to fetch order");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
