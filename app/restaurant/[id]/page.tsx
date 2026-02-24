"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

// ─── Menu data per restaurant ────────────────────────
const MENUS: Record<string, { name: string; cuisine: string; rating: number; time: string; items: MenuItem[] }> = {
  "rest-1": {
    name: "Barbeque Nation", cuisine: "BBQ, North Indian", rating: 4.5, time: "30-40",
    items: [
      { id: "i1", name: "Chicken BBQ Platter", desc: "Grilled chicken with smoky BBQ sauce, served with naan", price: 449, category: "Starters", veg: false, popular: true },
      { id: "i2", name: "Paneer Tikka", desc: "Marinated cottage cheese grilled to perfection", price: 299, category: "Starters", veg: true, popular: true },
      { id: "i3", name: "Mutton Seekh Kebab", desc: "Minced mutton with spices, charcoal grilled", price: 399, category: "Starters", veg: false, popular: false },
      { id: "i4", name: "Dal Makhani", desc: "Slow-cooked black lentils in buttery tomato gravy", price: 249, category: "Mains", veg: true, popular: true },
      { id: "i5", name: "Butter Naan", desc: "Soft leavened bread baked in tandoor", price: 59, category: "Breads", veg: true, popular: false },
      { id: "i6", name: "Gulab Jamun", desc: "Soft khoya dumplings in rose-flavored sugar syrup", price: 119, category: "Desserts", veg: true, popular: false },
    ]
  },
  "rest-2": {
    name: "Paradise Biryani", cuisine: "Biryani, Mughlai", rating: 4.7, time: "25-35",
    items: [
      { id: "i1", name: "Hyderabadi Chicken Biryani", desc: "Dum-cooked basmati rice with marinated chicken", price: 299, category: "Biryani", veg: false, popular: true },
      { id: "i2", name: "Mutton Biryani", desc: "Slow-cooked mutton in aromatic spiced rice", price: 379, category: "Biryani", veg: false, popular: true },
      { id: "i3", name: "Veg Biryani", desc: "Fragrant basmati with garden vegetables", price: 229, category: "Biryani", veg: true, popular: false },
      { id: "i4", name: "Mirchi Ka Salan", desc: "Green chilli curry — classic accompaniment", price: 99, category: "Sides", veg: true, popular: true },
      { id: "i5", name: "Double Ka Meetha", desc: "Hyderabadi bread pudding with dry fruits", price: 129, category: "Desserts", veg: true, popular: false },
    ]
  },
  "rest-4": {
    name: "Pizza Hub", cuisine: "Pizza, Pasta, Italian", rating: 4.4, time: "35-45",
    items: [
      { id: "i1", name: "Margherita", desc: "Classic tomato base with mozzarella and basil", price: 249, category: "Pizza", veg: true, popular: true },
      { id: "i2", name: "BBQ Chicken", desc: "Smoky BBQ sauce, chicken, red onion, cilantro", price: 349, category: "Pizza", veg: false, popular: true },
      { id: "i3", name: "Penne Arrabbiata", desc: "Spicy tomato-garlic sauce with penne", price: 229, category: "Pasta", veg: true, popular: false },
      { id: "i4", name: "Garlic Bread", desc: "Toasted with herb butter and parmesan", price: 129, category: "Sides", veg: true, popular: true },
    ]
  },
};

// Default menu for unmatched IDs
const DEFAULT_MENU = MENUS["rest-1"];

type MenuItem = { id: string; name: string; desc: string; price: number; category: string; veg: boolean; popular: boolean };
type CartItem = MenuItem & { qty: number };

export default function RestaurantPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const data = MENUS[params.id] || { ...DEFAULT_MENU, name: "Restaurant" };
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(false);

  const categories = ["All", ...Array.from(new Set(data.items.map(i => i.category)))];

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === id);
      if (existing?.qty === 1) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const getQty = (id: string) => cart.find(c => c.id === id)?.qty || 0;
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);

  const filtered = data.items.filter(i => activeCategory === "All" || i.category === activeCategory);

  const placeOrder = async () => {
    if (!cart.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: `guest-${Date.now()}`,
          items: cart.map(c => ({ productId: c.id, name: c.name, price: c.price, quantity: c.qty })),
        }),
      });
      const data = await res.json();
      if (data.orderId) router.push(`/orders/${data.orderId}`);
    } catch {
      alert("Failed to place order. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      {/* ── Header ─────────────────────────────── */}
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Link href="/" className={styles.back}>← Back</Link>
          <div className={styles.logo}>FoodFlow</div>
          <Link href="/orders" className={styles.ordersLink} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            Orders
          </Link>
        </div>
      </header>

      {/* ── Restaurant Hero ─────────────────────── */}
      <div className={styles.restHero}>
        <div className="container">
          <div className={styles.restHeroContent}>
            <div className={styles.restEmoji} style={{ background: 'var(--z-surface-2)', border: '1px solid var(--z-border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--z-muted)' }}>{data.name.substring(0, 2).toUpperCase()}</span>
            </div>
            <div>
              <h1 className={styles.restName}>{data.name}</h1>
              <p className={styles.restCuisine}>{data.cuisine}</p>
              <div className={styles.restMeta}>
                <span className={styles.ratingChip}>★ {data.rating}</span>
                <span className={styles.metaDivider}>·</span>
                <span>⏱ {data.time} mins</span>
                <span className={styles.metaDivider}>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                  FREE delivery
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className={styles.layout}>
          {/* ── Menu ─────────────────────────────── */}
          <main className={styles.menuArea}>
            {/* Category tabs */}
            <div className={styles.categoryTabs}>
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`${styles.categoryTab} ${activeCategory === cat ? styles.active : ""}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu items */}
            <div className={styles.menuList}>
              {filtered.map((item, i) => {
                const qty = getQty(item.id);
                return (
                  <div key={item.id} className={styles.menuItem} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemTop}>
                        <span className={item.veg ? styles.vegIndicator : styles.nonVegIndicator} title={item.veg ? "Vegetarian" : "Non-vegetarian"} />
                        {item.popular && <span className={styles.popularTag}>Bestseller</span>}
                      </div>
                      <h3 className={styles.itemName}>{item.name}</h3>
                      <p className={styles.itemDesc}>{item.desc}</p>
                      <p className={styles.itemPrice}>₹{item.price}</p>
                    </div>
                    <div className={styles.itemAction}>
                      <div className={styles.itemImagePlaceholder}></div>
                      {qty === 0 ? (
                        <button className={styles.addBtn} onClick={() => addToCart(item)}>ADD +</button>
                      ) : (
                        <div className={styles.qtyControl}>
                          <button className={styles.qtyBtn} onClick={() => removeFromCart(item.id)}>−</button>
                          <span className={styles.qtyNum}>{qty}</span>
                          <button className={styles.qtyBtn} onClick={() => addToCart(item)}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>

          {/* ── Cart Sidebar ──────────────────────── */}
          <aside className={styles.cart}>
            <div className={styles.cartHeader}>
              <h3 className={styles.cartTitle}>Your Order</h3>
              <span className={styles.cartCount}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            </div>

            {cart.length === 0 ? (
              <div className={styles.emptyCart}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--z-muted)' }}><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                <p>Your cart is empty</p>
                <span style={{ fontSize: 13, color: "var(--z-muted)" }}>Add items to get started</span>
              </div>
            ) : (
              <>
                <div className={styles.cartItems}>
                  {cart.map(c => (
                    <div key={c.id} className={styles.cartItem}>
                      <div className={styles.cartItemInfo}>
                        <span className={c.veg ? styles.vegIndicatorSm : styles.nonVegIndicatorSm} />
                        <span className={styles.cartItemName}>{c.name}</span>
                      </div>
                      <div className={styles.cartItemRight}>
                        <div className={styles.qtyControlSm}>
                          <button className={styles.qtyBtn} onClick={() => removeFromCart(c.id)}>−</button>
                          <span className={styles.qtyNumSm}>{c.qty}</span>
                          <button className={styles.qtyBtn} onClick={() => addToCart(c)}>+</button>
                        </div>
                        <span className={styles.cartItemPrice}>₹{c.price * c.qty}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.cartTotal}>
                  <div className={styles.totalRow}>
                    <span style={{ color: "var(--z-muted)", fontSize: 13 }}>Item total</span>
                    <span>₹{total}</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span style={{ color: "var(--z-muted)", fontSize: 13 }}>Delivery fee</span>
                    <span style={{ color: "var(--z-success)" }}>FREE</span>
                  </div>
                  <div className={styles.totalRow} style={{ fontWeight: 700, fontSize: 16, borderTop: "1px solid var(--z-border)", paddingTop: 12 }}>
                    <span>To Pay</span>
                    <span>₹{total}</span>
                  </div>
                </div>

                <button className={styles.placeOrderBtn} onClick={placeOrder} disabled={loading}>
                  {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : null}
                  {loading ? "Placing order..." : `Place Order · ₹${total}`}
                </button>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
