-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('BATCH', 'EXPRESS');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COLLECTED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ORDER_RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(200),
    "price" INTEGER NOT NULL,
    "image_url" VARCHAR(500),
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "daily_stock" INTEGER NOT NULL DEFAULT 0,
    "stock_remaining" INTEGER NOT NULL DEFAULT 0,
    "stock_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_locations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "delivery_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_slots" (
    "id" SERIAL NOT NULL,
    "location_id" INTEGER NOT NULL,
    "delivery_time" CHAR(5) NOT NULL,
    "cutoff_time" CHAR(5) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "closed_on" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "delivery_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "orders_paused" BOOLEAN NOT NULL DEFAULT false,
    "express_enabled" BOOLEAN NOT NULL DEFAULT true,
    "express_fee" INTEGER NOT NULL DEFAULT 30,
    "express_eta_min_minutes" INTEGER NOT NULL DEFAULT 30,
    "express_eta_max_minutes" INTEGER NOT NULL DEFAULT 40,
    "express_opens_at" CHAR(5) NOT NULL DEFAULT '11:00',
    "express_closes_at" CHAR(5) NOT NULL DEFAULT '23:00',
    "batch_fee" INTEGER NOT NULL DEFAULT 0,
    "contact_phone" CHAR(10),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "delivery_settings_pkey" PRIMARY KEY ("id")
);

-- Hand-written: order numbers start at 1001 (Batch 1 §7.3)
CREATE SEQUENCE order_number_seq START WITH 1001;

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "order_number" VARCHAR(20) NOT NULL DEFAULT ('BB'::text || (nextval('order_number_seq'::regclass))::text),
    "client_request_id" UUID NOT NULL,
    "customer_name" VARCHAR(60) NOT NULL,
    "customer_phone" CHAR(10) NOT NULL,
    "address_detail" VARCHAR(120),
    "delivery_mode" "DeliveryMode" NOT NULL,
    "delivery_date" DATE NOT NULL,
    "location_id" INTEGER NOT NULL,
    "location_name" VARCHAR(40) NOT NULL,
    "slot_id" INTEGER,
    "slot_delivery_time" CHAR(5),
    "express_eta_min_minutes" INTEGER,
    "express_eta_max_minutes" INTEGER,
    "food_subtotal" INTEGER NOT NULL,
    "delivery_fee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'COD',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "status" "OrderStatus" NOT NULL DEFAULT 'ORDER_RECEIVED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "collected_at" TIMESTAMPTZ(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER NOT NULL,
    "item_name" VARCHAR(60) NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE INDEX "menu_items_is_active_is_available_sort_order_idx" ON "menu_items"("is_active", "is_available", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_locations_name_key" ON "delivery_locations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_slots_location_id_delivery_time_key" ON "delivery_slots"("location_id", "delivery_time");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_client_request_id_key" ON "orders"("client_request_id");

-- CreateIndex
CREATE INDEX "orders_delivery_date_status_idx" ON "orders"("delivery_date", "status");

-- CreateIndex
CREATE INDEX "orders_delivery_date_slot_id_idx" ON "orders"("delivery_date", "slot_id");

-- CreateIndex
CREATE INDEX "orders_customer_phone_delivery_date_idx" ON "orders"("customer_phone", "delivery_date");

-- CreateIndex
CREATE INDEX "orders_status_delivery_mode_idx" ON "orders"("status", "delivery_mode");

-- CreateIndex
CREATE INDEX "order_items_menu_item_id_idx" ON "order_items"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_menu_item_id_key" ON "order_items"("order_id", "menu_item_id");

-- AddForeignKey
ALTER TABLE "delivery_slots" ADD CONSTRAINT "delivery_slots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "delivery_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "delivery_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "delivery_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: sequence ownership, CHECK constraints and the settings row (Batch 1 §7.3)
ALTER SEQUENCE order_number_seq OWNED BY orders.order_number;

-- menu_items
ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_price_positive      CHECK (price > 0),
  ADD CONSTRAINT menu_items_daily_stock_nonneg  CHECK (daily_stock >= 0),
  ADD CONSTRAINT menu_items_stock_nonneg        CHECK (stock_remaining >= 0),
  ADD CONSTRAINT menu_items_stock_le_daily      CHECK (stock_remaining <= daily_stock);

-- delivery_slots
ALTER TABLE delivery_slots
  ADD CONSTRAINT delivery_slots_delivery_fmt CHECK (delivery_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT delivery_slots_cutoff_fmt   CHECK (cutoff_time   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT delivery_slots_cutoff_first CHECK (cutoff_time COLLATE "C" < delivery_time COLLATE "C");

-- delivery_settings: exactly one row
ALTER TABLE delivery_settings
  ADD CONSTRAINT delivery_settings_singleton CHECK (id = 1),
  ADD CONSTRAINT delivery_settings_fees      CHECK (express_fee >= 0 AND batch_fee >= 0),
  ADD CONSTRAINT delivery_settings_eta       CHECK (express_eta_min_minutes >= 1
                                                    AND express_eta_min_minutes <= express_eta_max_minutes
                                                    AND express_eta_max_minutes <= 180),
  ADD CONSTRAINT delivery_settings_hours_fmt CHECK (express_opens_at  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                                                AND express_closes_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT delivery_settings_hours     CHECK (express_opens_at COLLATE "C" < express_closes_at COLLATE "C"),
  ADD CONSTRAINT delivery_settings_phone     CHECK (contact_phone IS NULL OR contact_phone ~ '^[6-9][0-9]{9}$');

INSERT INTO delivery_settings (id, updated_at) VALUES (1, now());

-- orders
ALTER TABLE orders
  ADD CONSTRAINT orders_phone_fmt      CHECK (customer_phone ~ '^[6-9][0-9]{9}$'),
  ADD CONSTRAINT orders_amounts        CHECK (food_subtotal > 0 AND delivery_fee >= 0),
  ADD CONSTRAINT orders_total          CHECK (total = food_subtotal + delivery_fee),
  ADD CONSTRAINT orders_mode_fields    CHECK (
    (delivery_mode = 'BATCH'   AND slot_id IS NOT NULL AND slot_delivery_time IS NOT NULL
                               AND express_eta_min_minutes IS NULL AND express_eta_max_minutes IS NULL)
    OR
    (delivery_mode = 'EXPRESS' AND slot_id IS NULL AND slot_delivery_time IS NULL
                               AND express_eta_min_minutes IS NOT NULL AND express_eta_max_minutes IS NOT NULL)
  ),
  ADD CONSTRAINT orders_cancel_unpaid  CHECK (NOT (status = 'CANCELLED' AND payment_status = 'COLLECTED'));

-- order_items
ALTER TABLE order_items
  ADD CONSTRAINT order_items_qty        CHECK (quantity >= 1),
  ADD CONSTRAINT order_items_price      CHECK (unit_price > 0),
  ADD CONSTRAINT order_items_line_total CHECK (line_total = unit_price * quantity);
