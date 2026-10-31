# Chayan deploy (ek VM par, Docker se)

Ek VM par app + Postgres + Redis + HTTPS (Caddy) sab chalta hai. Free VM: Oracle Cloud Always Free (ARM, 4 core/24 GB). Koi bhi 1-2 GB wala VPS bhi chalega.

1. Domain ka A-record VM ke IP par point karo. Ports 80 aur 443 kholo.
2. VM par Docker install karo, repo copy karo.
3. `cp deploy/.env.production.example deploy/.env.production` aur bharo (JWT secrets: `openssl rand -hex 48`, do alag).
4. `deploy/.env` me daalo: `DOMAIN=...`, `POSTGRES_PASSWORD=...` (DB_URL wala hi), `VITE_SUPPORT_CONTACT=...`
5. `cd deploy && docker compose -f docker-compose.prod.yml --env-file .env up -d --build`
   Pehli baar DB `db/chayan-db.sql` se apne aap bhar jata hai (sirf content, koi user nahi).
6. Login karo (OTP: `docker compose -f docker-compose.prod.yml logs app | grep -i otp`).
7. Apne user ko admin banao:
   `docker compose -f docker-compose.prod.yml exec postgres psql -U chayan chayan -c "UPDATE users SET role='super_admin' WHERE phone='91XXXXXXXXXX';"`
8. Testers ko paid access: Admin -> User Detail -> Plan access. Payment gateway abhi connected nahi hai.

Backup: `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U chayan chayan > backup.sql` (roz cron se).
Update: code badlo, step 5 dobara chalao.
Dhyan: sirf UP Police Constable me tests hain, baaki 9 exams me subjects/topics hain par tests 0.
