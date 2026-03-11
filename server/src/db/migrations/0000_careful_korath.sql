CREATE TABLE "arsip_checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"sekolah_nama" text NOT NULL,
	"sekolah_alamat" text,
	"jenis_usulan" text,
	"items" jsonb DEFAULT '[]'::jsonb,
	"verifikators" jsonb DEFAULT '[]'::jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "arsip_rekomendasi" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama_sekolah" text NOT NULL,
	"kecamatan" text,
	"sub_kegiatan" text,
	"perihal" text,
	"jenjang" text,
	"nilai" text,
	"target" text,
	"no_agenda" text,
	"surat_masuk" text,
	"tanggal_surat" text,
	"nomor_surat" text,
	"kondisi" text,
	"sumber" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"image" text,
	"role" text DEFAULT 'sekolah' NOT NULL,
	"sekolah_id" integer,
	"aktif" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "iklan" (
	"id" serial PRIMARY KEY NOT NULL,
	"judul" text NOT NULL,
	"deskripsi" text,
	"tipe_iklan" text DEFAULT 'banner' NOT NULL,
	"gambar_url" text,
	"target_url" text,
	"advertiser" text NOT NULL,
	"biaya_per_klik" real DEFAULT 0,
	"biaya_per_tayang" real DEFAULT 0,
	"budget_total" real DEFAULT 0,
	"budget_terpakai" real DEFAULT 0,
	"total_tayang" integer DEFAULT 0,
	"total_klik" integer DEFAULT 0,
	"status" text DEFAULT 'aktif' NOT NULL,
	"tanggal_mulai" date,
	"tanggal_selesai" date,
	"prioritas" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aktivitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"nama_akun" text,
	"jenis_akun" text,
	"aktivitas" text NOT NULL,
	"keterangan" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "bast" (
	"id" serial PRIMARY KEY NOT NULL,
	"matrik_id" integer NOT NULL,
	"template_id" integer,
	"no_bast" text,
	"npsn" text,
	"nama_sekolah" text,
	"nama_paket" text,
	"nilai_kontrak" bigint,
	"penyedia" text,
	"tanggal_bast" date,
	"generated_html" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bast_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"header" text,
	"deskripsi" text,
	"jenis_cocok" text,
	"content" text,
	"file_path" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_kerusakan" (
	"id" serial PRIMARY KEY NOT NULL,
	"sekolah_id" integer NOT NULL,
	"masa_bangunan" text,
	"file_name" text,
	"file_path" text,
	"upload_status" text DEFAULT 'done',
	"status" text DEFAULT 'Belum Upload',
	"alasan_penolakan" text,
	"verified_by" text,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "korwil_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kecamatan" text NOT NULL,
	"jenjang" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matrik_kegiatan" (
	"id" serial PRIMARY KEY NOT NULL,
	"no_matrik" text NOT NULL,
	"npsn" text,
	"nama_sekolah" text,
	"sub_bidang" text,
	"no_sub_kegiatan" text,
	"sub_kegiatan" text,
	"rup" text,
	"nama_paket" text,
	"pagu_anggaran" bigint,
	"pagu_paket" bigint,
	"hps" bigint,
	"nilai_kontrak" bigint,
	"terbilang_kontrak" text,
	"sumber_dana" text,
	"metode" text,
	"jenis_pengadaan" text,
	"penyedia" text,
	"nama_pemilik" text,
	"status_pemilik" text,
	"alamat_kantor" text,
	"no_spk" text,
	"tanggal_mulai" date,
	"tanggal_selesai" date,
	"jangka_waktu" integer,
	"tahun_anggaran" integer,
	"honor" bigint DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pencairan" (
	"id" serial PRIMARY KEY NOT NULL,
	"matrik_id" integer NOT NULL,
	"pencairan_persen" integer DEFAULT 0,
	"status" text DEFAULT 'Belum Masuk',
	"no_register" text,
	"no_sp2d" text,
	"hari_kalender" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pencairan_matrik_id_unique" UNIQUE("matrik_id")
);
--> statement-breakpoint
CREATE TABLE "prestasi" (
	"id" serial PRIMARY KEY NOT NULL,
	"sekolah_id" integer NOT NULL,
	"jenis_prestasi" text NOT NULL,
	"siswa" text NOT NULL,
	"kategori" text NOT NULL,
	"tingkat" text NOT NULL,
	"tahun" integer,
	"capaian" text,
	"sertifikat_path" text,
	"upload_status" text DEFAULT 'done',
	"status" text DEFAULT 'Menunggu Verifikasi',
	"alasan_penolakan" text,
	"verified_by" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prestasi_point_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"tingkat" text NOT NULL,
	"kategori" text NOT NULL,
	"capaian" text NOT NULL,
	"poin" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal" (
	"id" serial PRIMARY KEY NOT NULL,
	"sekolah_id" integer NOT NULL,
	"sub_kegiatan" text NOT NULL,
	"nilai_pengajuan" bigint,
	"target" text,
	"no_agenda_surat" text,
	"tanggal_surat" date,
	"status_usulan" text,
	"keterangan" text,
	"status" text DEFAULT 'Menunggu Verifikasi' NOT NULL,
	"bintang" integer DEFAULT 0,
	"keranjang" text,
	"ranking" integer,
	"file_name" text,
	"file_path" text,
	"upload_status" text DEFAULT 'done',
	"verified_by" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_foto" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"upload_status" text DEFAULT 'done',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proyeksi_anggaran" (
	"id" serial PRIMARY KEY NOT NULL,
	"jenis_prasarana" text NOT NULL,
	"jenjang" text NOT NULL,
	"lantai" integer DEFAULT 1,
	"rusak_sedang" bigint DEFAULT 0,
	"rusak_berat" bigint DEFAULT 0,
	"pembangunan" bigint DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "riwayat_bantuan" (
	"id" serial PRIMARY KEY NOT NULL,
	"sekolah_id" integer NOT NULL,
	"nama_paket" text NOT NULL,
	"nilai_paket" integer,
	"volume_paket" text,
	"bast_id" integer,
	"tahun" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sarpras" (
	"id" serial PRIMARY KEY NOT NULL,
	"sekolah_id" integer NOT NULL,
	"masa_bangunan" text,
	"jenis_prasarana" text NOT NULL,
	"nama_ruang" text NOT NULL,
	"lantai" integer DEFAULT 1,
	"panjang" double precision,
	"lebar" double precision,
	"luas" double precision,
	"kondisi" text NOT NULL,
	"keterangan" text,
	"bintang" integer DEFAULT 0,
	"verified" boolean DEFAULT false,
	"verified_by" text,
	"verified_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sarpras_foto" (
	"id" serial PRIMARY KEY NOT NULL,
	"sarpras_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"geo_lat" double precision,
	"geo_lng" double precision,
	"upload_status" text DEFAULT 'done',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sekolah" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"npsn" varchar(20) NOT NULL,
	"jenjang" text NOT NULL,
	"kecamatan" text NOT NULL,
	"status" text NOT NULL,
	"alamat" text,
	"kepsek" text,
	"nip" text,
	"no_rek" text,
	"nama_bank" text,
	"rombel" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sekolah_npsn_unique" UNIQUE("npsn")
);
--> statement-breakpoint
CREATE TABLE "snp_acuan" (
	"id" serial PRIMARY KEY NOT NULL,
	"jenis_prasarana" text NOT NULL,
	"jenjang" text NOT NULL,
	"judul_rehabilitasi" text,
	"judul_pembangunan" text
);
--> statement-breakpoint
ALTER TABLE "arsip_checklist" ADD CONSTRAINT "arsip_checklist_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arsip_rekomendasi" ADD CONSTRAINT "arsip_rekomendasi_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aktivitas" ADD CONSTRAINT "aktivitas_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bast" ADD CONSTRAINT "bast_matrik_id_matrik_kegiatan_id_fk" FOREIGN KEY ("matrik_id") REFERENCES "public"."matrik_kegiatan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bast" ADD CONSTRAINT "bast_template_id_bast_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."bast_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bast" ADD CONSTRAINT "bast_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_kerusakan" ADD CONSTRAINT "form_kerusakan_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "public"."sekolah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_kerusakan" ADD CONSTRAINT "form_kerusakan_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_kerusakan" ADD CONSTRAINT "form_kerusakan_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "korwil_assignment" ADD CONSTRAINT "korwil_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pencairan" ADD CONSTRAINT "pencairan_matrik_id_matrik_kegiatan_id_fk" FOREIGN KEY ("matrik_id") REFERENCES "public"."matrik_kegiatan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestasi" ADD CONSTRAINT "prestasi_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "public"."sekolah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestasi" ADD CONSTRAINT "prestasi_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestasi" ADD CONSTRAINT "prestasi_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "public"."sekolah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_foto" ADD CONSTRAINT "proposal_foto_proposal_id_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarpras" ADD CONSTRAINT "sarpras_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "public"."sekolah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarpras" ADD CONSTRAINT "sarpras_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarpras" ADD CONSTRAINT "sarpras_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarpras_foto" ADD CONSTRAINT "sarpras_foto_sarpras_id_sarpras_id_fk" FOREIGN KEY ("sarpras_id") REFERENCES "public"."sarpras"("id") ON DELETE cascade ON UPDATE no action;