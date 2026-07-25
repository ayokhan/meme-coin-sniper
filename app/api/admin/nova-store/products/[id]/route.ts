import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { storeDb as prisma } from "@/lib/nova-store/db";
import { asStringArray, slugifyStoreName } from "@/lib/nova-store/constants";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type VariantInput = {
  id?: string;
  label: string;
  priceCents: number;
  sku?: string | null;
  stock?: number | null;
  active?: boolean;
  sortOrder?: number;
};

export async function GET(_request: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const product = await prisma.storeProduct.findUnique({
    where: { id },
    include: { variants: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
  });
  if (!product) {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    product: { ...product, images: asStringArray(product.images) },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.storeProduct.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim();
  if (typeof body.category === "string" && body.category.trim()) data.category = body.category.trim();
  if (typeof body.currency === "string" && body.currency.trim()) data.currency = body.currency.trim().toLowerCase();
  if (typeof body.active === "boolean") data.active = body.active;
  if (Number.isFinite(Number(body.sortOrder))) data.sortOrder = Math.floor(Number(body.sortOrder));
  if (Array.isArray(body.images)) data.images = asStringArray(body.images);
  if (typeof body.slug === "string" && body.slug.trim()) {
    let slug = slugifyStoreName(body.slug);
    if (slug && slug !== existing.slug) {
      const clash = await prisma.storeProduct.findUnique({ where: { slug } });
      if (clash && clash.id !== id) slug = `${slug}-${Date.now().toString(36)}`;
      data.slug = slug;
    }
  }

  await prisma.storeProduct.update({ where: { id }, data });

  if (Array.isArray(body.variants)) {
    const variants = (body.variants as VariantInput[])
      .map((v, i) => ({
        id: typeof v.id === "string" ? v.id : undefined,
        label: String(v.label ?? "").trim(),
        priceCents: Math.max(50, Math.round(Number(v.priceCents))),
        sku: v.sku != null ? String(v.sku).trim() || null : null,
        stock: v.stock == null ? null : Math.max(0, Math.floor(Number(v.stock))),
        active: v.active !== false,
        sortOrder: Number.isFinite(Number(v.sortOrder)) ? Math.floor(Number(v.sortOrder)) : (i + 1) * 10,
      }))
      .filter((v) => v.label && Number.isFinite(v.priceCents));

    const keepIds = variants.map((v) => v.id).filter((x): x is string => !!x);
    await prisma.storeProductVariant.deleteMany({
      where: { productId: id, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) },
    });

    for (const v of variants) {
      if (v.id) {
        await prisma.storeProductVariant.updateMany({
          where: { id: v.id, productId: id },
          data: {
            label: v.label,
            priceCents: v.priceCents,
            sku: v.sku,
            stock: v.stock,
            active: v.active,
            sortOrder: v.sortOrder,
          },
        });
      } else {
        await prisma.storeProductVariant.create({
          data: {
            productId: id,
            label: v.label,
            priceCents: v.priceCents,
            sku: v.sku ?? undefined,
            stock: v.stock ?? undefined,
            active: v.active,
            sortOrder: v.sortOrder,
          },
        });
      }
    }
  }

  const product = await prisma.storeProduct.findUnique({
    where: { id },
    include: { variants: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
  });

  return NextResponse.json({
    success: true,
    product: product ? { ...product, images: asStringArray(product.images) } : null,
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const { id } = await ctx.params;
  await prisma.storeProduct.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ success: true });
}
