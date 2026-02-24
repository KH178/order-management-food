"use client";
import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const STATUS_STEPS = [
  { key: "PENDING",             label: "Order Placed",       desc: "Your order has been received" },
  { key: "PAYMENT_PROCESSING",  label: "Payment Processing", desc: "Processing your payment" },
  { key: "PAYMENT_CONFIRMED",   label: "Payment Confirmed",  desc: "Payment successful" },
  { key: "PREPARING",           label: "Preparing Food",     desc: "The kitchen is working on your order" },
  { key: "READY",               label: "Ready for Pickup",   desc: "Your order is packed and ready" },
  { key: "DELIVERED",           label: "Delivered",          desc: "Enjoy your meal!" },
];

const CANCELLED_STEP = { key: "CANCELLED", label: "Cancelled", desc: "Order was cancelled" };

type OrderStatus = typeof STATUS_STEPS[number]["key"] | "CANCELLED";

function getStepIndex(status: OrderStatus) {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

export default function OrderTrackerPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [status, setStatus] = useState<OrderStatus>("PENDING");
  const [events, setEvents] = useState<Array<{ status: string; time: string }>>([]);
  const [connected, setConnected] = useState(false);
  const [eta, setEta]           = useState(30);
  const evtRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Try SSE first; fall back to polling if no workers running
    const sse = new EventSource(`/api/orders/${params.id}/stream`);
    evtRef.current = sse;

    sse.onopen = () => setConnected(true);

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status) {
          setStatus(data.status);
          setEvents(prev => [
            { status: data.status, time: new Date().toLocaleTimeString() },
            ...prev.slice(0, 9),
          ]);
          if (data.status === "DELIVERED" || data.status === "CANCELLED") {
            sse.close();
            setConnected(false);
          }
        }
      } catch { /* ignore parse errors */ }
    };

    sse.onerror = () => { setConnected(false); };

    // Also count down ETA
    const timer = setInterval(() => setEta(n => Math.max(0, n - 1)), 60000);

    return () => {
      sse.close();
      clearInterval(timer);
    };
  }, [params.id]);

  const stepIdx = getStepIndex(status);
  const cancelled = status === "CANCELLED";
  const delivered = status === "DELIVERED";
  const done = cancelled || delivered;

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Link href="/" className={styles.logo}>FoodFlow</Link>
          <Link href="/orders" className={styles.back}>← All Orders</Link>
        </div>
      </header>

      <main className="container">
        <div className={styles.page}>
          {/* Order ID strip */}
          <div className={styles.orderIdBar}>
            <div>
              <span className={styles.orderLabel}>Order ID</span>
              <span className={styles.orderId}>{params.id}</span>
            </div>
            <div className={styles.connBadge}>
              <span className={connected ? styles.connDotGreen : styles.connDotGray} />
              <span>{connected ? "Live" : "Syncing..."}</span>
            </div>
          </div>

          {cancelled ? (
            /* ── Cancelled State ─────────────────── */
            <div className={styles.cancelledCard}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--z-red)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </div>
              <h2>Order Cancelled</h2>
              <p>Your order was cancelled. Any payment will be refunded within 5–7 business days.</p>
              <Link href="/" className="btn btn-primary" style={{ marginTop: 8 }}>Order Again</Link>
            </div>
          ) : (
            <>
              {/* ── Status Hero ────────────────────── */}
              <div className={styles.statusHero}>
                <div className={styles.statusEmojiWrap}>
                  <div className={`${styles.statusEmoji} ${!done ? styles.pulse : ""}`}>
                    {delivered ? (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'currentColor' }} />
                    )}
                  </div>
                  {!done && <div className={styles.statusRing} />}
                </div>
                <div>
                  <p className={styles.statusLabel}>
                    {delivered ? "Order Delivered!" : STATUS_STEPS[stepIdx]?.label}
                  </p>
                  <p className={styles.statusDesc}>{STATUS_STEPS[stepIdx]?.desc}</p>
                  {!done && <p className={styles.eta}>Estimated arrival in <strong>{eta} min</strong></p>}
                </div>
              </div>

              {/* ── Progress Stepper ───────────────── */}
              <div className={styles.stepperCard}>
                <h3 className={styles.stepperTitle}>Order Progress</h3>
                <div className={styles.stepper}>
                  {STATUS_STEPS.map((step, i) => {
                    const state = i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
                    return (
                      <div key={step.key} className={styles.step}>
                        <div className={styles.stepLeft}>
                          <div className={`${styles.stepDot} ${styles[`dot_${state}`]}`}>
                            {state === "done" ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                            ) : (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', opacity: state === 'active' ? 1 : 0.3 }} />
                            )}
                          </div>
                          {i < STATUS_STEPS.length - 1 && (
                            <div className={`${styles.stepLine} ${state === "done" ? styles.stepLineDone : ""}`} />
                          )}
                        </div>
                        <div className={styles.stepContent}>
                          <p className={`${styles.stepLabel} ${state === "active" ? styles.stepLabelActive : ""}`}>
                            {step.label}
                          </p>
                          {state === "active" && <p className={styles.stepDesc}>{step.desc}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Activity Log ───────────────────── */}
              {events.length > 0 && (
                <div className={styles.activityCard}>
                  <h3 className={styles.stepperTitle}>Activity</h3>
                  <div className={styles.activity}>
                    {events.map((e, i) => (
                      <div key={i} className={styles.activityItem}>
                        <span className={styles.activityTime}>{e.time}</span>
                        <span className={styles.activityStatus}>{e.status.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivered CTA */}
              {delivered && (
                <div className={styles.deliveredCta}>
                  <h3>How was your order?</h3>
                  <div className={styles.stars}>
                    {[1,2,3,4,5].map(n => (
                      <svg key={n} className={styles.star} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ))}
                  </div>
                  <Link href="/" className="btn btn-primary">Order Again</Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
