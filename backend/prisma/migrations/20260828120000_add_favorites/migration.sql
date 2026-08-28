-- CreateTable
CREATE TABLE "favorites" (
    "id" SERIAL NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "media_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorites_telegram_user_id_media_id_key" ON "favorites"("telegram_user_id", "media_id");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "channel_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
