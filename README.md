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
3. API ortam degiskenlerini olustur:
	 - [apps/api/.env.example](apps/api/.env.example) dosyasini [apps/api/.env](apps/api/.env) olarak kopyala ve duzenle.

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

## Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/api-spec.md](docs/api-spec.md)
- [docs/implementation-plan.md](docs/implementation-plan.md)
