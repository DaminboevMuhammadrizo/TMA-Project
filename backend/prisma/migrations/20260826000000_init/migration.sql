-- CreateEnum
CREATE TYPE "Category" AS ENUM ('AUDIO', 'VIDEO', 'IMAGE_STICKER');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('AUDIO', 'VOICE', 'VIDEO', 'VIDEO_NOTE', 'PHOTO', 'ANIMATION', 'STICKER');

-- CreateTable
CREATE TABLE "channel_media" (
    "id" SERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "category" "Category" NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "file_id" TEXT NOT NULL,
    "file_unique_id" TEXT NOT NULL,
    "caption" TEXT,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reply_to_message_id" BIGINT,
    "reply_to_text" TEXT,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "duration_sec" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "file_name" TEXT,
    "thumb_file_unique_id" TEXT,
    "sticker_set_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_media_message_id_key" ON "channel_media"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_media_file_unique_id_key" ON "channel_media"("file_unique_id");
