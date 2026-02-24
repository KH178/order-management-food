// Domain Event Types

export type EventType =
  | "ORDER_CREATED"
  | "ORDER_STATUS_UPDATED"
  | "ORDER_CANCELLED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_FAILED"
  | "INVENTORY_RESERVED"
  | "INVENTORY_FAILED";



export interface DomainEvent<T = Record<string, unknown>> {
  eventId: string;
  orderId: string;
  correlationId: string;
  timestamp: string; // ISO8601
  type: EventType;
  version: number;
  payload: T;
}



export interface OrderCreatedPayload {
  customerId: string;
  totalAmount: number;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export interface OrderStatusUpdatedPayload {
  previousStatus: string;
  newStatus: string;
}

export interface OrderCancelledPayload {
  reason?: string;
}

export interface PaymentConfirmedPayload {
  transactionId: string;
  amount: number;
}

export interface PaymentFailedPayload {
  reason: string;
}

export interface InventoryReservedPayload {
  reservationId: string;
}

export interface InventoryFailedPayload {
  reason: string;
}



import { v4 as uuidv4 } from "uuid";

export function createEvent<T>(
  type: EventType,
  orderId: string,
  payload: T,
  version: number,
  correlationId?: string
): DomainEvent<T> {
  return {
    eventId: uuidv4(),
    orderId,
    correlationId: correlationId ?? uuidv4(),
    timestamp: new Date().toISOString(),
    type,
    version,
    payload,
  };
}
