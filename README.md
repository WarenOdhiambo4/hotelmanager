# Campus Food

Order food from verified campus hotels, pay the hotel directly by M-PESA, and track it to your hostel.

This repository is the website and the installable **Skool** phone app, built with React 19, TypeScript, Vite and
Tailwind CSS 4. One codebase serves two surfaces:

- **The site:** for students, hotels and riders.
- **The admin portal:** for platform administrators.

The database and payments are in [campusbackend](https://github.com/WarenOdhiambo4/campusbackend).

**Status:** live. The public site is **https://campus.waren.digital** and the admin portal is
**https://admin.waren.digital**. Each is a separate Vercel project, deployed on every push to `main`.

## Prerequisites

- Node.js 22.12 or newer
- The Supabase project URL and publishable key

## Quick start

1. Install the packages:

   ```bash
   npm ci
   ```

2. Create your local settings file:

   ```bash
   cp .env.example .env.local
   ```

   Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the publishable key, never the service role key),
   `VITE_SITE_URL`, `VITE_ADMIN_URL`, `VITE_WHATSAPP_NUMBER`, `VITE_ELEVENLABS_AGENT_ID` and
   `VITE_TURNSTILE_SITE_KEY`.

3. Start the site, then open http://localhost:5180:

   ```bash
   npm run dev
   ```

   For the admin portal on http://localhost:5181, run this instead:

   ```bash
   npm run dev:admin
   ```

Other commands:

- `npm test`
- `npm run typecheck`
- `npm run build`, which builds the site into `dist/`
- `npm run build:admin`, which builds the admin portal into `dist-admin/`

## Usage

A student opens the menu, adds food from one hotel, pays by M-PESA and follows the order under **Orders**. On a
phone, the site offers to install **Skool**, and a tab bar along the bottom gives Home, Menu, Cart, Orders and
Messages. See [Install the Skool app](https://github.com/WarenOdhiambo4/campusbackend/blob/main/docs/how-to/install-the-skool-app.md).

## Documentation

All Campus Food documentation lives in the backend repository, next to the code it describes:
[campusbackend/docs](https://github.com/WarenOdhiambo4/campusbackend/blob/main/docs/README.md).

What changed and when: [CHANGELOG.md](CHANGELOG.md).

## Support and contact

Maintainer: Waren Odhiambo, info@waren.digital.

## Contributing

Branch from `main` and keep each change small. Run `npm test` and `npm run build` before you push, and update the
matching document in the backend `docs/` folder. Never commit `.env*` files or keys.

## Licence

No licence is granted. All rights reserved by the project owner. Contact the maintainer before using this code.
