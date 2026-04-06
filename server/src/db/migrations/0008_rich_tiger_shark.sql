ALTER TABLE "realisasi" ALTER COLUMN "kontrak_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "permohonan_kontrak" ADD COLUMN "uraian_singkat" text;