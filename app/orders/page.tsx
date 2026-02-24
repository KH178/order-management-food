"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Order = {
  id: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  itemsSummary: Array<{ name: string; quantity: number }>;
  createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:             "badge badge-gray",
  PAYMENT_PROCESSING:  "badge badge-orange",
  PAYMENT_CONFIRMED:   "badge badge-orange",
  PREPARING:           "badge badge-orange",
  DELIVERED:           "badge badge-green",
  CANCELLED:           "badge badge-red",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  PAYMENT_PROCESSING: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>,
  PAYMENT_CONFIRMED: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  PREPARING: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>,
  READY: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
  DELIVERED: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--z-success)' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  CANCELLED: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--z-red)' }}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>,
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orders?limit=20")
      .then(r => r.json())
      .then(d => { setOrders(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Link href="/" className={styles.logo}>FoodFlow</Link>
          <h1 className={styles.pageTitle}>My Orders</h1>
        </div>
      </header>

      <main className="container">
        <div className={styles.page}>
          {loading ? (
            <div className={styles.loadingWrap}>
              {[1,2,3].map(i => (
                <div key={i} className={`${styles.skeletonCard} skeleton`} style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className={styles.empty}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--z-muted)' }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              <h2>No orders yet</h2>
              <p>Looks like you haven't ordered anything. Let's fix that!</p>
              <Link href="/" className="btn btn-primary">Browse Restaurants</Link>
            </div>
          ) : (
            <div className={styles.orderList}>
              {orders.map((order, i) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className={styles.orderCard}
                  style={{ animationDelay: `${i * 0.07}s` }}
                >
                  <div className={styles.orderTop}>
                    <div className={styles.orderIcon}>{STATUS_ICON[order.status] || <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}</div>
                    <div className={styles.orderInfo}>
                      <div className={styles.orderCardHeader}>
                        <span className={styles.orderCardId}>#{order.id.slice(0, 8).toUpperCase()}</span>
                        <span className={STATUS_COLOR[order.status] || "badge badge-gray"}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className={styles.orderItems}>
                        {Array.isArray(order.itemsSummary)
                          ? order.itemsSummary.slice(0, 3).map(i => `${i.name} ×${i.quantity}`).join(", ")
                          : `${order.itemCount} item(s)`}
                      </p>
                      <div className={styles.orderMeta}>
                        <span>₹{order.totalAmount.toFixed(2)}</span>
                        <span className={styles.metaDot} />
                        <span>{new Date(order.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.orderArrow}>→</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
