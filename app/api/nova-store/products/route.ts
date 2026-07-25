import { NextResponse } from "next/server";
import { storeDb as prisma } from "@/lib/nova-store/db";
import { isNovaStoreEnabled } from "@/lib/nova-store/access";
import { asStringArray } from "@/lib/nova-store/constants";

export const dynamic = "force-dynamic";

/** Public catalog of active Nova Store products. */
export async function GET() {
  if (!(await isNovaStoreEnabled())) {
    return NextResponse.json({ success: false, error: "Nova Store is temporarily unavailable." }, { status: 403 });
  }

  const products = await prisma.storeProduct.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      variants: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      },
    },
  });

  return NextResponse.json({
    success: true,
    products: products.map((p: any) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      category: p.category,
      images: asStringArray(p.images),
      currency: p.currency,
      variants: (p.variants ?? []).map((v: any) => ({
        id: v.id,
        label: v.label,
        priceCents: v.priceCents,
        stock: v.stock,
        sku: v.sku,
      })),
    })),
  });
}
