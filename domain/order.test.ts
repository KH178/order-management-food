import { OrderState, applyEvent } from "./order";
import { createEvent, OrderCreatedPayload, OrderStatusUpdatedPayload, PaymentFailedPayload } from "./events";

jest.mock("uuid", () => ({
  v4: () => "test-mock-uuid-123",
}));

describe("Order Domain - TDD Scenarios", () => {
  const orderId = "order-123";
  const customerId = "cust-1";
  const correlationId = "corr-1";
  let state: OrderState;

  beforeEach(() => {
    // Initial empty state before any events
    state = {
      id: orderId,
      customerId: "",
      status: "PENDING",
      totalAmount: 0,
      items: [],
      version: 0,
    };
  });

  describe("Scenario 1: Happy Path - Order Creation to Delivery", () => {
    it("should process ORDER_CREATED", () => {
      const payload: OrderCreatedPayload = {
        customerId,
        totalAmount: 50,
        items: [{ productId: "p1", name: "Burger", price: 25, quantity: 2 }],
      };
      const event = createEvent("ORDER_CREATED", orderId, payload, 1, correlationId);
      
      state = applyEvent(state, event);
      
      expect(state.id).toBe(orderId);
      expect(state.customerId).toBe(customerId);
      expect(state.status).toBe("PENDING");
      expect(state.totalAmount).toBe(50);
      expect(state.items.length).toBe(1);
      expect(state.version).toBe(1);
    });

    it("should process PAYMENT_CONFIRMED", () => {
      // First create
      state = applyEvent(state, createEvent("ORDER_CREATED", orderId, { customerId, totalAmount: 50, items: [] }, 1));
      
      // Then pay
      const event = createEvent("PAYMENT_CONFIRMED", orderId, { transactionId: "tx-1", amount: 50 }, 2);
      state = applyEvent(state, event);
      
      expect(state.status).toBe("PAYMENT_CONFIRMED");
      expect(state.version).toBe(2);
    });

    it("should process manual status updates (Admin panel)", () => {
      state = applyEvent(state, createEvent("ORDER_CREATED", orderId, { customerId, totalAmount: 50, items: [] }, 1));
      
      const preparePayload: OrderStatusUpdatedPayload = { previousStatus: "PENDING", newStatus: "PREPARING" };
      state = applyEvent(state, createEvent("ORDER_STATUS_UPDATED", orderId, preparePayload, 2));
      expect(state.status).toBe("PREPARING");

      const readyPayload: OrderStatusUpdatedPayload = { previousStatus: "PREPARING", newStatus: "READY" };
      state = applyEvent(state, createEvent("ORDER_STATUS_UPDATED", orderId, readyPayload, 3));
      expect(state.status).toBe("READY");

      const deliverPayload: OrderStatusUpdatedPayload = { previousStatus: "READY", newStatus: "DELIVERED" };
      state = applyEvent(state, createEvent("ORDER_STATUS_UPDATED", orderId, deliverPayload, 4));
      expect(state.status).toBe("DELIVERED");
      expect(state.version).toBe(4);
    });
  });

  describe("Scenario 2: Failed Payment (Compensation)", () => {
    it("should cancel the order when payment fails", () => {
      // 1. Create order
      state = applyEvent(state, createEvent("ORDER_CREATED", orderId, { customerId, totalAmount: 50, items: [] }, 1));
      
      // 2. Payment fails
      const payload: PaymentFailedPayload = { reason: "Insufficient funds" };
      const event = createEvent("PAYMENT_FAILED", orderId, payload, 2);
      
      state = applyEvent(state, event);
      
      expect(state.status).toBe("CANCELLED");
      expect(state.version).toBe(2);
    });
  });

  describe("Scenario 3: Validation Constraints (Pure Functions)", () => {
    it("should not allow status changes after delivery", () => {
      state = applyEvent(state, createEvent("ORDER_CREATED", orderId, { customerId, totalAmount: 50, items: [] }, 1));
      state = applyEvent(state, createEvent("ORDER_STATUS_UPDATED", orderId, { previousStatus: "PENDING", newStatus: "DELIVERED" }, 2));
      
      expect(state.status).toBe("DELIVERED"); // Terminal config state
    });
  });

  describe("Scenario 4: Failed Delivery", () => {
    it("should allow an order to be cancelled manually if delivery fails", () => {
      // 1. Order is created and goes through standard flow up to READY
      state = applyEvent(state, createEvent("ORDER_CREATED", orderId, { customerId, totalAmount: 50, items: [] }, 1));
      state = applyEvent(state, createEvent("PAYMENT_CONFIRMED", orderId, { transactionId: "tx-1", amount: 50 }, 2));
      state = applyEvent(state, createEvent("ORDER_STATUS_UPDATED", orderId, { previousStatus: "PAYMENT_CONFIRMED", newStatus: "PREPARING" }, 3));
      state = applyEvent(state, createEvent("ORDER_STATUS_UPDATED", orderId, { previousStatus: "PREPARING", newStatus: "READY" }, 4));
      
      expect(state.status).toBe("READY");

      // 2. Delivery partner cannot find the address, order is manually cancelled
      const cancelEvent = createEvent("ORDER_CANCELLED", orderId, { reason: "Customer uncontactable at delivery location" }, 5);
      state = applyEvent(state, cancelEvent);

      expect(state.status).toBe("CANCELLED");
      expect(state.version).toBe(5);
    });
  });
});
