# Raspberry Pi 4: Run Polymarket Bot at Startup After WireGuard

This guide configures the bot as a `systemd` service on Raspberry Pi OS and ensures it starts only after WireGuard interface `protonwg` is up.

## Values Used in This Guide

- Service user: `pi`
- Bot directory: `/home/pi/Polymarket-Trading-Bot`
- WireGuard interface: `protonwg`
- Start command: `npm start`

If any of these change later, update the unit file in Step 4.

## 1) Install and Build Once

Run on the Raspberry Pi:

```bash
cd /home/pi/Polymarket-Trading-Bot
npm install
npm run build
cp .env.example .env   # skip if already done
```

Edit `.env` as needed before enabling startup.

## 2) Confirm WireGuard Unit Name

For interface `protonwg`, the expected unit is:

- `wg-quick@protonwg.service`

Check it exists:

```bash
systemctl list-unit-files | grep "wg-quick@protonwg.service"
```

If this returns nothing, continue with the next section before moving on.

If you do not see it, verify your WireGuard config exists at:

```bash
/etc/wireguard/protonwg.conf
```

## 2.1) Validate Your Current protonwg.conf (Recommended)

Your posted config is compatible with this guide. Confirm these points:

- File path is exactly `/etc/wireguard/protonwg.conf`.
- Interface name is `protonwg` (must match the filename and service name).
- `AllowedIPs = 0.0.0.0/0, ::/0` means full-tunnel VPN routing (expected).
- `PostUp` and `PostDown` use `resolvectl`, so `systemd-resolved` must be available.

Quick checks:

```bash
sudo systemctl status systemd-resolved --no-pager
sudo wg-quick up protonwg
ip a show protonwg
sudo wg-quick down protonwg
```

If `systemd-resolved` is not active, enable/start it:

```bash
sudo systemctl enable systemd-resolved
sudo systemctl start systemd-resolved
```

## 2.2) If wg-quick@protonwg.service Is Missing

On Raspberry Pi OS, this usually means WireGuard tools are not installed (or systemd has not reloaded units yet).

Install required packages:

```bash
sudo apt update
sudo apt install -y wireguard wireguard-tools
```

Confirm your config file is present and protected:

```bash
sudo ls -l /etc/wireguard/protonwg.conf
sudo chmod 600 /etc/wireguard/protonwg.conf
```

Reload systemd and check for the template unit:

```bash
sudo systemctl daemon-reload
systemctl cat wg-quick@.service
systemctl list-unit-files | grep "wg-quick@"
```

Then enable/start your interface unit:

```bash
sudo systemctl enable --now wg-quick@protonwg.service
sudo systemctl status wg-quick@protonwg.service --no-pager
```

If that still fails, run:

```bash
journalctl -xeu wg-quick@protonwg.service --no-pager
```

and fix the first error shown (most often missing package, wrong file name, or permissions).

## 3) Enable WireGuard on Boot

```bash
sudo systemctl enable wg-quick@protonwg.service
sudo systemctl start wg-quick@protonwg.service
sudo systemctl status wg-quick@protonwg.service --no-pager
```

Optional: verify DNS route from your `PostUp` hook:

```bash
resolvectl status protonwg
```

## 4) Create Bot Service Unit

Create `/etc/systemd/system/polymarket-bot.service`:

```ini
[Unit]
Description=Polymarket Trading Bot
Wants=network-online.target wg-quick@protonwg.service
After=network-online.target wg-quick@protonwg.service

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/Polymarket-Trading-Bot
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStartPre=/usr/bin/test -d /sys/class/net/protonwg
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
TimeoutStartSec=120
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then reload and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable polymarket-bot.service
sudo systemctl start polymarket-bot.service
```

## 5) Verify Startup Order and Health

```bash
systemctl status polymarket-bot.service --no-pager
journalctl -u polymarket-bot.service -f
```

Confirm dependency order:

```bash
systemctl show polymarket-bot.service -p After -p Wants
```

Reboot test:

```bash
sudo reboot
```

After reboot:

```bash
systemctl is-active wg-quick@protonwg.service
systemctl is-active polymarket-bot.service
```

Both should return `active`.

## 6) Useful Operations

Restart bot:

```bash
sudo systemctl restart polymarket-bot.service
```

Stop bot:

```bash
sudo systemctl stop polymarket-bot.service
```

Disable bot autostart:

```bash
sudo systemctl disable polymarket-bot.service
```

## 7) Optional Hardening (Recommended Later)

After confirming everything works, you can improve resilience by:

- Pinning Node path if needed (for example `/usr/bin/node` + explicit script entrypoint).
- Adding `EnvironmentFile=/home/pi/Polymarket-Trading-Bot/.env` only if you choose to expose env vars via systemd.
- Adding `StartLimitIntervalSec` and `StartLimitBurst` to prevent rapid restart loops.

## Troubleshooting

If bot fails because WireGuard is not ready:

```bash
journalctl -u wg-quick@protonwg.service -b --no-pager
journalctl -u polymarket-bot.service -b --no-pager
```

If `npm` is not found in service context:

```bash
which npm
```

Then update `ExecStart=` to the full path returned by `which npm`.
