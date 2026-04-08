ALTER TABLE "admins"
ADD COLUMN "deposit_bank_name" VARCHAR(100),
ADD COLUMN "deposit_account_holder" VARCHAR(100),
ADD COLUMN "deposit_account_number" VARCHAR(100),
ADD COLUMN "is_primary_deposit_account" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_admins_primary_deposit_account"
ON "admins"("is_primary_deposit_account");

CREATE UNIQUE INDEX "uq_admins_primary_deposit_account"
ON "admins"("is_primary_deposit_account")
WHERE "is_primary_deposit_account" = true;
