import { OrderStatus } from "@prisma/client";
import { DomainEvent, OrderCreatedPayload, OrderStatusUpdatedPayload } from "./events";

// ─────────────────────────────────────────────────────────
// Order Aggregate State
// ─────────────────────────────────────────────────────────

export interface OrderState {
  id: string;
  customerId: string;
  status: OrderStatus;
  totalAmount: number;
  version: number;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

// ─── Apply a single event to aggregate state ────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyEvent(state: Partial<OrderState>, event: DomainEvent<any>): OrderState {
  const current = state as OrderState;

  switch (event.type) {
    case "ORDER_CREATED": {
      const payload = event.payload as OrderCreatedPayload;
      return {
        id: event.orderId,
        customerId: payload.customerId,
        status: "PENDING",
        totalAmount: payload.totalAmount,
        version: event.version,
        items: payload.items,
      };
    }

    case "ORDER_STATUS_UPDATED": {
      const payload = event.payload as OrderStatusUpdatedPayload;
      return {
        ...current,
        status: payload.newStatus as OrderStatus,
        version: event.version,
      };
    }

    case "ORDER_CANCELLED": {
      return {
        ...current,
        status: "CANCELLED",
        version: event.version,
      };
    }

    case "PAYMENT_CONFIRMED": {
      return {
        ...current,
        status: "PAYMENT_CONFIRMED",
        version: event.version,
      };
    }

    case "PAYMENT_FAILED": {
      return {
        ...current,
        status: "CANCELLED",
        version: event.version,
      };
    }

    case "INVENTORY_RESERVED": {
      return {
        ...current,
        status: "PREPARING",
        version: event.version,
      };
    }

    default:
      return current;
  }
}

// ─── Rebuild aggregate from event history ────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rehydrateOrder(events: DomainEvent<any>[]): OrderState | null {
  if (events.length === 0) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return events.reduce<any>((state, event) => applyEvent(state, event), {});
}

// ─── Terminal states ─────────────────────────────────────

export const TERMINAL_STATES: OrderStatus[] = ["DELIVERED", "CANCELLED"];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATES.includes(status);
}
