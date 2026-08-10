-- Call-center facturation: what a CALL_CENTER_AGENT bills for the parcels they
-- saisi that actually reached the customer.
--
-- Deliberately a second pair of tables rather than a reuse of "invoices":
-- "leads"."invoiceId" is a single FK already spoken for by the vendor's invoice
-- (see the bulk-dispatch route), so billing the agent through it would take the
-- lead off the vendor's invoice. Nothing here touches the vendor side.
--
-- Purely additive: no existing row changes, and an agent starts with zero
-- invoices and every delivered parcel billable — which is the correct opening
-- position, since none of them has ever been paid out through this path.

CREATE TABLE IF NOT EXISTS "agent_invoices" (
    "id"              SERIAL       NOT NULL,
    "invoiceNumber"   TEXT         NOT NULL,
    "agentId"         INTEGER      NOT NULL,
    "feePerParcelMad" DOUBLE PRECISION NOT NULL,
    "parcelCount"     INTEGER      NOT NULL,
    "totalAmountMad"  DOUBLE PRECISION NOT NULL,
    "status"          TEXT         NOT NULL DEFAULT 'PAID',
    "periodFrom"      TIMESTAMP(3),
    "periodTo"        TIMESTAMP(3),
    "paidAt"          TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_invoices_invoiceNumber_key"
    ON "agent_invoices" ("invoiceNumber");

CREATE INDEX IF NOT EXISTS "agent_invoices_agentId_idx"
    ON "agent_invoices" ("agentId");

CREATE TABLE IF NOT EXISTS "agent_invoice_items" (
    "id"             SERIAL       NOT NULL,
    "invoiceId"      INTEGER      NOT NULL,
    "leadId"         INTEGER      NOT NULL,
    "amountMad"      DOUBLE PRECISION NOT NULL,
    "parcelValueMad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_invoice_items_pkey" PRIMARY KEY ("id")
);

-- The unique index is the idempotency guard, not a tidiness constraint: it is
-- what makes a double-clicked "générer la facture" impossible to pay twice.
CREATE UNIQUE INDEX IF NOT EXISTS "agent_invoice_items_leadId_key"
    ON "agent_invoice_items" ("leadId");

CREATE INDEX IF NOT EXISTS "agent_invoice_items_invoiceId_idx"
    ON "agent_invoice_items" ("invoiceId");

-- CASCADE from the agent: a deleted user takes their own billing history with
-- them, and nothing else references these rows.
DO $$
BEGIN
    ALTER TABLE "agent_invoices"
        ADD CONSTRAINT "agent_invoices_agentId_fkey"
        FOREIGN KEY ("agentId") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "agent_invoice_items"
        ADD CONSTRAINT "agent_invoice_items_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "agent_invoices" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "agent_invoice_items"
        ADD CONSTRAINT "agent_invoice_items_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "leads" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
