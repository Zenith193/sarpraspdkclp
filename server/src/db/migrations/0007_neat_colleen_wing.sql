CREATE TABLE "dasar_hukum" (
	"id" serial PRIMARY KEY NOT NULL,
	"tahun" integer NOT NULL,
	"isi" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ppkom" (
	"id" serial PRIMARY KEY NOT NULL,
	"nip" text NOT NULL,
	"nama" text NOT NULL,
	"pangkat" text,
	"jabatan" text,
	"alamat" text,
	"no_telp" text,
	"email" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "satuan_kerja" (
	"id" serial PRIMARY KEY NOT NULL,
	"nip" text NOT NULL,
	"nama_pimpinan" text NOT NULL,
	"jabatan" text,
	"website" text,
	"email" text,
	"telepon" text,
	"klpd" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "realisasi" ALTER COLUMN "target_persen" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "realisasi" ALTER COLUMN "target_persen" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "realisasi" ALTER COLUMN "realisasi_persen" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "realisasi" ALTER COLUMN "realisasi_persen" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "realisasi" ADD COLUMN "matrik_id" integer;--> statement-breakpoint
ALTER TABLE "realisasi" ADD COLUMN "dokumentasi_paths" text;--> statement-breakpoint
ALTER TABLE "realisasi" ADD CONSTRAINT "realisasi_matrik_id_matrik_kegiatan_id_fk" FOREIGN KEY ("matrik_id") REFERENCES "public"."matrik_kegiatan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realisasi" DROP COLUMN "dokumentasi_path";