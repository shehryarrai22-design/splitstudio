# SplitStudio

SplitStudio is a React + Express video splitting application. This export includes a Cloud Run Dockerfile with native FFmpeg/FFprobe.

## Run locally

Prerequisites: Node.js 22+, npm, and FFmpeg/FFprobe installed on your machine and available on `PATH`.

```bash
npm install
npm run dev
```

Open the local URL printed by the server (default port 8080 in the container; local development uses `PORT` if supplied).

## Deploy

See [CLOUD_RUN_DEPLOY.md](./CLOUD_RUN_DEPLOY.md) for the container build, Cloud Run setup, persistent-storage warning, and deployment steps.

**Important:** this version uses a JSON-file database and a local file queue. It is a single-instance pilot package, not yet a horizontally scalable production SaaS. Attach persistent storage at `DATA_DIR` before allowing real uploads. For a public SaaS launch, migrate the database and job queue to managed services and store video objects in durable object storage.
