# Deploying to DigitalOcean

| Part | What it is |
|---|---|
| **Droplet** (Ubuntu + Docker, 2 GB) | runs two containers: `web` (Caddy: Angular site + HTTPS, forwards `/api`) and `api` (ASP.NET Core) |
| **Managed PostgreSQL** (Basic, 1 GB) | the database, run and backed up daily by DigitalOcean |

Uploaded files (photos, documents) are kept in the `uploads` Docker volume on the Droplet.
The API creates the database tables (EF Core migrations) and the demo data on start.

## 1. Create the resources (same region for both, e.g. London)

1. **Droplet:** Ubuntu 24.04, Basic Regular 2 GB, SSH key authentication.
2. **Database:** Create → Databases → PostgreSQL, Basic $15. Under **Trusted sources** add the Droplet
   (and your own IP if you want to connect from your PC).

## 2. Prepare the Droplet (once)

```bash
curl -fsSL https://get.docker.com | sh
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443 && ufw --force enable
mkdir -p /opt/umbrella
```

## 3. Upload the code

From the project folder on your PC (PowerShell):

```powershell
tar -czf ..\umbrella-deploy.tar.gz --exclude=bin --exclude=obj --exclude=node_modules --exclude=.angular --exclude=dist --exclude=App_Data --exclude=*.user --exclude=.env Dockerfile .dockerignore UmbrellaMedical.Api UmbrellaMedical.Domain UmbrellaMedical.Infrastructure deploy frontend
scp ..\umbrella-deploy.tar.gz root@<droplet-ip>:/root/
ssh root@<droplet-ip> "tar -xzf /root/umbrella-deploy.tar.gz -C /opt/umbrella"
```

## 4. Configure (once)

```bash
cd /opt/umbrella/deploy
cp .env.example .env && nano .env && chmod 600 .env
```

`DB_CONNECTION` uses the database's **private (VPC) host** from its Connection details, e.g.
`Host=private-umbrella-db-do-user-123-0.l.db.ondigitalocean.com;Port=25060;Database=umbrella;Username=doadmin;Password=...;SSL Mode=Require;Maximum Pool Size=8`

## 5. Start / update

```bash
cd /opt/umbrella/deploy && docker compose up -d --build
docker compose ps
docker compose logs -f api
```

## Updating

Upload a fresh `umbrella-deploy.tar.gz` (step 3), unpack it over `/opt/umbrella` (keep `deploy/.env`), then run step 5 again.
New database migrations are applied automatically when the API starts.

## Monitoring

Caddy forwards the API's health checks, so they can be opened from anywhere:

- `https://<your-domain>/health/live`: `Healthy` when the API is running
- `https://<your-domain>/health/ready`: `Healthy` when the API can also reach the database

`docker compose ps` shows both containers and how long they have been up; `docker compose logs api` shows the API log.

## Email

DigitalOcean blocks outgoing SMTP on new accounts. Ask support to unblock it, or use a provider on
port 2525 (Brevo, Mailgun, SendGrid). Until then, emails are skipped and logged; the site still works.

## Before real patients use it

- Payments use the **test card gateway**: no real money moves.
- Clear `DEMO_STAFF_PASSWORD` and set `DEMO_PATIENTS=false` (the demo accounts have public passwords).
- Medical data has legal requirements (consent, privacy policy, data protection).
