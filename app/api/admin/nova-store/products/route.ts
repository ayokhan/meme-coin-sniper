import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { storeDb as prisma } from "@/lib/nova-store/db";
import {
  asStringArray,
  NOVA_STORE_APPAREL_SIZES,
  NOVA_STORE_CURRENCY,
  slugifyStoreName,
} from "@/lib/nova-store/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type VariantInput = {
  label: string;
  priceCents: number;
  sku?: string | null;
  stock?: number | null;
  active?: boolean;
  sortOrder?: number;
};

function requireOwner(session: { user?: { email?: string | null } } | null) {
  return isOwnerEmail(session?.user?.email ?? null);
}

/** GET — list all products (including inactive) for admin. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const products = await prisma.storeProduct.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      variants: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] },
    },
  });

  return NextResponse.json({
    success: true,
    products: products.map((p: any) => ({
      ...p,
      images: asStringArray(p.images),
    })),
  });
}

/** POST — create product (optional apparel size presets). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!requireOwner(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name || !description) {
    return NextResponse.json({ success: false, error: "Name and description are required." }, { status: 400 });
  }

  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : "apparel";
  const images = asStringArray(body.images);
  const currency =
    typeof body.currency === "string" && body.currency.trim()
      ? body.currency.trim().toLowerCase()
      : NOVA_STORE_CURRENCY;
  const active = body.active !== false;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Math.floor(Number(body.sortOrder)) : 0;
  let slug =
    typeof body.slug === "string" && body.slug.trim()
      ? slugifyStoreName(body.slug)
      : slugifyStoreName(name);
  if (!slug) slug = `item-${Date.now()}`;

  const existingSlug = await prisma.storeProduct.findUnique({ where: { slug } });
  if (existingSlug) slug = `${slug}-${Date.now().toString(36)}`;

  const useApparelSizes = body.useApparelSizes === true;
  const defaultPriceCents = Math.max(
    50,
    Math.round(Number(body.defaultPriceCents ?? body.priceCents ?? 3999))
  );

  let variants: VariantInput[] = Array.isArray(body.variants)
    ? (body.variants as VariantInput[])
        .map((v, i) => ({
          label: String(v.label ?? "").trim(),
          priceCents: Math.max(50, Math.round(Number(v.priceCents))),
          sku: v.sku != null ? String(v.sku).trim() || null : null,
          stock: v.stock == null ? null : Math.max(0, Math.floor(Number(v.stock))),
          active: v.active !== false,
          sortOrder: Number.isFinite(Number(v.sortOrder)) ? Math.floor(Number(v.sortOrder)) : (i + 1) * 10,
        }))
        .filter((v) => v.label && Number.isFinite(v.priceCents))
    : [];

  if (variants.length === 0 && useApparelSizes) {
    variants = NOVA_STORE_APPAREL_SIZES.map((label, i) => ({
      label,
      priceCents: defaultPriceCents,
      sku: null,
      stock: null,
      active: true,
      sortOrder: (i + 1) * 10,
    }));
  }
  if (variants.length === 0) {
    variants = [
      {
        label: "Default",
        priceCents: defaultPriceCents,
        sku: null,
        stock: null,
        active: true,
        sortOrder: 10,
      },
    ];
  }

  const product = await prisma.storeProduct.create({
    data: {
      name,
      slug,
      description,
      category,
      images,
      currency,
      active,
      sortOrder,
      variants: {
        create: variants.map((v) => ({
          label: v.label,
          priceCents: v.priceCents,
          sku: v.sku ?? undefined,
          stock: v.stock ?? undefined,
          active: v.active !== false,
          sortOrder: v.sortOrder ?? 0,
        })),
      },
    },
    include: { variants: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
  });

  return NextResponse.json({
    success: true,
    product: { ...product, images: asStringArray(product.images) },
  });
}
