"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatStoreMoney } from "@/lib/nova-store/constants";
import {
  SICKKIDS_FOUNDATION_URL,
  STORE_GIVING_BODY,
  STORE_GIVING_CART_NOTE,
  STORE_GIVING_HEADLINE,
  STORE_GIVING_SUCCESS,
} from "@/lib/nova-store/giving";

type StoreVariant = {
  id: string;
  label: string;
  priceCents: number;
  stock: number | null;
  sku?: string | null;
};

type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  currency: string;
  variants: StoreVariant[];
};

type CartLine = { variantId: string; quantity: number; product: StoreProduct; variant: StoreVariant };

export default function NovaStorePanel() {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [sizeByProduct, setSizeByProduct] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const order = params.get("order");
    if (order === "success") setBanner(STORE_GIVING_SUCCESS);
    if (order === "canceled") setBanner("Checkout canceled. Your cart is still here if you want to try again.");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/nova-store/products", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not load the store.");
        setProducts([]);
        return;
      }
      setProducts(data.products ?? []);
    } catch {
      setError("Could not load the store.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setActiveImage(0);
  }, [selected?.id]);

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + l.variant.priceCents * l.quantity, 0),
    [cart]
  );

  const addToCart = (product: StoreProduct) => {
    const variantId = sizeByProduct[product.id] || product.variants[0]?.id;
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) {
      setError("Select a size / option first.");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        return prev.map((l) =>
          l.variantId === variant.id ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l
        );
      }
      return [...prev, { variantId: variant.id, quantity: 1, product, variant }];
    });
    setError("");
  };

  const checkout = async () => {
    if (status !== "authenticated" || !session?.user) {
      setError("Sign in to checkout with card (Stripe).");
      return;
    }
    if (cart.length === 0) {
      setError("Add an item first.");
      return;
    }
    setCheckoutBusy(true);
    setError("");
    try {
      const origin = window.location.origin;
      const res = await fetch("/api/nova-store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          successUrl: `${origin}/?tab=nova-store&order=success`,
          cancelUrl: `${origin}/?tab=nova-store&order=canceled`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        setError(data.error || "Checkout failed.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Checkout failed.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Loading Nova Store…</p>;
  }

  return (
    <div className="mx-3 sm:mx-6 py-6 sm:py-8 space-y-6 max-w-6xl">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
          Official merch
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Nova Store
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          NovaStaris tees, mugs, and more. Card checkout via Stripe. Free shipping from Canada.
        </p>
      </header>

      <aside className="rounded-xl border border-sky-500/25 bg-sky-50/80 dark:bg-sky-950/40 px-4 py-3.5 space-y-1.5 max-w-3xl">
        <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">{STORE_GIVING_HEADLINE}</p>
        <p className="text-sm text-sky-900/85 dark:text-sky-100/85 leading-relaxed">{STORE_GIVING_BODY}</p>
        <a
          href={SICKKIDS_FOUNDATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-medium text-sky-700 dark:text-sky-300 underline underline-offset-2"
        >
          Learn about SickKids Foundation
        </a>
      </aside>

      {banner && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {banner}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
          {error.includes("Sign in") && (
            <span className="ml-2">
              <Link href="/signin" className="underline text-cyan-600 dark:text-cyan-400">
                Sign in
              </Link>
            </span>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products listed yet. Check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const minPrice = Math.min(...p.variants.map((v) => v.priceCents));
            const img = p.images[0];
            const selectedVariantId = sizeByProduct[p.id] || p.variants[0]?.id;
            return (
              <article
                key={p.id}
                className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60"
              >
                <button
                  type="button"
                  className="relative block w-full aspect-square bg-zinc-100 dark:bg-zinc-800"
                  onClick={() => {
                    setSelected(p);
                    setActiveImage(0);
                  }}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm text-muted-foreground">No image</span>
                  )}
                </button>
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-snug">
                      {p.name}
                    </h2>
                    <p className="text-sm font-bold tabular-nums text-cyan-700 dark:text-cyan-300 shrink-0">
                      {formatStoreMoney(minPrice, p.currency)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                    {p.description}
                  </p>
                  {p.variants.length > 1 && (
                    <label className="block text-[11px] text-muted-foreground">
                      Size / option
                      <select
                        className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-100"
                        value={selectedVariantId}
                        onChange={(e) =>
                          setSizeByProduct((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                      >
                        {p.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label} — {formatStoreMoney(v.priceCents, p.currency)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setSelected(p);
                        setActiveImage(0);
                      }}
                    >
                      View
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => addToCart(p)}
                    >
                      Add to cart
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {cart.length > 0 && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-3">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Cart</h3>
          <ul className="space-y-2 text-sm">
            {cart.map((l) => (
              <li key={l.variantId} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {l.product.name} · {l.variant.label} × {l.quantity}
                </span>
                <span className="tabular-nums font-medium">
                  {formatStoreMoney(l.variant.priceCents * l.quantity, l.product.currency)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCart((prev) => prev.filter((x) => x.variantId !== l.variantId))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 dark:border-zinc-700 pt-3">
            <div>
              <p className="text-sm">
                Total{" "}
                <span className="font-bold tabular-nums">{formatStoreMoney(cartTotal)}</span>
                <span className="text-muted-foreground"> · Free shipping</span>
              </p>
              <p className="text-[11px] text-sky-700 dark:text-sky-300 mt-0.5">{STORE_GIVING_CART_NOTE}</p>
            </div>
            <Button type="button" onClick={() => void checkout()} disabled={checkoutBusy}>
              {checkoutBusy ? "Redirecting…" : "Checkout with Stripe"}
            </Button>
          </div>
        </section>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white dark:bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid sm:grid-cols-2 gap-0">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-3 space-y-2">
                <button
                  type="button"
                  className="relative block w-full aspect-square overflow-hidden rounded-lg cursor-zoom-in"
                  onClick={() => {
                    const url = selected.images[activeImage];
                    if (url) setZoomUrl(url);
                  }}
                  title="Click to zoom"
                >
                  {selected.images[activeImage] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.images[activeImage]}
                      alt={selected.name}
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </button>
                {selected.images.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {selected.images.map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        className={`h-14 w-14 overflow-hidden rounded border ${
                          i === activeImage
                            ? "border-cyan-500"
                            : "border-zinc-300 dark:border-zinc-600"
                        }`}
                        onClick={() => setActiveImage(i)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">Click image to zoom</p>
              </div>
              <div className="p-4 sm:p-5 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{selected.name}</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{selected.description}</p>
                <label className="block text-xs text-muted-foreground">
                  Size / option
                  <select
                    className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-2 text-sm"
                    value={sizeByProduct[selected.id] || selected.variants[0]?.id}
                    onChange={(e) =>
                      setSizeByProduct((prev) => ({ ...prev, [selected.id]: e.target.value }))
                    }
                  >
                    {selected.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} — {formatStoreMoney(v.priceCents, selected.currency)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" onClick={() => addToCart(selected)}>
                    Add to cart
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {zoomUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
          onClick={() => setZoomUrl(null)}
          role="dialog"
          aria-modal
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomUrl}
            alt="Zoomed product"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
