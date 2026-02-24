"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

// ─── Static mock restaurant data ─────────────────────
const RESTAURANTS = [
  { id: "rest-1", name: "Barbeque Nation", cuisine: "BBQ, North Indian", rating: 4.5, deliveryTime: "30-40", minOrder: 300, offer: "50% OFF up to ₹100", image: "BN", tags: ["Trending", "BBQ"], veg: false },
  { id: "rest-2", name: "Paradise Biryani", cuisine: "Biryani, Mughlai", rating: 4.7, deliveryTime: "25-35", minOrder: 200, offer: "FREE delivery", image: "PB", tags: ["Bestseller"], veg: false },
  { id: "rest-3", name: "Green Leaf Café", cuisine: "Healthy, Salads, Veg", rating: 4.3, deliveryTime: "20-30", minOrder: 150, offer: "20% OFF", image: "GC", tags: ["Pure Veg"], veg: true },
  { id: "rest-4", name: "Pizza Hub", cuisine: "Pizza, Pasta, Italian", rating: 4.4, deliveryTime: "35-45", minOrder: 250, offer: "Buy 1 Get 1", image: "PH", tags: ["Trending"], veg: false },
  { id: "rest-5", name: "Burger Barn", cuisine: "Burgers, Sandwiches", rating: 4.2, deliveryTime: "20-30", minOrder: 120, offer: "₹75 OFF", image: "BB", tags: ["New"], veg: false },
  { id: "rest-6", name: "Sushi Zen", cuisine: "Japanese, Sushi", rating: 4.8, deliveryTime: "40-50", minOrder: 400, offer: "15% OFF", image: "SZ", tags: ["Premium"], veg: false },
  { id: "rest-7", name: "Annapoorna South", cuisine: "South Indian, Tiffin", rating: 4.6, deliveryTime: "15-25", minOrder: 100, offer: "FREE delivery", image: "AS", tags: ["Pure Veg"], veg: true },
  { id: "rest-8", name: "The Taco Joint", cuisine: "Mexican, Wraps", rating: 4.1, deliveryTime: "25-35", minOrder: 180, offer: "20% OFF", image: "TJ", tags: ["New"], veg: false },
];

const CATEGORIES = ["All", "Biryani", "Pizza", "Burgers", "Sushi", "Veg", "BBQ", "Healthy", "South Indian"];

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [vegOnly, setVegOnly] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const filtered = RESTAURANTS.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.cuisine.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || r.cuisine.toLowerCase().includes(category.toLowerCase()) || r.tags.some(t => t.toLowerCase().includes(category.toLowerCase()));
    const matchVeg = !vegOnly || r.veg;
    return matchSearch && matchCat && matchVeg;
  });

  return (
    <div className={styles.root}>
      {/* ── Header ───────────────────────────────── */}
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <div className={styles.logo}>
            <div style={{ width: 28, height: 28, background: 'var(--z-red)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
            </div>
            <span className={styles.logoText}>FoodFlow</span>
          </div>
          <div className={styles.locationPill}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span>Hyderabad, IN</span>
            <span className={styles.chevron}>▾</span>
          </div>
          <nav className={styles.nav}>
            <Link href="/orders" className={styles.navLink} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
              My Orders
            </Link>
            <button className="btn btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>Sign In</button>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────── */}
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Order food you love,<br />
              <span className={styles.heroAccent}>delivered fast</span>
            </h1>
            <p className={styles.heroSub}>Discover top restaurants near you</p>
            <div className={styles.searchBar}>
              <span className={styles.searchIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <input
                className={styles.searchInput}
                placeholder="Search restaurants or cuisines..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className={styles.searchClear} onClick={() => setSearch("")}>✕</button>
              )}
            </div>
          </div>
        </div>
        <div className={styles.heroOrbs}>
          <div className={styles.orb1} />
          <div className={styles.orb2} />
        </div>
      </section>

      {/* ── Categories ───────────────────────────── */}
      <section className={styles.categoriesSection}>
        <div className="container">
          <div className={styles.categoriesRow}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`chip ${category === cat ? "active" : ""}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
            <div className={styles.vegToggle} onClick={() => setVegOnly(v => !v)}>
              <div className={`${styles.vegDot} ${vegOnly ? styles.vegActive : ""}`} />
              <span style={{ fontSize: 13, fontWeight: 500, color: vegOnly ? "var(--z-success)" : "var(--z-muted)" }}>Veg only</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Restaurant Grid ───────────────────────── */}
      <main className={styles.main}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Restaurants near you</h2>
            <span className={styles.count}>{filtered.length} results</span>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--z-muted)' }}><circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path></svg>
              <p>No restaurants match your search</p>
              <button className="btn btn-ghost" onClick={() => { setSearch(""); setCategory("All"); }}>Clear filters</button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/restaurant/${r.id}`}
                  className={styles.restaurantCard}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className={styles.cardImage}>
                    <span className={styles.cardEmoji}>{r.image}</span>
                    <div className={styles.cardImageOverlay} />
                    <div className={styles.offerBadge}>{r.offer}</div>
                    {r.veg && <div className={styles.vegBadge}>Pure Veg</div>}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <h3 className={styles.cardName}>{r.name}</h3>
                      <div className={styles.rating}>
                        <span className={styles.ratingStar}>★</span>
                        <span>{r.rating}</span>
                      </div>
                    </div>
                    <p className={styles.cardCuisine}>{r.cuisine}</p>
                    <div className={styles.cardMeta}>
                      <span className={styles.metaItem}>⏱ {r.deliveryTime} mins</span>
                      <span className={styles.metaDot} />
                      <span className={styles.metaItem}>Min ₹{r.minOrder}</span>
                    </div>
                    <div className={styles.cardTags}>
                      {r.tags.map(tag => (
                        <span key={tag} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────── */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerContent}>
            <div>
              <div className={styles.footerLogo}>FoodFlow</div>
              <p className={styles.footerTagline}>Built on Event Sourcing · CQRS · Kafka</p>
            </div>
          </div>
          <div className={styles.footerDivider} />
          <p className={styles.footerCopy}>© 2026 FoodFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
