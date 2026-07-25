"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  NOVA_STORE_APPAREL_SIZES,
  NOVA_STORE_CATEGORIES,
  formatStoreMoney,
} from "@/lib/nova-store/constants";
import AdminNovaStoreDashboard from "@/components/admin/AdminNovaStoreDashboard";

type Variant = {
  id?: string;
  label: string;
  priceCents: number;
  sku?: string | null;
  stock?: number | null;
  active?: boolean;
  sortOrder?: number;
};

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  currency: string;
  active: boolean;
  sortOrder: number;
  variants: Variant[];
};

type Order = {
  id: string;
  email: string;
  status: string;
  totalCents: number;
  currency: string;
  shippingCents: number;
  itemsJson: unknown;
  shipName?: string | null;
  shipLine1?: string | null;
  shipCity?: string | null;
  shipState?: string | null;
  shipPostal?: string | null;
  shipCountry?: string | null;
  trackingNumber?: string | null;
  shippedEmailSentAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

export default function AdminNovaStorePage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [tab, setTab] = useState<"dashboard" | "products" | "orders">("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("apparel");
  const [priceDollars, setPriceDollars] = useState("39.99");
  const [useApparelSizes, setUseApparelSizes] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVariants, setEditVariants] = useState<Variant[]>([]);

  const [orderTracking, setOrderTracking] = useState<Record<string, string>>({});

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/admin/nova-store/products", { credentials: "include" });
    const data = await res.json();
    if (res.ok && data.success) setProducts(data.products ?? []);
  }, []);

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/admin/nova-store/orders", { credentials: "include" });
    const data = await res.json();
    if (res.ok && data.success) {
      const list = (data.orders ?? []) as Order[];
      setOrders(list);
      const track: Record<string, string> = {};
      for (const o of list) {
        if (o.trackingNumber) track[o.id] = o.trackingNumber;
      }
      setOrderTracking(track);
    }
  }, []);

  const shipOrder = async (id: string, notify: boolean) => {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/nova-store/orders", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "fulfilled",
          trackingNumber: orderTracking[id] ?? "",
          notifyCustomer: notify,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not ship order.");
        return;
      }
      if (notify) {
        setOk(
          data.emailSent
            ? "Shipped and emailed the customer."
            : `Shipped. Email failed: ${data.emailError || "unknown"}`
        );
      } else {
        setOk("Marked as shipped.");
      }
      await loadOrders();
    } catch {
      setError("Could not ship order.");
    } finally {
      setBusy(false);
    }
  };

  const setOrderStatus = async (id: string, next: string) => {
    await fetch("/api/admin/nova-store/orders", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    await loadOrders();
  };

  useEffect(() => {
    if (!isOwner) return;
    void loadProducts();
    void loadOrders();
  }, [isOwner, loadProducts, loadOrders]);

  const uploadImage = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/nova-store/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Upload failed.");
        return;
      }
      setImages((prev) => [...prev, data.url]);
      setOk("Image uploaded.");
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setCategory("apparel");
    setPriceDollars("39.99");
    setUseApparelSizes(true);
    setImages([]);
    setEditVariants([]);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description);
    setCategory(p.category);
    setImages(p.images);
    setEditVariants(p.variants);
    setUseApparelSizes(false);
    const first = p.variants[0];
    if (first) setPriceDollars((first.priceCents / 100).toFixed(2));
    setTab("products");
  };

  const saveProduct = async () => {
    setBusy(true);
    setError("");
    setOk("");
    const priceCents = Math.round(parseFloat(priceDollars) * 100);
    if (!name.trim() || !description.trim() || !Number.isFinite(priceCents) || priceCents < 50) {
      setError("Name, description, and a price of at least $0.50 are required.");
      setBusy(false);
      return;
    }
    try {
      if (editingId) {
        // Top "Price (USD)" applies to every size/option so a single edit updates the whole product.
        const variantsPayload =
          editVariants.length > 0
            ? editVariants.map((v, i) => ({
                ...v,
                priceCents,
                sortOrder: v.sortOrder ?? (i + 1) * 10,
              }))
            : [{ label: "Default", priceCents, active: true, sortOrder: 10 }];
        const res = await fetch(`/api/admin/nova-store/products/${editingId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            category,
            images,
            variants: variantsPayload,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Update failed.");
          return;
        }
        setOk("Product updated — price applied to all sizes.");
      } else {
        const res = await fetch("/api/admin/nova-store/products", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            category,
            images,
            defaultPriceCents: priceCents,
            useApparelSizes,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Create failed.");
          return;
        }
        setOk("Product created.");
      }
      resetForm();
      await loadProducts();
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: Product) => {
    await fetch(`/api/admin/nova-store/products/${p.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    await loadProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/admin/nova-store/products/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await loadProducts();
  };

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in required."}
          {!session && (
            <p className="mt-2">
              <Link href="/signin" className="underline text-cyan-600">
                Sign in
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-10 text-center text-muted-foreground">Owner access only.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <AdminPageHeader
        title="Nova Store"
        description="Sales dashboard, SickKids remittances, catalog, and order fulfillment. Toggle the public tab in Feature flags → Tab: Nova Store."
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "dashboard" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </Button>
        <Button
          type="button"
          variant={tab === "products" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("products")}
        >
          Products
        </Button>
        <Button
          type="button"
          variant={tab === "orders" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("orders")}
        >
          Orders (
          {orders.filter((o) => o.status === "paid" || o.status === "fulfilled").length} paid
          {orders.some((o) => o.status === "pending")
            ? ` · ${orders.filter((o) => o.status === "pending").length} pending`
            : ""}
          )
        </Button>
        <Link href="/?tab=nova-store" className="text-sm text-cyan-600 underline self-center ml-2">
          Open store tab
        </Link>
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {ok && <p className="text-sm text-emerald-600 dark:text-emerald-400">{ok}</p>}

      {tab === "dashboard" && (
        <AdminNovaStoreDashboard
          onError={(msg) => {
            setError(msg);
            setOk("");
          }}
          onOk={(msg) => {
            setOk(msg);
            setError("");
          }}
        />
      )}

      {tab === "products" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="font-semibold">{editingId ? "Edit product" : "Add product"}</h2>
              <label className="block text-xs text-muted-foreground">
                Name
                <input
                  className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="NovaStaris Mug"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Description
                <textarea
                  className="mt-1 w-full min-h-[100px] rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Category
                <select
                  className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {NOVA_STORE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Price (USD) — applied to all sizes on save
                <input
                  type="number"
                  min="0.50"
                  step="0.01"
                  className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                />
              </label>
              {!editingId && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useApparelSizes}
                    onChange={(e) => setUseApparelSizes(e.target.checked)}
                  />
                  Create apparel sizes ({NOVA_STORE_APPAREL_SIZES.join(", ")})
                </label>
              )}
              {editingId && (
                <div className="space-y-2 border rounded p-2 border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium">Variants</p>
                  {editVariants.map((v, i) => (
                    <div key={v.id ?? i} className="flex flex-wrap gap-2 items-center text-xs">
                      <input
                        className="w-16 rounded border px-1 py-1 bg-white dark:bg-zinc-800"
                        value={v.label}
                        onChange={(e) => {
                          const next = [...editVariants];
                          next[i] = { ...v, label: e.target.value };
                          setEditVariants(next);
                        }}
                      />
                      <input
                        type="number"
                        className="w-24 rounded border px-1 py-1 bg-white dark:bg-zinc-800"
                        value={(v.priceCents / 100).toFixed(2)}
                        onChange={(e) => {
                          const next = [...editVariants];
                          next[i] = {
                            ...v,
                            priceCents: Math.round(parseFloat(e.target.value || "0") * 100),
                          };
                          setEditVariants(next);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setEditVariants(editVariants.filter((_, j) => j !== i))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setEditVariants([
                        ...editVariants,
                        {
                          label: "New",
                          priceCents: Math.round(parseFloat(priceDollars) * 100) || 3999,
                          active: true,
                          sortOrder: (editVariants.length + 1) * 10,
                        },
                      ])
                    }
                  >
                    Add variant
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Images</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadImage(f);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {images.map((url) => (
                    <div key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-16 w-16 object-cover rounded border" />
                      <button
                        type="button"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-rose-600 text-white text-[10px]"
                        onClick={() => setImages(images.filter((u) => u !== url))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void saveProduct()} disabled={busy}>
                  {busy ? "Saving…" : editingId ? "Save changes" : "Create product"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {products.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-4 space-y-2 text-sm">
                  <div className="flex gap-3">
                    {p.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="h-16 w-16 object-cover rounded" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {p.name}{" "}
                        {!p.active && (
                          <span className="text-xs text-amber-600 font-normal">(hidden)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.category} · {p.variants.length} options · from{" "}
                        {formatStoreMoney(
                          Math.min(...p.variants.map((v) => v.priceCents)),
                          p.currency
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => startEdit(p)}>
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void toggleActive(p)}>
                      {p.active ? "Hide" : "Show"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-rose-600" onClick={() => void deleteProduct(p.id)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            <strong>Pending</strong> = checkout started in Stripe but payment not finished (price is locked at that
            moment). <strong>Paid</strong> orders show Ship &amp; email and email you via{" "}
            <code className="text-[11px]">OWNER_EMAIL</code>. Product price edits only apply to new checkouts.
          </p>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            orders.map((o) => {
              const items = Array.isArray(o.itemsJson) ? o.itemsJson : [];
              return (
                <Card key={o.id}>
                  <CardContent className="pt-4 space-y-2 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {o.email} ·{" "}
                          <span
                            className={`uppercase text-xs ${
                              o.status === "pending"
                                ? "text-amber-600 dark:text-amber-400"
                                : o.status === "paid" || o.status === "fulfilled"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : ""
                            }`}
                          >
                            {o.status}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(o.createdAt).toLocaleString()} ·{" "}
                          {formatStoreMoney(o.totalCents, o.currency)}
                          {o.shippingCents === 0 ? " · Free shipping" : ""}
                        </p>
                        {o.status === "pending" && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                            Not paid yet — customer left Stripe before completing. No ship actions until paid.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {o.status === "pending" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-rose-600"
                            disabled={busy}
                            onClick={() => void setOrderStatus(o.id, "cancelled")}
                          >
                            Cancel abandoned
                          </Button>
                        )}
                        {(o.status === "paid" || o.status === "fulfilled") && (
                          <>
                            <label className="text-[10px] text-muted-foreground">
                              Tracking
                              <input
                                className="ml-1 w-28 rounded border px-1 py-0.5 text-xs bg-white dark:bg-zinc-800"
                                value={orderTracking[o.id] ?? ""}
                                onChange={(e) =>
                                  setOrderTracking((prev) => ({ ...prev, [o.id]: e.target.value }))
                                }
                              />
                            </label>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={busy}
                              onClick={() => void shipOrder(o.id, true)}
                            >
                              Ship &amp; email
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={busy}
                              onClick={() => void shipOrder(o.id, false)}
                            >
                              Ship only
                            </Button>
                          </>
                        )}
                        {o.status === "fulfilled" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => void setOrderStatus(o.id, "paid")}
                          >
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>
                    {(o.shipLine1 || o.shipName) && (
                      <p className="text-xs text-muted-foreground whitespace-pre-line">
                        Ship to: {[o.shipName, o.shipLine1, o.shipCity, o.shipState, o.shipPostal, o.shipCountry]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    <ul className="text-xs space-y-0.5">
                      {items.map((raw, i) => {
                        const item = raw as {
                          productName?: string;
                          variantLabel?: string;
                          quantity?: number;
                          unitPriceCents?: number;
                        };
                        return (
                          <li key={i}>
                            {item.productName} ({item.variantLabel}) × {item.quantity} —{" "}
                            {formatStoreMoney((item.unitPriceCents ?? 0) * (item.quantity ?? 1), o.currency)}
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
