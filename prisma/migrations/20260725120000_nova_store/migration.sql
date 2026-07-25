-- Nova Store: catalog, variants, orders

CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'apparel',
    "images" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreProduct_slug_key" ON "StoreProduct"("slug");
CREATE INDEX "StoreProduct_active_sortOrder_idx" ON "StoreProduct"("active", "sortOrder");
CREATE INDEX "StoreProduct_category_idx" ON "StoreProduct"("category");

CREATE TABLE "StoreProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sku" TEXT,
    "priceCents" INTEGER NOT NULL,
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StoreProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreProductVariant_productId_active_idx" ON "StoreProductVariant"("productId", "active");
CREATE UNIQUE INDEX "StoreProductVariant_productId_label_key" ON "StoreProductVariant"("productId", "label");

ALTER TABLE "StoreProductVariant" ADD CONSTRAINT "StoreProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StoreOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripeSessionId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "subtotalCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "shipName" TEXT,
    "shipLine1" TEXT,
    "shipLine2" TEXT,
    "shipCity" TEXT,
    "shipState" TEXT,
    "shipPostal" TEXT,
    "shipCountry" TEXT,
    "shipPhone" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreOrder_stripeSessionId_key" ON "StoreOrder"("stripeSessionId");
CREATE INDEX "StoreOrder_userId_createdAt_idx" ON "StoreOrder"("userId", "createdAt" DESC);
CREATE INDEX "StoreOrder_status_createdAt_idx" ON "StoreOrder"("status", "createdAt" DESC);
CREATE INDEX "StoreOrder_email_idx" ON "StoreOrder"("email");

ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed NovaStaris tees (black + white) with standard sizes; free shipping, Stripe USD
INSERT INTO "StoreProduct" ("id", "slug", "name", "description", "category", "images", "active", "sortOrder", "currency", "createdAt", "updatedAt")
VALUES
(
  'store_tee_black',
  'nova-tee-black',
  'NovaStaris Tee — Black',
  E'Premium black NovaStaris tee.\n\nFront: NOVASTARIS.AI wordmark in cyan-to-violet gradient with EXPLORE THE FUTURE.\nBack: matching wordmark plus QR — SCAN TO DISCOVER.\n\nShips free from Canada. Choose your size below.',
  'apparel',
  '["/nova-store/tee-black-front.png","/nova-store/tee-black-back.png"]',
  true,
  10,
  'usd',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'store_tee_white',
  'nova-tee-white',
  'NovaStaris Tee — White',
  E'Premium white NovaStaris tee.\n\nFront: NOVASTARIS.AI wordmark in cyan-to-violet gradient with EXPLORE THE FUTURE.\nBack: matching wordmark plus QR — SCAN TO DISCOVER.\n\nShips free from Canada. Choose your size below.',
  'apparel',
  '["/nova-store/tee-white-front.png","/nova-store/tee-white-back.png"]',
  true,
  20,
  'usd',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "StoreProductVariant" ("id", "productId", "label", "sku", "priceCents", "stock", "active", "sortOrder")
VALUES
('store_tee_black_xs', 'store_tee_black', 'XS', 'NOVA-TEE-BLK-XS', 3999, NULL, true, 10),
('store_tee_black_s', 'store_tee_black', 'S', 'NOVA-TEE-BLK-S', 3999, NULL, true, 20),
('store_tee_black_m', 'store_tee_black', 'M', 'NOVA-TEE-BLK-M', 3999, NULL, true, 30),
('store_tee_black_l', 'store_tee_black', 'L', 'NOVA-TEE-BLK-L', 3999, NULL, true, 40),
('store_tee_black_xl', 'store_tee_black', 'XL', 'NOVA-TEE-BLK-XL', 3999, NULL, true, 50),
('store_tee_black_xxl', 'store_tee_black', 'XXL', 'NOVA-TEE-BLK-XXL', 3999, NULL, true, 60),
('store_tee_black_3xl', 'store_tee_black', '3XL', 'NOVA-TEE-BLK-3XL', 3999, NULL, true, 70),
('store_tee_white_xs', 'store_tee_white', 'XS', 'NOVA-TEE-WHT-XS', 3999, NULL, true, 10),
('store_tee_white_s', 'store_tee_white', 'S', 'NOVA-TEE-WHT-S', 3999, NULL, true, 20),
('store_tee_white_m', 'store_tee_white', 'M', 'NOVA-TEE-WHT-M', 3999, NULL, true, 30),
('store_tee_white_l', 'store_tee_white', 'L', 'NOVA-TEE-WHT-L', 3999, NULL, true, 40),
('store_tee_white_xl', 'store_tee_white', 'XL', 'NOVA-TEE-WHT-XL', 3999, NULL, true, 50),
('store_tee_white_xxl', 'store_tee_white', 'XXL', 'NOVA-TEE-WHT-XXL', 3999, NULL, true, 60),
('store_tee_white_3xl', 'store_tee_white', '3XL', 'NOVA-TEE-WHT-3XL', 3999, NULL, true, 70);
