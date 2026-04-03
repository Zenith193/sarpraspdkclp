CREATE TABLE "permohonan_kontrak" (
	"id" serial PRIMARY KEY NOT NULL,
	"perusahaan_id" integer NOT NULL,
	"matrik_id" integer,
	"kode_sirup" text NOT NULL,
	"nama_paket" text,
	"metode_pengadaan" text,
	"jenis_pengadaan" text,
	"no_dppl" text,
	"tanggal_dppl" date,
	"no_bahpl" text,
	"tanggal_bahpl" date,
	"berkas_penawaran_path" text,
	"no_spk" text,
	"nilai_kontrak" bigint,
	"terbilang_kontrak" text,
	"tanggal_mulai" date,
	"tanggal_selesai" date,
	"waktu_penyelesaian" text,
	"tata_cara_pembayaran" text,
	"uang_muka" text,
	"nilai_items" text,
	"no_sp" text,
	"tanggal_sp" date,
	"id_paket" text,
	"status" text DEFAULT 'Menunggu',
	"catatan" text,
	"created_by" text,
	"verified_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "realisasi" (
	"id" serial PRIMARY KEY NOT NULL,
	"kontrak_id" integer NOT NULL,
	"nama_sekolah" text,
	"tahun" integer NOT NULL,
	"bulan" integer NOT NULL,
	"target_persen" integer DEFAULT 0,
	"realisasi_persen" integer DEFAULT 0,
	"dokumentasi_path" text,
	"keterangan" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "permohonan_kontrak" ADD CONSTRAINT "permohonan_kontrak_perusahaan_id_perusahaan_id_fk" FOREIGN KEY ("perusahaan_id") REFERENCES "public"."perusahaan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permohonan_kontrak" ADD CONSTRAINT "permohonan_kontrak_matrik_id_matrik_kegiatan_id_fk" FOREIGN KEY ("matrik_id") REFERENCES "public"."matrik_kegiatan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permohonan_kontrak" ADD CONSTRAINT "permohonan_kontrak_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permohonan_kontrak" ADD CONSTRAINT "permohonan_kontrak_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realisasi" ADD CONSTRAINT "realisasi_kontrak_id_permohonan_kontrak_id_fk" FOREIGN KEY ("kontrak_id") REFERENCES "public"."permohonan_kontrak"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realisasi" ADD CONSTRAINT "realisasi_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;