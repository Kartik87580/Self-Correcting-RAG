# 🚀 CRAG Pipeline — AWS EC2 Deployment Guide
> **Target:** AWS Ubuntu 22.04 EC2 Instance | **Stack:** FastAPI + Uvicorn + Gunicorn + Nginx | **No Docker**

---

## 📋 Project Analysis Report

### What This Project Is
The **CRAG (Corrective RAG) Pipeline** is a FastAPI backend that provides:
- Document ingestion (PDF, OCR-PDF, TXT, Audio, YouTube, Websites)
- Corrective RAG pipeline using LangGraph
- JWT-based authentication
- Vector search via **Qdrant Cloud** (remote, no local GPU needed)
- PostgreSQL via **Neon DB** (remote, serverless)
- LLM via **Groq API** (remote, no local GPU needed)

### Key Dependencies Detected

| Category | Library | Notes |
|---|---|---|
| Web Server | `fastapi`, `uvicorn[standard]` | Standard ASGI server |
| PDF (simple) | `pymupdf4llm` | Needs `libgl1-mesa-glx`, `libglib2.0-0` |
| PDF (OCR) | `docling` | Heavy — needs `build-essential`, may take time to install |
| Web crawling | `crawl4ai` (via `extract_webpage`) | Needs Playwright + Chromium |
| Embeddings | `fastembed` | ONNX-based, **no GPU or PyTorch needed** ✅ |
| Vector DB | `qdrant-client` | Remote Qdrant Cloud ✅ |
| LLM | `langchain-groq`, `groq` | Remote Groq API ✅ |
| Database | `asyncpg`, `sqlalchemy` | Remote Neon PostgreSQL ✅ |
| Auth | `bcrypt`, `python-jose[cryptography]` | Standard JWT |

### ⚠️ Deployment Warnings

1. **`docling`** — This is a heavy OCR library that downloads ML models on first run. Ensure at least **2 GB RAM** on your instance.
2. **`crawl4ai`** — Uses Playwright under the hood. You must run `playwright install chromium` after pip install.
3. **`libgl1-mesa-glx`** — Required by PyMuPDF for PDF rendering. Must be installed via `apt`.
4. **`libglib2.0-0`** — Required by OpenCV internals used by docling.
5. **No GPU required** — FastEmbed uses ONNX CPU inference. All LLM calls go to Groq API.
6. **`SECRET_KEY`** — The default in `.env` must be replaced with a long random string in production.
7. **CORS** — Set `CORS_ORIGINS` to your frontend URL in production, not `*`.
8. **Python 3.11** — Confirmed via `runtime.txt`. Use exactly Python 3.11 on the instance.

### Recommended Instance Size
| Spec | Minimum | Recommended |
|---|---|---|
| Instance Type | `t3.small` (2 vCPU, 2 GB) | `t3.medium` (2 vCPU, 4 GB) |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Storage (EBS) | 30 GB | 50 GB |
| Ports | 80, 443, 22 | 80, 443, 22 |

---

## 🏗️ Architecture Overview

```
Your Browser / Frontend (Vercel)
          │
          │ HTTPS (port 443)
          ▼
┌─────────────────────────────────┐
│         NGINX (Reverse Proxy)   │  ← listens on port 80/443
│         /etc/nginx/sites-...    │
└──────────────┬──────────────────┘
               │ forwards to localhost:8000
               ▼
┌─────────────────────────────────┐
│  Gunicorn + Uvicorn Workers     │  ← process manager
│  (systemd service)              │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│     FastAPI Application         │  ← main.py
│     CRAG Pipeline Backend       │
└──────┬──────────────────────────┘
       │
       ├──► Groq API (LLM + Whisper)       [Remote]
       ├──► Qdrant Cloud (Vector DB)        [Remote]
       ├──► Neon PostgreSQL (Users/Chats)   [Remote]
       └──► Tavily Search API               [Remote]
```

---

## SECTION 1 — Create AWS EC2 Instance

### Step 1.1 — Log In to AWS Console

1. Open your browser and go to **[https://console.aws.amazon.com](https://console.aws.amazon.com)**
2. Sign in with your AWS account
3. If you don't have an account, create a free one (you get 12 months of Free Tier access)

### Step 1.2 — Navigate to EC2

1. In the search bar at the top, type **"EC2"** and click it
2. Click the orange **"Launch instance"** button

### Step 1.3 — Configure the Instance

Fill in the form exactly as below:

**Name and Tags:**
| Field | Value |
|---|---|
| Name | `crag-pipeline-instance` |

**Application and OS Images (AMI):**
| Field | Value |
|---|---|
| OS | **Ubuntu** |
| AMI | **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type** (64-bit x86) |

> 💡 Make sure to pick **22.04 LTS**, not 24.04, to match the project's `runtime.txt`.

**Instance Type:**
| Field | Value |
|---|---|
| Instance type | `t3.medium` (2 vCPU, 4 GB RAM) |

> 💡 Click "Compare instance types" if you don't see `t3.medium` immediately.

**Key Pair (login):**
| Field | Value |
|---|---|
| Key pair name | Click **"Create new key pair"** |
| Key pair name | `crag-pipeline-key` |
| Key pair type | RSA |
| Private key file format | **.pem** (for OpenSSH / Windows Terminal) |

Click **"Create key pair"** — this downloads `crag-pipeline-key.pem` automatically.

> ⚠️ **Save this file somewhere safe** (e.g., `C:\Users\YourName\.ssh\`). **You can only download it once.**

**Network Settings:**

Click **"Edit"** on the Network Settings panel and configure:

| Field | Value |
|---|---|
| VPC | (leave default) |
| Auto-assign public IP | **Enable** |
| Firewall (security groups) | **Create security group** |
| Security group name | `crag-pipeline-sg` |

Add the following inbound rules:

| Type | Protocol | Port | Source |
|---|---|---|---|
| SSH | TCP | 22 | My IP (or Anywhere for flexibility) |
| HTTP | TCP | 80 | Anywhere (0.0.0.0/0) |
| HTTPS | TCP | 443 | Anywhere (0.0.0.0/0) |

**Configure Storage:**
| Field | Value |
|---|---|
| Root volume size | **50 GB** (increase from default 8 GB) |
| Volume type | **gp3** (General Purpose SSD) |

Click **"Launch instance"**.

### Step 1.4 — Get Your Instance's Public IP

1. Wait 1–2 minutes for the instance to reach **"Running"** state
2. Go to **EC2 → Instances** → click `crag-pipeline-instance`
3. On the details panel, copy the **Public IPv4 address** (e.g., `54.123.45.67`)
4. Save this IP — you'll use it in every command below

> 💡 **Elastic IP (optional but recommended):** By default, the public IP changes every time you stop/start the instance. To get a permanent IP, go to **EC2 → Elastic IPs → Allocate** and associate it with your instance.

---

## SECTION 2 — Connect via SSH from Windows

### Step 2.1 — Open Windows Terminal or PowerShell

Press `Win + X` → click **"Terminal"** or **"Windows PowerShell"**

### Step 2.2 — Fix Key File Permissions (IMPORTANT)

Windows requires you to restrict who can read the `.pem` file. Run this:

```powershell
# Replace the path with where you saved your .pem file
icacls "C:\Users\YourName\.ssh\crag-pipeline-key.pem" /inheritance:r /grant:r "%USERNAME%:R"
```

> 💡 **Why?** SSH refuses to use key files that are readable by other users. This command locks the file to only your account.

### Step 2.3 — Connect to Your Instance

```bash
# Replace 54.123.45.67 with your actual instance IP
# AWS Ubuntu instances use "ubuntu" as the default username (not "azureuser")
ssh -i "C:\Users\YourName\.ssh\crag-pipeline-key.pem" ubuntu@54.123.45.67
```

When it asks `"Are you sure you want to continue connecting?"` → type `yes` and press Enter.

You should see a prompt like: `ubuntu@ip-172-31-xx-xx:~$`

🎉 **You are now inside your AWS EC2 instance!**

### Common SSH Errors

| Error | Fix |
|---|---|
| `Permission denied (publickey)` | Run the `icacls` command in Step 2.2 again |
| `Connection timed out` | Check Security Group has port 22 open for your IP |
| `WARNING: UNPROTECTED PRIVATE KEY FILE` | Fix permissions with `chmod 400` on Linux or `icacls` on Windows |
| `Host key verification failed` | Run `ssh-keygen -R YOUR_IP` to clear the old host key |

---

## SECTION 3 — Set Up the Linux Server

> 💡 All commands below run **inside your EC2 instance** after SSH connection.

### Step 3.1 — Update the System

```bash
# Update the list of available software packages
sudo apt update

# Actually install the updates
sudo apt upgrade -y
```

> 💡 `apt` is Ubuntu's package manager (like an app store for the command line). `sudo` means "run as administrator". Always update first to get security patches.

### Step 3.2 — Install System Dependencies

```bash
# Install all required system libraries in one command
sudo apt install -y \
    python3 \
    python3-venv \
    python3-dev \
    python3-pip \
    git \
    nginx \
    build-essential \
    libgl1 \
    libglib2.0-0t64 \
    libgomp1 \
    curl \
    wget \
    unzip
```

**What each package does:**

| Package | Purpose |
|---|---|
| `python3` | Python runtime (matches your project's `runtime.txt`) |
| `python3-venv` | Lets you create isolated Python environments |
| `python3-dev` | C headers needed to compile some Python packages |
| `python3-pip` | Python package installer |
| `git` | Download your project from GitHub |
| `nginx` | Web server / reverse proxy |
| `build-essential` | C/C++ compilers (needed by some pip packages) |
| `libgl1` | OpenGL library required by PyMuPDF (PDF processing) |
| `libglib2.0-0t64` | GLib library required by docling/OpenCV internals |
| `libgomp1` | OpenMP runtime (parallel processing for ML libraries) |
| `curl` / `wget` | Download files from the internet |

### Step 3.3 — Verify Python Version

```bash
python3 --version
# Expected output: Python 3.11.x
```

### Step 3.3.1 — Create Your Virtual Environment

```bash
python3 -m venv venv
```

### Activate it:

```bash
source venv/bin/activate
```

### Step 3.4 — Install Gunicorn

```bash
pip3 install gunicorn
```

---

## SECTION 4 — Deploy the Project

### Step 4.1 — Clone Your Repository

```bash
# Navigate to the home directory
cd ~

# Clone your project from GitHub
# Replace with your actual GitHub repository URL
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Navigate into the project folder
cd YOUR_REPO_NAME

# Navigate into the backend folder
cd backend
```

> 💡 **What is `git clone`?** It downloads a complete copy of your project from GitHub to the server.

### Step 4.2 — Create a Virtual Environment

```bash
# Create a virtual environment named "venv" inside the backend folder
python3 -m venv venv
```

> 💡 **What is a virtual environment?** It's an isolated Python installation just for your project. This prevents conflicts between different projects' dependencies. Think of it as a "clean room" for your project's packages.

### Step 4.3 — Activate the Virtual Environment

```bash
source venv/bin/activate
```

Your prompt will change to show `(venv)` at the beginning:
```
(venv) ubuntu@ip-172-31-xx-xx:~/YOUR_REPO_NAME/backend$
```

> 💡 **Important:** You must activate the venv every time you SSH in and want to run the app manually.

### Step 4.4 — Upgrade Pip

```bash
pip install --upgrade pip
```

### Step 4.5 — Install Python Dependencies

```bash
# This reads requirements.txt and installs everything
pip install -r requirements.txt
```

> ⚠️ This will take **5–15 minutes** on first run. `docling` and `fastembed` download ML models. Be patient.

### Step 4.6 — Install Playwright (for web crawling)

The `crawl4ai` library uses Playwright to render websites. You must install its browser:

```bash
# Install playwright browser
python -m playwright install chromium

# Install system dependencies for playwright
python -m playwright install-deps chromium
```

### Step 4.7 — Verify Installation

```bash
# Check FastAPI can be imported without errors
python -c "from fastapi import FastAPI; print('FastAPI OK')"

# Check main.py imports without errors
python -c "import main; print('main.py OK')"
```

---

## SECTION 5 — Configure Environment Variables

### Step 5.1 — Understanding Environment Variables

Environment variables are settings your app needs that should **NOT** be stored in code or GitHub. Things like API keys, database passwords, and secret keys.

> ⚠️ **Security Rule:** Never commit your `.env` file to GitHub. It contains secrets.

### Step 5.2 — Create the `.env` File on the Server

```bash
# Make sure you're in the backend directory
cd ~/YOUR_REPO_NAME/backend

# Create and open the .env file
nano .env
```

Paste the following template (replace all values with your real ones):

```env
# ─── LLM & Search APIs ───────────────────────────────────
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here

# ─── Qdrant Cloud (Vector Database) ──────────────────────
QDRANT_URL=https://your-cluster.cloud.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key_here

# ─── Neon PostgreSQL (User/Chat Database) ────────────────
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# ─── JWT Authentication ───────────────────────────────────
# Generate a strong random key: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=replace_this_with_a_long_random_string_64_chars

# ─── CORS (Frontend URL) ──────────────────────────────────
# For production, set to your actual frontend domain
CORS_ORIGINS=https://your-app.vercel.app

# ─── Server Port ──────────────────────────────────────────
PORT=8000
```

Save the file: Press `Ctrl+X` → `Y` → `Enter`

> 💡 **How to generate a strong SECRET_KEY:**
> ```bash
> python3 -c "import secrets; print(secrets.token_hex(32))"
> ```
> Copy the output and paste it as the value for `SECRET_KEY`.

### Step 5.3 — Secure the `.env` File

```bash
# Only the file owner can read or write to it
chmod 600 .env
```

### Step 5.4 — Verify `.env` is in `.gitignore`

```bash
cat ../.gitignore | grep ".env"
```

If `.env` doesn't appear, add it:

```bash
echo ".env" >> ../.gitignore
```

---

## SECTION 6 — Test FastAPI (Development Mode)

### Step 6.1 — Run Uvicorn Manually

```bash
# Make sure venv is active and you're in the backend folder
cd ~/YOUR_REPO_NAME/backend
source venv/bin/activate

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000
```

You should see output like:
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
✅ Database tables ready
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 6.2 — Test the API

Open a browser on your Windows laptop and visit:

```
http://YOUR_INSTANCE_IP:8000/health
# Expected: {"status": "ok"}

http://YOUR_INSTANCE_IP:8000/docs
# Expected: FastAPI interactive documentation page
```

> ⚠️ **If port 8000 doesn't respond:** You need to open port 8000 in your Security Group. Go to AWS Console → EC2 → Security Groups → `crag-pipeline-sg` → **Edit inbound rules** → Add rule: Custom TCP, Port 8000, Source Anywhere. (We'll remove this later when Nginx is set up.)

### Step 6.3 — Stop the Test Server

Press `Ctrl+C` to stop uvicorn.

---

## SECTION 7 — Production Deployment

### Why Production Setup Is Different

| Development (uvicorn only) | Production (Gunicorn + Nginx) |
|---|---|
| Single process | Multiple worker processes |
| No auto-restart | Auto-restarts on crash |
| Exposes port 8000 | Only exposes port 80/443 |
| No HTTPS | HTTPS via Certbot |
| No logging | Proper log files |

### Step 7.1 — Create a systemd Service

`systemd` is Linux's service manager. It keeps your app running in the background, auto-starts it after server reboots, and restarts it if it crashes.

```bash
sudo nano /etc/systemd/system/crag-pipeline.service
```

Paste this content (update paths for your actual repo name):

```ini
[Unit]
Description=CRAG Pipeline FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/YOUR_REPO_NAME/backend
ExecStart=/home/ubuntu/YOUR_REPO_NAME/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Save: `Ctrl+X` → `Y` → `Enter`

> 💡 **Note on user:** AWS Ubuntu instances use `ubuntu` as the default user (not `azureuser` like Azure).
>
> 💡 **`--workers 2`** — Runs 2 parallel processes. For a 2-CPU instance, 2 workers is ideal. Each worker can handle one request at a time.

### Step 7.2 — Create Log Directory

```bash
sudo mkdir -p /var/log/crag-pipeline
sudo chown ubuntu:ubuntu /var/log/crag-pipeline
```

### Step 7.3 — Enable and Start the Service

```bash
# Reload systemd to recognize the new service file
sudo systemctl daemon-reload

# Enable the service to auto-start on instance reboot
sudo systemctl enable crag-pipeline

# Start the service now
sudo systemctl start crag-pipeline

# Check the status
sudo systemctl status crag-pipeline
```

Expected output:
```
● crag-pipeline.service - CRAG Pipeline FastAPI Backend
   Active: active (running) since ...
```

### Step 7.4 — Configure Nginx as Reverse Proxy

Nginx sits in front of your app and handles all incoming web traffic.

> 💡 **Why Nginx?** It handles HTTPS termination, compression, static files, and protects your app from being directly exposed to the internet.

```bash
sudo nano /etc/nginx/sites-available/crag-pipeline
```

Paste:

```nginx
server {
    listen 80;
    server_name 54.123.45.67; # replace with your EC2 public IP or domain

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    access_log /var/log/nginx/crag-pipeline-access.log;
    error_log /var/log/nginx/crag-pipeline-error.log;
}
```

Save: `Ctrl+X` → `Y` → `Enter`

### Step 7.5 — Enable the Nginx Site

```bash
# Create a symlink to enable the site
sudo ln -s /etc/nginx/sites-available/crag-pipeline /etc/nginx/sites-enabled/

# Remove the default Nginx site
sudo rm -f /etc/nginx/sites-enabled/default

# Test the Nginx config for errors
sudo nginx -t
# Expected: nginx: configuration file /etc/nginx/nginx.conf test is successful

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Step 7.6 — Test Production Deployment

```bash
# Test via curl (from inside the instance)
curl http://localhost/health
# Expected: {"status":"ok"}
```

From your Windows browser:
```
http://YOUR_INSTANCE_IP/health       → {"status": "ok"}
http://YOUR_INSTANCE_IP/docs         → FastAPI docs page
```

---

## SECTION 8 — Domain + HTTPS with AWS Elastic IP & Route 53 (or Free DNS) 🔥

This section helps you:

* Add a free or custom domain
* Connect it to your EC2 instance
* Enable HTTPS/SSL
* Secure your FastAPI backend
* Connect frontend safely from Vercel

---

### Final Result

Your backend URL will look like:

```text
https://api.yourdomain.com
```

or with a free subdomain service:

```text
https://cragpipeline.duckdns.org
```

instead of:

```text
http://54.123.45.67
```

---

### OPTION A — Using a Custom Domain with Route 53

#### STEP 1 — Allocate an Elastic IP (Static IP)

Go to:

```text
AWS Console → EC2 → Elastic IPs → Allocate Elastic IP address
```

Click **Allocate**, then:

```text
Actions → Associate Elastic IP address
```

Select your `crag-pipeline-instance` and click **Associate**.

> 💡 **Why Elastic IP?** EC2 public IPs change on stop/start. An Elastic IP is a static address that stays the same. It's free as long as it's associated with a running instance.

---

#### STEP 2 — Point Your Domain to EC2 via Route 53

Go to:

```text
AWS Console → Route 53 → Hosted zones → (your domain) → Create record
```

| Field | Value |
|---|---|
| Record name | `api` (creates `api.yourdomain.com`) |
| Record type | `A` |
| Value | Your Elastic IP address |
| TTL | 300 |

Click **Create records** and wait 1–5 minutes for DNS propagation.

---

#### STEP 3 — Verify Domain Works

Open browser:

```text
http://api.yourdomain.com
```

If nginx is running correctly, your API should respond.

---

### OPTION B — Free Domain with DuckDNS (No Custom Domain Needed)

If you don't have a custom domain, use the free **DuckDNS** service:

1. Go to [https://www.duckdns.org](https://www.duckdns.org) and sign in
2. Create a subdomain like `cragpipeline` → it gives you `cragpipeline.duckdns.org`
3. Set the IP to your EC2 Elastic IP

---

### STEP 4 — Update Nginx Configuration

Open nginx config:

```bash
sudo nano /etc/nginx/sites-available/crag-pipeline
```

Replace existing content with (using your actual domain):

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # or cragpipeline.duckdns.org

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    access_log /var/log/nginx/crag-pipeline-access.log;
    error_log /var/log/nginx/crag-pipeline-error.log;
}
```

Save file:

```text
CTRL + O
Enter
CTRL + X
```

---

### STEP 5 — Test Nginx Config

Run:

```bash
sudo nginx -t
```

Expected output:

```text
syntax is ok
test is successful
```

---

### STEP 6 — Restart Nginx

```bash
sudo systemctl restart nginx
```

---

### STEP 7 — Install Certbot (SSL Tool)

Run:

```bash
sudo apt update

sudo apt install certbot python3-certbot-nginx -y
```

---

### STEP 8 — Generate HTTPS SSL Certificate

Run (replace with your actual domain):

```bash
sudo certbot --nginx -d api.yourdomain.com
```

Or with DuckDNS:

```bash
sudo certbot --nginx -d cragpipeline.duckdns.org
```

---

### STEP 9 — Follow Certbot Prompts

When asked:

```text
Enter email address
```

Enter your email.

---

Accept terms:

```text
Y
```

---

When asked:

```text
Redirect HTTP to HTTPS?
```

Choose:

```text
2
```

This forces secure HTTPS.

---

### STEP 10 — Verify HTTPS

Open:

```text
https://api.yourdomain.com
```

Swagger docs:

```text
https://api.yourdomain.com/docs
```

Health endpoint:

```text
https://api.yourdomain.com/health
```

---

### STEP 11 — Update Frontend Environment Variables

Go to:

```text
Vercel → Project → Settings → Environment Variables
```

Update:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

OR for Vite:

```env
VITE_API_URL=https://api.yourdomain.com
```

---

### STEP 12 — Redeploy Frontend

Redeploy Vercel project:

```text
Deployments → Redeploy
```

OR push new commit to GitHub.

---

### STEP 13 — Add CORS in FastAPI

Open your `main.py`.

Add:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://self-correcting-rag-jt1h.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### STEP 14 — Restart Backend Service

```bash
sudo systemctl restart crag-pipeline
```

---

### STEP 15 — Final Test 🚀

Frontend:

```text
https://self-correcting-rag-jt1h.vercel.app
```

Backend:

```text
https://api.yourdomain.com
```

Swagger:

```text
https://api.yourdomain.com/docs
```

---

### Final Production Architecture

```text
Vercel Frontend (HTTPS)
        ↓
AWS Domain + SSL (HTTPS)
        ↓
Nginx Reverse Proxy
        ↓
FastAPI/Uvicorn Backend
```

---

### Important Security Recommendation 🔥

After nginx + HTTPS setup:

Remove public access to port `8000` from the AWS Security Group.

Go to:

```text
AWS Console → EC2 → Security Groups → crag-pipeline-sg → Edit inbound rules
```

Delete the port 8000 rule if you added it during testing.

Only allow:

```text
22  (SSH — your IP only, ideally)
80  (HTTP)
443 (HTTPS)
```

This is proper production deployment practice ✅

---

## SECTION 9 — Monitoring & Logs

### Check Service Status

```bash
# Is the app running?
sudo systemctl status crag-pipeline

# Is Nginx running?
sudo systemctl status nginx
```

### View Application Logs (Real-time)

```bash
# Live logs from systemd journal
sudo journalctl -u crag-pipeline -f

# Last 100 lines
sudo journalctl -u crag-pipeline -n 100

# Application access log
tail -f /var/log/crag-pipeline/access.log

# Application error log
tail -f /var/log/crag-pipeline/error.log
```

### View Nginx Logs

```bash
# Nginx access log (all incoming requests)
sudo tail -f /var/log/nginx/crag-pipeline-access.log

# Nginx error log
sudo tail -f /var/log/nginx/crag-pipeline-error.log
```

### Restart Services

```bash
# Restart your FastAPI app
sudo systemctl restart crag-pipeline

# Restart Nginx
sudo systemctl restart nginx
```

### Troubleshooting Common Issues

| Problem | Diagnostic Command | Fix |
|---|---|---|
| App not starting | `sudo journalctl -u crag-pipeline -n 50` | Check for missing env vars or import errors |
| 502 Bad Gateway | `sudo systemctl status crag-pipeline` | App crashed — restart and check logs |
| Port 80 not responding | `sudo systemctl status nginx` | Nginx not running — restart it |
| Database connection error | Check `.env` `DATABASE_URL` | Verify Neon DB URL is correct |
| Qdrant connection error | Check `.env` `QDRANT_URL` and `QDRANT_API_KEY` | Verify Qdrant Cloud credentials |
| `ModuleNotFoundError` | `source venv/bin/activate && pip list` | Missing package — pip install it |
| EC2 unreachable after reboot | Check Elastic IP is still associated | Reassociate Elastic IP in AWS Console |

---

## SECTION 10 — Updating the Deployment

### Safe Deployment Workflow

Whenever you push new code to GitHub, follow these steps on the instance:

```bash
# 1. Connect to instance
ssh -i "C:\Users\YourName\.ssh\crag-pipeline-key.pem" ubuntu@YOUR_INSTANCE_IP

# 2. Go to project directory
cd ~/YOUR_REPO_NAME/backend

# 3. Pull latest code
git pull origin main

# 4. Activate virtual environment
source venv/bin/activate

# 5. Install any new/updated requirements
pip install -r requirements.txt

# 6. Restart the service
sudo systemctl restart crag-pipeline

# 7. Verify it's running correctly
sudo systemctl status crag-pipeline
curl http://localhost/health
```

> ⚠️ **Zero-downtime note:** The app will be briefly unavailable during restart (usually under 5 seconds). For zero-downtime deployments you'd use an AWS Load Balancer — beyond the scope of this guide.

---

## ✅ Deployment Checklist

Use this checklist to verify your deployment is complete and production-ready:

### Pre-Deployment
- [ ] AWS EC2 instance created (Ubuntu 22.04, t3.medium or better)
- [ ] `.pem` key file downloaded and stored safely
- [ ] Security Group has ports 22, 80, 443 open
- [ ] SSH connection working from Windows
- [ ] Elastic IP allocated and associated (optional but recommended)

### Server Setup
- [ ] `sudo apt update && sudo apt upgrade` completed
- [ ] All system packages installed (`libgl1`, `libglib2.0-0t64`, etc.)
- [ ] Python 3.11 installed and verified
- [ ] Git installed

### Application Setup
- [ ] Repository cloned on the server
- [ ] Virtual environment created and activated
- [ ] `pip install -r requirements.txt` completed
- [ ] Playwright Chromium installed (`playwright install chromium`)
- [ ] `.env` file created with real API keys
- [ ] `.env` permissions set to `600`
- [ ] `.env` is in `.gitignore`

### Production Configuration
- [ ] systemd service file created (`/etc/systemd/system/crag-pipeline.service`)
- [ ] Log directory created (`/var/log/crag-pipeline/`)
- [ ] Service enabled and started (`systemctl enable && start crag-pipeline`)
- [ ] Nginx config created and tested
- [ ] Default Nginx site removed
- [ ] Nginx restarted and enabled

### Verification
- [ ] `http://YOUR_INSTANCE_IP/health` returns `{"status": "ok"}`
- [ ] `http://YOUR_INSTANCE_IP/docs` shows FastAPI Swagger UI
- [ ] Application logs show no errors
- [ ] Service restarts automatically (test with `sudo systemctl restart crag-pipeline`)

### Optional (Recommended for Production)
- [ ] Elastic IP allocated and associated with instance
- [ ] Custom domain or DuckDNS subdomain pointed to EC2 IP
- [ ] SSL certificate installed via Certbot
- [ ] `https://` URL working
- [ ] `CORS_ORIGINS` set to specific frontend domain (not `*`)
- [ ] `SECRET_KEY` is a strong random value (not the default)
- [ ] Port 8000 removed from Security Group inbound rules

---

## 🔒 Security Best Practices

1. **Never expose port 8000** directly — always use Nginx on port 80/443
2. **Restrict SSH access** — in the Security Group, set port 22 Source to **My IP** instead of Anywhere
3. **Use SSH keys** — disable password authentication:
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set: PasswordAuthentication no
   sudo systemctl restart sshd
   ```
4. **Keep system updated** — run `sudo apt update && sudo apt upgrade` weekly
5. **Use a strong `SECRET_KEY`** — generate with `python3 -c "import secrets; print(secrets.token_hex(32))"`
6. **Restrict CORS** — set `CORS_ORIGINS` to your exact frontend URL in production
7. **Set up UFW firewall** (in addition to the Security Group):
   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```
8. **Rotate API keys** if your `.env` file is ever accidentally exposed
9. **Enable AWS CloudWatch** (optional) for instance-level monitoring and alerts:
   ```text
   AWS Console → CloudWatch → Alarms → Create alarm
   ```

---

## Azure vs AWS — Key Differences Reference

| Concept | Azure | AWS |
|---|---|---|
| Virtual Machine | Azure Virtual Machine | EC2 Instance |
| Default SSH user | `azureuser` | `ubuntu` |
| Static IP | Azure Public IP (auto-assigned) | Elastic IP (must be allocated separately) |
| Firewall rules | Network Security Group (NSG) | Security Group |
| Free DNS subdomain | `*.cloudapp.azure.com` (built-in) | None built-in (use DuckDNS or Route 53) |
| VM console | Azure Portal | AWS Management Console |
| Resource grouping | Resource Group | (No equivalent — use Tags) |
| Disk type | Standard SSD / Premium SSD | gp3 / gp2 |
| SSH key format | `.pem` | `.pem` |

---

*Generated for CRAG Pipeline v2.0.0 — FastAPI + LangGraph + Qdrant + Neon DB*
