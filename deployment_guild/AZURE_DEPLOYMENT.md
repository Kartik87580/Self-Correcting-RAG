# 🚀 CRAG Pipeline — Azure VM Deployment Guide
> **Target:** Azure Ubuntu 22.04 VM | **Stack:** FastAPI + Uvicorn + Gunicorn + Nginx | **No Docker**

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

1. **`docling`** — This is a heavy OCR library that downloads ML models on first run. Ensure at least **2 GB RAM** on your VM.
2. **`crawl4ai`** — Uses Playwright under the hood. You must run `playwright install chromium` after pip install.
3. **`libgl1-mesa-glx`** — Required by PyMuPDF for PDF rendering. Must be installed via `apt`.
4. **`libglib2.0-0`** — Required by OpenCV internals used by docling.
5. **No GPU required** — FastEmbed uses ONNX CPU inference. All LLM calls go to Groq API.
6. **`SECRET_KEY`** — The default in `.env` must be replaced with a long random string in production.
7. **CORS** — Set `CORS_ORIGINS` to your frontend URL in production, not `*`.
8. **Python 3.11** — Confirmed via `runtime.txt`. Use exactly Python 3.11 on the VM.

### Recommended VM Size
| Spec | Minimum | Recommended |
|---|---|---|
| VM Size | `Standard_B2s` (2 vCPU, 4 GB) | `Standard_B2ms` (2 vCPU, 8 GB) |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Disk | 30 GB | 50 GB |
| Port | 80, 443, 22 | 80, 443, 22 |

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

## SECTION 1 — Create Azure Virtual Machine

### Step 1.1 — Log In to Azure Portal

1. Open your browser and go to **[https://portal.azure.com](https://portal.azure.com)**
2. Sign in with your Microsoft/Azure account
3. If you don't have an account, create a free one (you get $200 free credits)

### Step 1.2 — Create the VM

1. In the search bar at the top, type **"Virtual Machines"** and click it
2. Click the blue **"+ Create"** button → choose **"Azure virtual machine"**

Fill in the form exactly as below:

**Basics Tab:**
| Field | Value |
|---|---|
| Subscription | Your subscription name |
| Resource Group | Click "Create new" → type `crag-pipeline-rg` |
| Virtual machine name | `crag-pipeline-vm` |
| Region | Choose closest to you (e.g., `East US`, `Southeast Asia`) |
| Availability options | No infrastructure redundancy required |
| Image | **Ubuntu Server 22.04 LTS** (x64 Gen2) |
| VM size | Click "See all sizes" → search `B2ms` → select `Standard_B2ms` |
| Authentication type | **SSH public key** |
| Username | `azureuser` |
| SSH public key source | **Generate new key pair** |
| Key pair name | `crag-pipeline-key` |

> 💡 **Why SSH key?** Password login is a security risk. SSH keys are cryptographic and much harder to hack.

**Disks Tab:**
- OS disk size: **64 GB** (increase from default 30 GB)
- OS disk type: **Standard SSD**

**Networking Tab:**
| Field | Value |
|---|---|
| Virtual network | (leave default, auto-created) |
| Public IP | (leave default, auto-created) |
| NIC network security group | **Basic** |
| Public inbound ports | **Allow selected ports** |
| Select inbound ports | **SSH (22), HTTP (80), HTTPS (443)** |

Click **"Review + Create"** → then **"Create"**

### Step 1.3 — Download SSH Key

A popup will appear: **"Download private key and create resource"**

- Click this button — it downloads a file called `crag-pipeline-key.pem`
- **Save this file somewhere safe** (e.g., `C:\Users\YourName\.ssh\`)
- ⚠️ **You can only download this once. If you lose it, you lose access to the VM.**

### Step 1.4 — Get Your VM's Public IP

1. Wait 1-2 minutes for deployment to complete
2. Go to **Virtual Machines** → click `crag-pipeline-vm`
3. On the overview page, copy the **Public IP address** (e.g., `20.55.123.45`)
4. Save this IP — you'll use it in every command below

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

### Step 2.3 — Connect to Your VM

```bash
# Replace 20.55.123.45 with your actual VM IP
ssh -i "C:\Users\YourName\.ssh\crag-pipeline-key.pem" azureuser@20.55.123.45
```

When it asks `"Are you sure you want to continue connecting?"` → type `yes` and press Enter.

You should see a prompt like: `azureuser@crag-pipeline-vm:~$`

🎉 **You are now inside your Azure VM!**

### Common SSH Errors

| Error | Fix |
|---|---|
| `Permission denied (publickey)` | Run the `icacls` command in Step 2.2 again |
| `Connection timed out` | Check Azure NSG has port 22 open |
| `WARNING: UNPROTECTED PRIVATE KEY FILE` | Fix permissions with `chmod 400` on Linux or `icacls` on Windows |

---

## SECTION 3 — Set Up the Linux Server

> 💡 All commands below run **inside your VM** after SSH connection.

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
| `python3.11` | Python runtime (matches your project's `runtime.txt`) |
| `python3.11-venv` | Lets you create isolated Python environments |
| `python3.11-dev` | C headers needed to compile some Python packages |
| `python3-pip` | Python package installer |
| `git` | Download your project from GitHub |
| `nginx` | Web server / reverse proxy |
| `build-essential` | C/C++ compilers (needed by some pip packages) |
| `libgl1-mesa-glx` | OpenGL library required by PyMuPDF (PDF processing) |
| `libglib2.0-0` | GLib library required by docling/OpenCV internals |
| `libgomp1` | OpenMP runtime (parallel processing for ML libraries) |
| `curl` / `wget` | Download files from the internet |

### Step 3.3 — Verify Python Version

```bash
python3 --version
# Expected output: Python 3.11.x
```
### step 3.3.1 - create your virtual environment:
```bash
python3 -m venv venv
```
### Activate it:

```
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
python3.11 -m venv venv
```

> 💡 **What is a virtual environment?** It's an isolated Python installation just for your project. This prevents conflicts between different projects' dependencies. Think of it as a "clean room" for your project's packages.

### Step 4.3 — Activate the Virtual Environment

```bash
source venv/bin/activate
```

Your prompt will change to show `(venv)` at the beginning:
```
(venv) azureuser@crag-pipeline-vm:~/YOUR_REPO_NAME/backend$
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

> ⚠️ This will take **5-15 minutes** on first run. `docling` and `fastembed` download ML models. Be patient.

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
http://YOUR_VM_IP:8000/health
# Expected: {"status": "ok"}

http://YOUR_VM_IP:8000/docs
# Expected: FastAPI interactive documentation page
```

> ⚠️ **If port 8000 doesn't respond:** You need to open port 8000 in Azure. Go to Azure Portal → your VM → **Networking** → **Add inbound port rule** → Port 8000, Protocol TCP. (We'll remove this later when Nginx is set up.)

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
User=azureuser
WorkingDirectory=/home/azureuser/Self-Correcting-RAG/backend
ExecStart=/home/azureuser/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Save: `Ctrl+X` → `Y` → `Enter`

> 💡 **`--workers 2`** — Runs 2 parallel processes. For a 2-CPU VM, 2 workers is ideal. Each worker can handle one request at a time.
> 
> 💡 **`UvicornWorker`** — Gunicorn manages the processes, Uvicorn handles the async FastAPI requests inside each process. This is the recommended production setup for FastAPI.

### Step 7.2 — Create Log Directory

```bash
sudo mkdir -p /var/log/crag-pipeline
sudo chown azureuser:azureuser /var/log/crag-pipeline
```

### Step 7.3 — Enable and Start the Service

```bash
# Reload systemd to recognize the new service file
sudo systemctl daemon-reload

# Enable the service to auto-start on VM reboot
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
    server_name 20.219.20.209; # if domain avilable -> write it here 

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
# Test via curl (from inside the VM)
curl http://localhost/health
# Expected: {"status":"ok"}
```

From your Windows browser:
```
http://YOUR_VM_IP/health       → {"status": "ok"}
http://YOUR_VM_IP/docs         → FastAPI docs page
```

---

## SECTION 8 — Domain + HTTPS with Azure Public IP DNS Label (FREE + Easy) 🔥

This section helps you:

* Add a free Azure domain
* Connect it to your VM
* Enable HTTPS/SSL
* Secure your FastAPI backend
* Connect frontend safely from Vercel

---

### Final Result

Your backend URL will look like:

```text id="d19e4k"
https://correctiverag.centralindia.cloudapp.azure.com
```

instead of:

```text id="b1ngdt"
http://20.219.20.209
```

---

### STEP 1 — Open Azure Public IP Configuration

Go to:

```text id="3rb0eu"
Azure Portal → Virtual Machine → Networking → Public IP Address
```

OR directly:

```text id="tfjlwm"
VM → cragVM → cragVM-ip
```

---

### STEP 2 — Add DNS Name Label

Inside:

```text id="r3r58d"
Settings → Configuration
```

Find:

```text id="d3hx9k"
DNS name label (optional)
```

Enter a unique name:

```text id="jlwmf6"
correctiverag
```

Azure automatically creates:

```text id="b8f4tr"
correctiverag.centralindia.cloudapp.azure.com
```

Click:

```text id="z1kpzv"
Apply
```

Wait 1–2 minutes.

---

### STEP 3 — Verify Domain Works

Open browser:

```text id="mj4q5y"
http://correctiverag.centralindia.cloudapp.azure.com
```

If nginx is working correctly, your API should respond.

---

### STEP 4 — Update Nginx Configuration

Open nginx config:

```bash id="r1x4pg"
sudo nano /etc/nginx/sites-available/crag-pipeline
```

Replace existing content with:

```nginx id="ntx9ti"
server {
    listen 80;
    server_name correctiverag.centralindia.cloudapp.azure.com;

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

```text id="vw20rq"
CTRL + O
Enter
CTRL + X
```

---

### STEP 5 — Test Nginx Config

Run:

```bash id="jqwnkh"
sudo nginx -t
```

Expected output:

```text id="0y1zdp"
syntax is ok
test is successful
```

---

### STEP 6 — Restart Nginx

```bash id="jlwmzh"
sudo systemctl restart nginx
```

---

### STEP 7 — Install Certbot (SSL Tool)

Run:

```bash id="gmnly2"
sudo apt update

sudo apt install certbot python3-certbot-nginx -y
```

---

### STEP 8 — Generate HTTPS SSL Certificate

Run:

```bash id="uw7ixg"
sudo certbot --nginx -d correctiverag.centralindia.cloudapp.azure.com
```

---

### STEP 9 — Follow Certbot Prompts

When asked:

```text id="w6pbr7"
Enter email address
```

Enter your email.

---

Accept terms:

```text id="z4huzc"
Y
```

---

When asked:

```text id="zld8k5"
Redirect HTTP to HTTPS?
```

Choose:

```text id="tr4c74"
2
```

This forces secure HTTPS.

---

### STEP 10 — Verify HTTPS

Open:

```text id="drz50h"
https://correctiverag.centralindia.cloudapp.azure.com
```

Swagger docs:

```text id="o0nlpb"
https://correctiverag.centralindia.cloudapp.azure.com/docs
```

Health endpoint:

```text id="jy11e6"
https://correctiverag.centralindia.cloudapp.azure.com/health
```

---

### STEP 11 — Update Frontend Environment Variables

Go to:

```text id="mpof6n"
Vercel → Project → Settings → Environment Variables
```

Update:

```env id="w6vg5z"
NEXT_PUBLIC_API_URL=https://correctiverag.centralindia.cloudapp.azure.com
```

OR for Vite:

```env id="gt65a4"
VITE_API_URL=https://correctiverag.centralindia.cloudapp.azure.com
```

---

### STEP 12 — Redeploy Frontend

Redeploy Vercel project:

```text id="x4q8oq"
Deployments → Redeploy
```

OR push new commit to GitHub.

---

### STEP 13 — Add CORS in FastAPI

Open your `main.py`.

Add:

```python id="2a7vgk"
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

```bash id="ypv8e9"
sudo systemctl restart crag-pipeline
```

---

### STEP 15 — Final Test 🚀

Frontend:

```text id="mp4fxd"
https://self-correcting-rag-jt1h.vercel.app
```

Backend:

```text id="c5w6mr"
https://correctiverag.centralindia.cloudapp.azure.com
```

Swagger:

```text id="s2jvqo"
https://correctiverag.centralindia.cloudapp.azure.com/docs
```

---

### Final Production Architecture

```text id="kqqw7c"
Vercel Frontend (HTTPS)
        ↓
Azure Domain + SSL (HTTPS)
        ↓
Nginx Reverse Proxy
        ↓
FastAPI/Uvicorn Backend
```

---

### Important Security Recommendation 🔥

After nginx + HTTPS setup:

Remove public access to port `8000` from Azure Networking.

Only allow:

```text id="a9f7z0"
80  (HTTP)
443 (HTTPS)
```

This is proper production deployment practice ✅




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

---

## SECTION 10 — Updating the Deployment

### Safe Deployment Workflow

Whenever you push new code to GitHub, follow these steps on the VM:

```bash
# 1. Connect to VM
ssh -i "C:\Users\YourName\.ssh\crag-pipeline-key.pem" azureuser@YOUR_VM_IP

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

> ⚠️ **Zero-downtime note:** The app will be briefly unavailable during restart (usually under 5 seconds). For zero-downtime deployments you'd use a load balancer — beyond the scope of this guide.

---

## ✅ Deployment Checklist

Use this checklist to verify your deployment is complete and production-ready:

### Pre-Deployment
- [ ] Azure VM created (Ubuntu 22.04, Standard_B2ms or better)
- [ ] SSH key downloaded and stored safely
- [ ] Ports 22, 80, 443 open in Azure NSG
- [ ] SSH connection working from Windows

### Server Setup
- [ ] `sudo apt update && sudo apt upgrade` completed
- [ ] All system packages installed (`libgl1-mesa-glx`, `libglib2.0-0`, etc.)
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
- [ ] `http://YOUR_VM_IP/health` returns `{"status": "ok"}`
- [ ] `http://YOUR_VM_IP/docs` shows FastAPI Swagger UI
- [ ] Application logs show no errors
- [ ] Service restarts automatically (test with `sudo systemctl restart crag-pipeline`)

### Optional (Recommended for Production)
- [ ] Custom domain pointed to VM IP
- [ ] SSL certificate installed via Certbot
- [ ] `https://` URL working
- [ ] `CORS_ORIGINS` set to specific frontend domain (not `*`)
- [ ] `SECRET_KEY` is a strong random value (not the default)

---

## 🔒 Security Best Practices

1. **Never expose port 8000** directly — always use Nginx on port 80/443
2. **Use SSH keys** — disable password authentication:
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set: PasswordAuthentication no
   sudo systemctl restart sshd
   ```
3. **Keep system updated** — run `sudo apt update && sudo apt upgrade` weekly
4. **Use a strong `SECRET_KEY`** — generate with `python3 -c "import secrets; print(secrets.token_hex(32))"`
5. **Restrict CORS** — set `CORS_ORIGINS` to your exact frontend URL in production
6. **Set up UFW firewall**:
   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```
7. **Rotate API keys** if your `.env` file is ever accidentally exposed

---

*Generated for CRAG Pipeline v2.0.0 — FastAPI + LangGraph + Qdrant + Neon DB*
