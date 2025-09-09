-- CreateTable
CREATE TABLE "public"."engine_snapshots" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "snapshotData" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engine_snapshots_pkey" PRIMARY KEY ("id")
);
