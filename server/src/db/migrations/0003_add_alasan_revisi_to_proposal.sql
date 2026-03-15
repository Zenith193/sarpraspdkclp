CREATE TABLE "spl_generated" (
	"id" serial PRIMARY KEY NOT NULL,
	"matrik_id" integer NOT NULL,
	"template_id" integer,
	"nama_file" text,
	"file_path" text,
	"upload_status" text DEFAULT 'done',
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "iklan" ADD COLUMN "script_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "iklan" ADD COLUMN "posisi" text DEFAULT 'head';--> statement-breakpoint
ALTER TABLE "iklan" ADD COLUMN "aktif" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "matrik_kegiatan" ADD COLUMN "no_hp" text;--> statement-breakpoint
ALTER TABLE "matrik_kegiatan" ADD COLUMN "konsultan_pengawas" text;--> statement-breakpoint
ALTER TABLE "matrik_kegiatan" ADD COLUMN "dir_konsultan_pengawas" text;--> statement-breakpoint
ALTER TABLE "matrik_kegiatan" ADD COLUMN "no_mc0" text;--> statement-breakpoint
ALTER TABLE "matrik_kegiatan" ADD COLUMN "tgl_mc0" date;--> statement-breakpoint
ALTER TABLE "matrik_kegiatan" ADD COLUMN "no_mc100" text;--> statement-breakpoint
ALTER TABLE "matrik_kegiatan" ADD COLUMN "tgl_mc100" date;--> statement-breakpoint
ALTER TABLE "matrik_kegiatan" ADD COLUMN "no_pcm" text;--> statement-breakpoint
ALTER TABLE "matrik_kegiatan" ADD COLUMN "tgl_pcm" date;--> statement-breakpoint
ALTER TABLE "proposal" ADD COLUMN "alasan_revisi" text;--> statement-breakpoint
ALTER TABLE "riwayat_bantuan" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "riwayat_bantuan" ADD COLUMN "file_path" text;--> statement-breakpoint
ALTER TABLE "riwayat_bantuan" ADD COLUMN "upload_status" text DEFAULT 'done';--> statement-breakpoint
ALTER TABLE "sarpras" ADD COLUMN "status" text DEFAULT 'Diverifikasi';--> statement-breakpoint
ALTER TABLE "sarpras" ADD COLUMN "action_type" text;--> statement-breakpoint
ALTER TABLE "sarpras" ADD COLUMN "alasan_penolakan" text;--> statement-breakpoint
ALTER TABLE "sekolah" ADD COLUMN "kop_sekolah" text;--> statement-breakpoint
ALTER TABLE "sekolah" ADD COLUMN "denah_sekolah" text;--> statement-breakpoint
ALTER TABLE "sekolah" ADD COLUMN "kop_upload_status" text DEFAULT 'done';--> statement-breakpoint
ALTER TABLE "sekolah" ADD COLUMN "denah_upload_status" text DEFAULT 'done';--> statement-breakpoint
ALTER TABLE "spl_generated" ADD CONSTRAINT "spl_generated_matrik_id_matrik_kegiatan_id_fk" FOREIGN KEY ("matrik_id") REFERENCES "public"."matrik_kegiatan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spl_generated" ADD CONSTRAINT "spl_generated_template_id_bast_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."bast_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spl_generated" ADD CONSTRAINT "spl_generated_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "tipe_iklan";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "gambar_url";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "target_url";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "advertiser";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "biaya_per_klik";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "biaya_per_tayang";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "budget_total";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "budget_terpakai";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "total_tayang";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "total_klik";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "tanggal_mulai";--> statement-breakpoint
ALTER TABLE "iklan" DROP COLUMN "tanggal_selesai";