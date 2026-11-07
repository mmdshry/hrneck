# Cloudflare DNS for hrneck.com

Nameservers are Cloudflare (`gabriella.ns.cloudflare.com`, `leif.ns.cloudflare.com`).
cPanel already has vhosts + AutoSSL for these hosts; public resolution still needs Cloudflare records.

## Required records (proxied / orange cloud)

Point all of these to origin `15.204.81.140` (A) or CNAME to `hrneck.com` if apex A already exists.

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `hrneck.com` | `15.204.81.140` | Proxied |
| A or CNAME | `www` | `15.204.81.140` or `hrneck.com` | Proxied |
| A or CNAME | `admin` | `15.204.81.140` or `hrneck.com` | Proxied |
| A or CNAME | `api` | `15.204.81.140` or `hrneck.com` | Proxied |
| A or CNAME | `app` | `15.204.81.140` or `hrneck.com` | Proxied |
| A or CNAME | `itneck` | `15.204.81.140` or `hrneck.com` | Proxied |
| A or CNAME | `test` | `15.204.81.140` or `hrneck.com` | Proxied |
| A or CNAME | `company` | `15.204.81.140` or `hrneck.com` | Proxied |
| A | `*` | `15.204.81.140` | Proxied (tenant wildcard) |

SSL/TLS mode: **Full (strict)** (origin has AutoSSL certs).

## API alternative

If a Cloudflare API token with `Zone.DNS:Edit` for `hrneck.com` is available:

```bash
export CF_API_TOKEN=...
export CF_ZONE_ID=...   # or look up via /zones?name=hrneck.com
# create A records as above via POST /zones/$CF_ZONE_ID/dns_records
```
