ALTER TABLE "quarter_types"
ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pay_scale_range" VARCHAR(50),
ADD COLUMN "standard_area_sqm" DECIMAL(10,2),
ADD COLUMN "sanctioned_total" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sanctioned_occupied" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sanctioned_vacant" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sanctioned_damaged_unlivable" INTEGER NOT NULL DEFAULT 0;
