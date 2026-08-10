-- Narrow a vendor sub-account to part of the vendor's catalogue.
--
-- Deliberately additive and empty: NO rows for a sub-account means it works the
-- whole catalogue, which is exactly what every helper did before this table
-- existed. So this migration grants nothing and takes nothing away — a vendor
-- opts in per helper by picking products in the sub-account screen.
--
-- Modelled on "agent_product_assignments", which narrows a call-center agent the
-- same way. Keeping the two shapes identical means the scoping helpers read the
-- same and neither can drift into a different idea of "no rows".

CREATE TABLE IF NOT EXISTS "vendor_sub_account_products" (
    "id"           SERIAL       NOT NULL,
    "subAccountId" INTEGER      NOT NULL,
    "productId"    INTEGER      NOT NULL,
    "assignedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_sub_account_products_pkey" PRIMARY KEY ("id")
);

-- One row per (helper, product). The unique index also lets the save path use a
-- plain deleteMany + createMany without racing itself.
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_sub_account_products_subAccountId_productId_key"
    ON "vendor_sub_account_products" ("subAccountId", "productId");

CREATE INDEX IF NOT EXISTS "vendor_sub_account_products_subAccountId_idx"
    ON "vendor_sub_account_products" ("subAccountId");

CREATE INDEX IF NOT EXISTS "vendor_sub_account_products_productId_idx"
    ON "vendor_sub_account_products" ("productId");

-- CASCADE on both sides: deleting a helper drops its assignments, and a product
-- the vendor removes from the catalogue must not leave a dangling grant behind
-- that would silently come back if the id were ever reused.
DO $$
BEGIN
    ALTER TABLE "vendor_sub_account_products"
        ADD CONSTRAINT "vendor_sub_account_products_subAccountId_fkey"
        FOREIGN KEY ("subAccountId") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "vendor_sub_account_products"
        ADD CONSTRAINT "vendor_sub_account_products_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "products" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
