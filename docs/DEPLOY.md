# Deploying forHumanity

This guide runs forHumanity on a single Linux server (a "VPS") with Docker Compose, behind nginx
with a free Let's Encrypt TLS certificate. A small server (1 vCPU, 1–2 GB RAM, e.g. a $6–12/month
droplet or instance) is plenty for a community deployment.

```
Internet ──443──▶ nginx on the host (TLS) ──▶ 127.0.0.1:8080 frontend container (nginx)
                                                  ├── /       React app
                                                  └── /api ─▶ backend container ─▶ mongo container
```

Only nginx on the host is reachable from the internet. The app containers listen on localhost,
and MongoDB isn't published at all.

## How images get built

Every push to `main` runs `.github/workflows/publish-images.yml`, which builds and publishes:

- `ghcr.io/laufferw/forhumanity-backend`
- `ghcr.io/laufferw/forhumanity-frontend` (built with `REACT_APP_API_URL=/api`)

Each is tagged `latest`, `sha-<commit>` (for pinning and rollback), and, for `v1.2.3` git tags,
`1.2.3` and `1.2`.

The packages are private by default. Either make them public (GitHub → your profile → Packages →
each package → Package settings → Change visibility), or log the server in with a personal access
token that has `read:packages`:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u laufferw --password-stdin
```

## 1. Prepare the server

Ubuntu 24.04 is assumed; other distros work with the equivalent packages.

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh

# nginx and certbot for TLS
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Firewall: SSH and web only
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Point your domain's DNS `A` record (and `AAAA` if you have IPv6) at the server and wait until
`dig +short your-domain.example` returns its address.

## 2. Get the deployment files

The server needs the compose file, the env template, and the nginx example. Cloning the repo is
the simplest way to get them:

```bash
sudo mkdir -p /opt/forhumanity && sudo chown "$USER" /opt/forhumanity
git clone https://github.com/laufferw/forHumanity.git /opt/forhumanity
cd /opt/forhumanity
```

## 3. Configure

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Edit `.env.production`:

| Setting                         | Value                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `JWT_SECRET`                    | `openssl rand -hex 32`                                                                |
| `METRICS_TOKEN`                 | `openssl rand -hex 24` (also add it as a GitHub repo secret, see step 7)              |
| `CLIENT_ORIGIN`, `APP_URL`      | `https://your-domain.example`                                                         |
| `TRUST_PROXY`                   | `2` (host nginx + the frontend container's nginx); keep it at 2 for this setup        |
| `SMTP_*`, `MAIL_FROM`           | Your email provider's SMTP settings, or leave `SMTP_HOST` empty to disable email      |
| `RETENTION_DAYS`                | Days before closed requests' personal details are removed (default 90)                |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The first admin; the password must meet the policy (upper, lower, number, symbol, 8+) |

`./ops/check_env.sh` checks the staging file; for production, look over the values by hand.

## 4. Start the app

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps        # wait for backend "healthy"

# Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD in .env.production
docker compose -f docker-compose.production.yml exec backend npm run seed:admin
```

`curl -s http://127.0.0.1:8080/api/health` should report `"db":"connected"`.

## 5. TLS and the public proxy

```bash
sudo cp deploy/nginx.reverse-proxy.example.conf /etc/nginx/sites-available/forhumanity
sudo sed -i 's/your-domain.example/YOUR.DOMAIN/g' /etc/nginx/sites-available/forhumanity
sudo ln -s /etc/nginx/sites-available/forhumanity /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

The example config references the certificate before it exists, so get the certificate first.
The hooks stop nginx while certbot uses port 80 and start it again afterwards; certbot saves them,
so automatic renewals (its systemd timer runs twice a day) work the same way:

```bash
sudo certbot certonly --standalone -d YOUR.DOMAIN --agree-tos -m you@example.org -n \
  --pre-hook 'systemctl stop nginx' --post-hook 'systemctl start nginx'
sudo nginx -t && sudo systemctl restart nginx
sudo certbot renew --dry-run    # confirms renewal will work
```

## 6. Check it

```bash
METRICS_TOKEN=... ./ops/smoke_test.sh https://YOUR.DOMAIN
```

Then, in a browser: submit a request, register a volunteer, approve them as admin, assign the
request, and deliver it. With SMTP configured, the admin and volunteer should receive emails.

## 7. Monitoring and backups

**Uptime checks.** In the GitHub repo, add the secrets `PRODUCTION_BASE_URL`
(`https://YOUR.DOMAIN`) and `METRICS_TOKEN`. The uptime workflow then checks every 30 minutes and
opens an issue when the site is down.

**Backups.** MongoDB isn't reachable from outside the server, so back it up on the server. A daily
compressed dump, keeping 14 days:

```bash
sudo mkdir -p /var/backups/forhumanity
sudo tee /etc/cron.daily/forhumanity-backup >/dev/null <<'EOF'
#!/bin/sh
set -e
cd /opt/forhumanity
docker compose -f docker-compose.production.yml exec -T mongo \
  mongodump --archive --gzip --db forHumanity \
  > /var/backups/forhumanity/forHumanity-$(date -u +%Y%m%dT%H%M%SZ).archive.gz
find /var/backups/forhumanity -name '*.archive.gz' -mtime +14 -delete
EOF
sudo chmod +x /etc/cron.daily/forhumanity-backup
```

Copy backups off the server too (e.g. with `rclone` to object storage); a backup on the same disk
doesn't survive losing the server. To restore:

```bash
docker compose -f docker-compose.production.yml exec -T mongo \
  mongorestore --archive --gzip --drop < /var/backups/forhumanity/FILE.archive.gz
```

## Updating

```bash
cd /opt/forhumanity
git pull                                                  # compose/nginx changes, if any
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

Check the CHANGELOG for new settings before updating.

## Rolling back

Every published build has a `sha-<commit>` tag. Pin the previous good one:

```bash
BACKEND_IMAGE=ghcr.io/laufferw/forhumanity-backend:sha-abc1234 \
FRONTEND_IMAGE=ghcr.io/laufferw/forhumanity-frontend:sha-abc1234 \
docker compose -f docker-compose.production.yml up -d
```

(Or put `BACKEND_IMAGE` / `FRONTEND_IMAGE` in a `.env` file next to the compose file.)

## Building on the server instead

To skip the registry, build the images from the checked-out code:

```bash
docker compose -f docker-compose.production.yml up -d --build
```
