# 🐳 CRAG Backend Dockerization & CI/CD Guide

This guide provides step-by-step instructions to containerize the CRAG backend, test it locally, configure GitHub Actions for automated building/pushing, and deploy it using Docker Hub.

---

## 📋 Table of Contents
1. [Local Dockerization (Testing)](#1-local-dockerization-testing)
2. [GitHub Secrets Setup](#2-github-secrets-setup)
3. [Understanding the CI/CD Pipeline](#3-understanding-the-cicd-pipeline)
4. [Running the Published Image from Docker Hub](#4-running-the-published-image-from-docker-hub)

---

## 1. Local Dockerization (Testing)

Before pushing to production/Docker Hub, it is best practice to verify that the Docker container builds and runs locally.

### Step 1.1: Build the Docker Image
Run this command from the root directory of your project:
```bash
docker build -t crag-backend ./backend
```

### Step 1.2: Run the Docker Container Locally
To run the container, you need to supply the environment variables that your backend uses (from your `backend/.env` file). Run the following command (replace placeholder values with your actual credentials):

```bash
docker run -d \
  -p 8000:8000 \
  --name crag-backend-container \
  -e GROQ_API_KEY="your_groq_api_key" \
  -e TAVILY_API_KEY="your_tavily_api_key" \
  -e QDRANT_URL="https://your-cluster.cloud.qdrant.io:6333" \
  -e QDRANT_API_KEY="your_qdrant_api_key" \
  -e DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require" \
  -e SECRET_KEY="your_random_secret_key_here" \
  crag-backend
```

> [!TIP]
> Alternatively, you can save your environment variables into a local `.env` file and use the `--env-file` flag:
> ```bash
> docker run -d -p 8000:8000 --name crag-backend-container --env-file ./backend/.env crag-backend
> ```

### Step 1.3: Verify the Container is Running
Verify that the container is up and running by inspecting active containers and checking the logs:
```bash
docker ps
docker logs -f crag-backend-container
```
Open `http://localhost:8000/docs` in your browser to verify that the Swagger UI API documentation loads correctly.

---

## 2. GitHub Secrets Setup

To allow GitHub Actions to push images to your Docker Hub repository (`kartik87580/crag`), you must add your credentials to GitHub Secrets.

> [!IMPORTANT]
> It is highly recommended to use a **Personal Access Token (PAT)** rather than your primary Docker Hub password.

### Step 2.1: Generate a Docker Hub Personal Access Token (PAT)
1. Log in to [Docker Hub](https://hub.docker.com/).
2. Click on your profile icon in the top right corner and select **Account Settings**.
3. Navigate to **Security** -> **Personal Access Tokens**.
4. Click **Create new access token**.
5. Give the token a descriptive description (e.g., `github-actions-crag-ci`) and select permissions (e.g., **Read & Write**).
6. Click **Generate** and **copy the token immediately** (you won't be able to see it again).

### Step 2.2: Add Secrets to GitHub Repository
1. Go to your repository on GitHub.
2. Click on **Settings** in the top navigation tab.
3. In the left sidebar, navigate to **Secrets and variables** -> **Actions**.
4. Click **New repository secret** and add the following two secrets:

| Secret Name | Value |
| :--- | :--- |
| `DOCKERHUB_USERNAME` | `kartik87580` |
| `DOCKERHUB_TOKEN` | *The Personal Access Token generated in Step 2.1* |

---

## 3. Understanding the CI/CD Pipeline

The GitHub Actions workflow configuration has been added to [ci-cd.yaml](file:///d:/1.DS%20projects/5-GenAI/10_crag/.github/workflows/ci-cd.yaml).

### How it triggers:
* **Pushes to `main`**: Triggers a build and push automatically if files within the `backend/` folder or the workflow file itself are modified.
* **Pull Requests**: Triggers a build-only test (without pushing to Docker Hub) on pull requests targeting `main` to verify the code still compiles and builds correctly.
* **Manual execution**: Can be manually triggered from the "Actions" tab on GitHub via `workflow_dispatch`.

### Pipeline Key Features:
* **Caching**: Utilizes GitHub Actions cache (`type=gha`) to cache Docker layers, reducing build times for future runs significantly.
* **Metadata Extraction**: Automates tagging using `docker/metadata-action` to apply the `latest` tag for releases on the `main` branch, along with tags matching the short Git commit SHA (e.g. `sha-a1b2c3d`) and branch/PR names.

---

## 4. Running the Published Image from Docker Hub

Once the GitHub Actions pipeline successfully builds and pushes the image, you (or others) can run the backend from anywhere by pulling the image directly from Docker Hub:

```bash
# Pull the latest image
docker pull kartik87580/crag:latest

# Run the container using the pulled image
docker run -d \
  -p 8000:8000 \
  --name crag-backend \
  --env-file ./backend/.env \
  kartik87580/crag:latest
```
