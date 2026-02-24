export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { OrderStatus } from "@prisma/client";
import { isTerminal } from "@/domain/order";

// ─── GET /api/orders/[id]/stream (SSE) ───────────────────
// Streams order status updates via Server-Sent Events.
// Falls back to write model (orders table) if read model not yet populated.
// Closes automatically when the order reaches a terminal state.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const encoder = new TextEncoder();

  /** Resolve current status — prefer read model, fall back to write model */
  async function getCurrentStatus(): Promise<{ id: string; status: string } | null> {
    // Try CQRS read model first (populated by projection-consumer worker)
    const readOrder = await prisma.orderRead.findUnique({ where: { id: orderId } }).catch(() => null);
    if (readOrder) return { id: readOrder.id, status: readOrder.status as string };

    // Fall back to write model — always accurate, even without workers
    const writeOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    }).catch(() => null);
    if (writeOrder) return { id: writeOrder.id, status: writeOrder.status as string };

    return null;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch { /* controller may already be closed */ }
      };

      // Verify order exists (checking both models)
      const initial = await getCurrentStatus();
      if (!initial) {
        send({ error: "Order not found" });
        controller.close();
        return;
      }

      // Send initial state immediately so the UI shows "Live" straight away
      send({ orderId: initial.id, status: initial.status, timestamp: new Date().toISOString() });

      if (isTerminal(initial.status as OrderStatus)) {
        controller.close();
        return;
      }

      // Poll every 2 seconds — cheap since only active orders hold a connection
      let lastStatus = initial.status;
      const interval = setInterval(async () => {
        try {
          const current = await getCurrentStatus();
          if (!current) {
            clearInterval(interval);
            controller.close();
            return;
          }

          // Only emit when status actually changes (reduces noise)
          if (current.status !== lastStatus) {
            lastStatus = current.status;
            send({ orderId: current.id, status: current.status, timestamp: new Date().toISOString() });
          }

          if (isTerminal(current.status as OrderStatus)) {
            clearInterval(interval);
            controller.close();
          }
        } catch (err) {
          logger.error({ err, orderId }, "SSE poll error");
          clearInterval(interval);
          controller.close();
        }
      }, 2000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
