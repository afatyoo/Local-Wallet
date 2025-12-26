# My Local Wallet (Docker)

## Quick start

1. Copy env:
   - `cp .env.example .env`
   - Edit `.env` values.

2. Run:
   - `docker compose up -d --build`

3. Open:
   - http://localhost:3000

## If you previously ran with wrong env vars
Reset volumes (this deletes DB data):

- `docker compose down -v`
- `docker compose up -d --build`
