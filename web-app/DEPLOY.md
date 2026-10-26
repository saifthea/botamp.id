# Panduan Deploy ke Netlify

## 1. Persiapan Environment Variables

Buka dashboard Netlify → Site Settings → Environment Variables dan buat berikut:

| Kunci | Nilai | Keterangan |
|-------|-------|------------|
| `ADMIN_PASSWORD` | `4321` | Password admin login |
| `CUSTOMER_PASSWORD` | `0987` | Password customer login |
| `ADMIN_DELETED_PASSWORD` | `7890` | Password untuk akses hapus pesanan |
| `SHIPPING_API_KEY` | `b0ffff3c2299551401bdfcf35ea9be8283c0aab612cc0241c5d813e4f0f2a393` | API Kiriminaja |
| `MIDTRANS_SERVER_KEY` | `SB-Mid-server-P0rQd4I91NCRnAKsr4aZT5ns` | Midtrans server key |
| `MIDTRANS_CLIENT_KEY` | `SB-Mid-client-utf8sbbZ5sd2O9pf` | Midtrans client key |

## 2. Install Netlify CLI (jika belum)

```bash
npm install -g netlify-cli
```

## 3. Login ke Netlify

```bash
netlify login
```

## 4. Buat Site Baru

```bash
netlify init
```

Pilih "Create a new site" dan ikuti petunjuk.

## 5. Set Environment Variables

```bash
netlify env:set ADMIN_PASSWORD 4321
netlify env:set CUSTOMER_PASSWORD 0987
netlify env:set ADMIN_DELETED_PASSWORD 7890
netlify env:set SHIPPING_API_KEY "b0ffff3c2299551401bdfcf35ea9be8283c0aab612cc0241c5d813e4f0f2a393"
netlify env:set MIDTRANS_SERVER_KEY "SB-Mid-server-P0rQd4I91NCRnAKsr4aZT5ns"
netlify env:set MIDTRANS_CLIENT_KEY "SB-Mid-client-utf8sbbZ5sd2O9pf"
```

## 6. Deploy

```bash
netlify deploy --build --dir=.next/output/public --prod
```

## 7. Atur Build Settings di Dashboard Netlify

Buka **Site settings → Build & deploy → Build settings**:

- **Build command**: `npm run build`
- **Publish directory**: `.next/output/public`

## Catatan

- Aplikasi ini menggunakan **Next.js App Router** dengan **API Routes**. Netlify perlu plugin `@netlify/next` untuk menangani server-side rendering dengan benar.
- Pastikan `netlify.toml` sudah ada di root project.
- Firebase config (client-side) sudah diatur melalui environment variables dengan prefix `NEXT_PUBLIC_`.
- Password `deleteOrderPassword` sudah dipindahkan ke `ADMIN_DELETED_PASSWORD` environment variable (tidak ada di source code).