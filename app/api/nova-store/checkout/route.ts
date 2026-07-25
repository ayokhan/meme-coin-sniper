import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { getStripeCustomerId } from "@/lib/stripe-billing";
import { isNovaStoreEnabled } from "@/lib/nova-store/access";
import { storeDb as prisma } from "@/lib/nova-store/db";
import {
  asStringArray,
  NOVA_STORE_CURRENCY,
  NOVA_STORE_SHIPPING_CENTS,
  type StoreOrderItemSnapshot,
} from "@/lib/nova-store/constants";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const dynamic = "force-dynamic";

type CartLine = { variantId: string; quantity: number };

/**
 * POST — Stripe Checkout for Nova Store (card only, free shipping).
 * Requires sign-in. Collects shipping address in Stripe Checkout.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ success: false, error: "Sign in required to checkout." }, { status: 401 });
  }
  if (!stripe) {
    return NextResponse.json({ success: false, error: "Card payment is not configured." }, { status: 503 });
  }
  if (!(await isNovaStoreEnabled())) {
    return NextResponse.json({ success: false, error: "Nova Store is temporarily unavailable." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rawItems = Array.isArray(body.items) ? (body.items as CartLine[]) : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ success: false, error: "Your cart is empty." }, { status: 400 });
  }

  const lines: CartLine[] = [];
  for (const row of rawItems) {
    const variantId = typeof row.variantId === "string" ? row.variantId.trim() : "";
    const quantity = Math.floor(Number(row.quantity));
    if (!variantId || !Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
      return NextResponse.json({ success: false, error: "Invalid cart line." }, { status: 400 });
    }
    lines.push({ variantId, quantity });
  }
  if (lines.length > 20) {
    return NextResponse.json({ success: false, error: "Too many items in cart." }, { status: 400 });
  }

  const variantIds = [...new Set(lines.map((l) => l.variantId))];
  const variants = await prisma.storeProductVariant.findMany({
    where: { id: { in: variantIds }, active: true, product: { active: true } },
    include: { product: true },
  });
  if (variants.length !== variantIds.length) {
    return NextResponse.json({ success: false, error: "One or more items are no longer available." }, { status: 400 });
  }
  const byId = new Map(variants.map((v: any) => [v.id, v]));

  const snapshots: StoreOrderItemSnapshot[] = [];
  let subtotalCents = 0;
  for (const line of lines) {
    const v = byId.get(line.variantId) as any;
    if (v.stock != null && v.stock < line.quantity) {
      return NextResponse.json(
        { success: false, error: `${v.product.name} (${v.label}) is out of stock.` },
        { status: 400 }
      );
    }
    const images = asStringArray(v.product.images);
    snapshots.push({
      productId: v.productId,
      variantId: v.id,
      productName: v.product.name,
      variantLabel: v.label,
      quantity: line.quantity,
      unitPriceCents: v.priceCents,
      imageUrl: images[0] ?? null,
    });
    subtotalCents += v.priceCents * line.quantity;
  }

  const shippingCents = NOVA_STORE_SHIPPING_CENTS;
  const totalCents = subtotalCents + shippingCents;
  if (totalCents < 50) {
    return NextResponse.json({ success: false, error: "Minimum charge is $0.50." }, { status: 400 });
  }

  const origin =
    (typeof body.cancelUrl === "string" && body.cancelUrl.startsWith("http")
      ? new URL(body.cancelUrl).origin
      : null) ||
    request.headers.get("origin") ||
    process.env.NEXTAUTH_URL ||
    "https://novastaris.ai";

  const successUrl =
    (typeof body.successUrl === "string" && body.successUrl.trim()) ||
    `${origin}/?tab=nova-store&order=success`;
  const cancelUrl =
    (typeof body.cancelUrl === "string" && body.cancelUrl.trim()) ||
    `${origin}/?tab=nova-store&order=canceled`;

  const order = await prisma.storeOrder.create({
    data: {
      userId: session.user.id,
      email: session.user.email,
      status: "pending",
      currency: NOVA_STORE_CURRENCY,
      subtotalCents,
      shippingCents,
      totalCents,
      itemsJson: snapshots,
    },
  });

  try {
    const existingCustomerId = await getStripeCustomerId(session.user.id);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer: existingCustomerId ?? undefined,
      customer_email: existingCustomerId ? undefined : session.user.email,
      client_reference_id: session.user.id,
      metadata: {
        purpose: "nova_store_order",
        orderId: order.id,
        userId: session.user.id,
      },
      payment_intent_data: {
        metadata: {
          purpose: "nova_store_order",
          orderId: order.id,
          userId: session.user.id,
        },
      },
      shipping_address_collection: {
        allowed_countries: [
          "CA",
          "US",
          "GB",
          "AU",
          "NZ",
          "DE",
          "FR",
          "NL",
          "BE",
          "IE",
          "ES",
          "IT",
          "SE",
          "NO",
          "DK",
          "FI",
          "CH",
          "AT",
          "PT",
          "PL",
          "JP",
          "SG",
          "AE",
          "NG",
          "GH",
          "KE",
          "ZA",
          "IN",
          "BR",
          "MX",
        ],
      },
      phone_number_collection: { enabled: true },
      line_items: [
        ...snapshots.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: NOVA_STORE_CURRENCY,
            unit_amount: item.unitPriceCents,
            product_data: {
              name: `${item.productName} (${item.variantLabel})`,
              description: "Nova Store · ships free from Canada",
              images: item.imageUrl?.startsWith("http")
                ? [item.imageUrl]
                : item.imageUrl
                  ? [`${origin}${item.imageUrl}`]
                  : undefined,
            },
          },
        })),
        ...(shippingCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: NOVA_STORE_CURRENCY,
                  unit_amount: shippingCents,
                  product_data: { name: "Shipping" },
                },
              },
            ]
          : []),
      ],
      success_url: successUrl.includes("{CHECKOUT_SESSION_ID}")
        ? successUrl
        : `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    await prisma.storeOrder.update({
      where: { id: order.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
      orderId: order.id,
      sessionId: checkoutSession.id,
    });
  } catch (e) {
    console.error("Nova Store checkout:", e);
    await prisma.storeOrder.update({
      where: { id: order.id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ success: false, error: "Could not start checkout." }, { status: 500 });
  }
}
