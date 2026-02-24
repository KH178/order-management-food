"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../orders/page.module.css";
import adminStyles from "./admin.module.css";

const STATUS_ORDER = [
  "PENDING",
  "PAYMENT_PROCESSING",
  "PAYMENT_CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
];

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders?limit=50");
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3000); // Poll for updates
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (orderId: string, currentStatus: string, action: "next" | "cancel") => {
    try {
      if (action === "cancel") {
        if (!window.confirm(`Are you sure you want to cancel order #${orderId.split("-")[0]}?`)) {
          return;
        }
        const res = await fetch(`/api/orders/${orderId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Cancelled by admin" }),
        });

        if (res.ok) {
          setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" } : o)));
        } else {
          alert("Failed to cancel order");
        }
        return;
      }

      // Next status logic
      let newStatus = currentStatus;
      const currentIndex = STATUS_ORDER.indexOf(currentStatus);
      if (currentIndex < STATUS_ORDER.length - 1) {
        newStatus = STATUS_ORDER[currentIndex + 1];
      } else {
        return;
      }

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        // Optimistically update
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      } else {
        alert("Failed to update status");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating order");
    }
  };

  if (loading) {
    return (
      <div className={styles.root}>
        <div className="container" style={{ padding: "40px" }}>
          Loading Admin Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Link href="/" className={styles.logo}>FoodFlow <span style={{color: 'var(--color-gray-400)', fontSize: '14px', marginLeft: 8}}>ADMIN</span></Link>
          <Link href="/orders" className={styles.back}>Go to Consumer Tracking</Link>
        </div>
      </header>
      <main className="container" style={{ padding: "40px 0" }}>
        <h1 style={{ marginBottom: 24 }}>Restaurant Partner Dashboard</h1>
        <p style={{ color: "var(--color-gray-400)", marginBottom: 32 }}>
          Manage incoming orders and push them to the next stage.
        </p>

        <div className={adminStyles.tableContainer}>
          <table className={adminStyles.table}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isTerminal = order.status === "DELIVERED" || order.status === "CANCELLED";
                const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(order.status) + 1];

                return (
                  <tr key={order.id}>
                    <td>
                      <span className={adminStyles.orderId}>{order.id.split("-")[0]}</span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles["badge_" + order.status]}`}>
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{order.itemCount} items</td>
                    <td className={adminStyles.amount}>${order.totalAmount.toFixed(2)}</td>
                    <td>
                      <div className={adminStyles.actions}>
                        {!isTerminal ? (
                          <>
                            <button
                              onClick={() => updateStatus(order.id, order.status, "cancel")}
                              className={adminStyles.btnCancel}
                            >
                              Cancel
                            </button>
                            {nextStatus && (
                              <button
                                onClick={() => updateStatus(order.id, order.status, "next")}
                                className={adminStyles.btnNext}
                              >
                                {nextStatus.replace(/_/g, " ")} →
                              </button>
                            )}
                          </>
                        ) : (
                          <span className={adminStyles.terminalText}>Completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--z-muted)" }}>
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
