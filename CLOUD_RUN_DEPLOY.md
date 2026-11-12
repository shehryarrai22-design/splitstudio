# SplitStudio — Google Cloud Run deployment package

This project is configured as a single Node.js + React service. The container installs native `ffmpeg` and `ffprobe`, serves the built frontend from Express, and listens on the port supplied by Cloud Run.

## Important architecture and persistence warning

The current application still stores its user database, sessions, uploaded videos, thumbnails, and clips as files under `DATA_DIR` (default `/data` in this container). Cloud Run's normal container filesystem is ephemeral. **Do not launch a public production service without attaching persistent storage and making backups.** The current JSON-file database and in-memory job queue are suitable for a small single-instance pilot only, not a horizontally scaled SaaS. Keep maximum instances at 1 for this version. For a real multi-user SaaS, migrate users/jobs to a managed database (for example Cloud SQL or Firestore) and video assets to Cloud Storage, and use a durable job queue.

## 1. Prepare Google Cloud

1. Create/select a Google Cloud project and enable billing.
2. Install the Google Cloud CLI and run `gcloud auth login`.
3. Set your project: `gcloud config set project YOUR_PROJECT_ID`.
4. Enable Cloud Run and Artifact Registry APIs:
   `gcloud services enable run.googleapis.com artifactregistry.googleapis.com`
5. Create a persistent filesystem for `/data` before production use. The simplest supported approach for this file-based version is a Cloud Run NFS/Filestore volume. Configure the volume mount at `/data`, with read/write permissions for the container. Do not rely on the container's writable layer.

## 2. Configure the first admin

Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` (at least 12 characters) as Cloud Run environment variables/secrets. Production startup intentionally refuses to initialize a new database without them. Do not commit real credentials to source control.

## 3. Build and deploy the container

Create an Artifact Registry Docker repository once:

```bash
gcloud artifacts repositories create splitstudio \
  --repository-format=docker \
  --location=YOUR_REGION \
  --description="SplitStudio container images"

gcloud auth configure-docker YOUR_REGION-docker.pkg.dev
```

Build and push the image:

```bash
docker build -t YOUR_REGION-docker.pkg.dev/YOUR_PROJECT_ID/splitstudio/splitstudio:latest .
docker push YOUR_REGION-docker.pkg.dev/YOUR_PROJECT_ID/splitstudio/splitstudio:latest
```

Create the Secret Manager secret `splitstudio-admin-password` before deployment. Then deploy:

```bash
gcloud run deploy splitstudio \
  --image YOUR_REGION-docker.pkg.dev/YOUR_PROJECT_ID/splitstudio/splitstudio:latest \
  --region YOUR_REGION \
  --allow-unauthenticated \
  --max 1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 3600 \
  --set-env-vars NODE_ENV=production,DATA_DIR=/data,ADMIN_EMAIL=YOUR_ADMIN_EMAIL \
  --set-secrets ADMIN_PASSWORD=splitstudio-admin-password:latest
```

**Before accepting uploads:** edit the Cloud Run service and attach a persistent Filestore/NFS volume mounted at `/data`, with write access for the container. Configure the required VPC connection for the Filestore mount. The command above creates the service but does not configure that storage mount. Do not treat Cloud Run's default container filesystem as permanent storage. Keep maximum instances at 1 for this JSON-database version.

After deployment, open the Cloud Run service URL and check `/healthz`. Confirm that `ffmpeg -version` and `ffprobe -version` work in the deployed container (the Docker image installs both).

## 4. Local container test

```bash
docker build -t splitstudio .
docker run --rm -p 8080:8080 \
  -e NODE_ENV=production \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD='use-a-unique-password-123' \
  -e DATA_DIR=/data \
  -v splitstudio-data:/data \
  splitstudio
```

Open `http://localhost:8080`. Health check: `http://localhost:8080/healthz`.

## 5. Netlify

Netlify can host a static frontend, but this project currently relies on the same Express server for authentication, uploads, file streaming, and FFmpeg. Deploy the complete container to Cloud Run first. Do not publish the `dist` folder alone to Netlify unless the frontend API URLs are separately configured and the backend is already deployed and reachable.

## Current limitations to resolve before a public SaaS launch

- JSON-file database and sessions are not safe for multiple concurrent instances or multi-region scaling.
- The in-memory job queue loses queued work if the instance restarts.
- File storage needs persistent volume backups and capacity monitoring.
- Configure HTTPS (Cloud Run provides it), request limits, monitoring, log retention, and abuse/rate limits.
- Review authentication, admin bootstrap, password reset, and data deletion flows before onboarding real customers.
