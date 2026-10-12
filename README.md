# UstaTakvimi - Workforce Calendar and Request Management

UstaTakvimi, insaat sirketleri icin uzmanlik bazli musaitlik takvimi, musteri talep toplama ve yonetici tarafinda manuel isci atama surecini birlestiren bir platformdur.

## Tech Stack

- Frontend: Next.js (React) + Tailwind CSS + Lucide React + FullCalendar
- Backend: Node.js (Express) + Zod
- Database: MySQL 8+

## Workspace Layout

- apps/web: Next.js uygulamasi (musteri ve admin ekranlari)
- apps/api: Express API (moduler katmanli yapi)
- packages/shared: Ortak enum ve API contract tipleri
- database/schema.sql: MySQL tablo, index ve constraint tanimlari
- docs: Mimari, API spec ve uygulama plani dokumanlari

## Setup

1. Bagimliliklari kur:
	 npm install
2. MySQL veritabanini hazirla ve [database/schema.sql](database/schema.sql) dosyasini calistir.
3. Iskelet verisini yukle:
	 - [database/seed.sql](database/seed.sql) dosyasini MySQL veritabanina calistir.
4. API ortam degiskenlerini olustur:
	 - [apps/api/.env.example](apps/api/.env.example) dosyasini [apps/api/.env](apps/api/.env) olarak kopyala ve duzenle.
	 - Varsayilan admin girisi: username=admin, password=admin123

## Run

- API:
	npm run dev:api
- Web:
	npm run dev:web

Varsayilan adresler:

- API: http://localhost:4000
- Web: http://localhost:3000

## Implemented Endpoints (Initial)

- GET /api/v1/availability
- POST /api/v1/requests
- GET /api/v1/admin/requests
- GET /api/v1/admin/requests/:id/available-workers
- POST /api/v1/admin/requests/:id/assignments

## Key Constraint for Conflict Detection

Assignment cakismasi DB seviyesinde engellenir:

- assignments(worker_id, assignment_date) UNIQUE

Bu sayede ayni iscinin ayni gunde birden fazla talebe atanmasi engellenir.

## Deployment (cPanel, split hosting)

Frontend (statik Next.js export) ana domaine, API (Node.js) bir alt domaine kurulur. [deploy.yml](.github/workflows/deploy.yml) her `main` push'unda ikisini de FTP ile gonderir.

Bir kerelik cPanel hazirligi:

1. **MySQL Databases**: veritabani + kullanici olustur, kullaniciyi veritabanina ekle (ALL PRIVILEGES). **phpMyAdmin** ile [database/schema.sql](database/schema.sql) ve [database/seed.sql](database/seed.sql) dosyalarini import et.
2. **Domains/Subdomains**: `api.alanadiniz.com` alt domainini olustur (SSL/AutoSSL aktif olmali).
3. **Setup Node.js App** > Create Application:
	 - Node.js version: 20 veya uzeri, Application mode: **Production**
	 - Application root: `usta-api` (workflow'un varsayilani; farkliysa `FTP_API_DIR` secret'i ayarla)
	 - Application URL: `api.alanadiniz.com`
	 - Startup file: `server.cjs`
	 - Environment variables: `DB_HOST=localhost`, `DB_PORT=3306`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `APP_TOKEN_SECRET` (uzun rastgele metin), `CORS_ORIGIN=https://alanadiniz.com,https://www.alanadiniz.com`, `PUBLIC_API_URL=https://api.alanadiniz.com`, `UPLOAD_DIR=/home/CPANELKULLANICI/usta-uploads`
	 - Production modunda bu degiskenlerden biri eksikse API acilmaz ve veritabani erisilemezse ornek veri yerine 503 doner.
4. GitHub repository secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `NEXT_PUBLIC_API_URL` (`https://api.alanadiniz.com`), opsiyonel `NEXT_PUBLIC_SITE_URL`, `FTP_WEB_DIR` (varsayilan `./public_html/`), `FTP_API_DIR` (varsayilan `./usta-api/`).

API tek dosyaya (`apps/api/dist/server.cjs`) paketlenir; sunucuda `npm install` gerekmez. Her deploy'da `tmp/restart.txt` guncellenir ve uygulama otomatik yeniden baslar. Kontrol: `https://api.alanadiniz.com/health`.

## Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/api-spec.md](docs/api-spec.md)
- [docs/implementation-plan.md](docs/implementation-plan.md)
