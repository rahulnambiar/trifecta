// GCP access for the web app (Phase 1 — training trigger).
// The service-account key is provided base64-encoded in GCP_SA_KEY_B64 (never committed;
// set in .env.local + Vercel). Used to mint an access token for the Vertex AI REST API.
import { GoogleAuth } from 'google-auth-library';

export function gcpConfigured() {
  return Boolean(
    process.env.GCP_PROJECT && process.env.GCP_REGION &&
    process.env.GCS_BUCKET && process.env.GCP_SA_KEY_B64
  );
}

export function gcp() {
  const project = process.env.GCP_PROJECT;
  return {
    project,
    region: process.env.GCP_REGION,
    bucket: process.env.GCS_BUCKET,
    runtimeServiceAccount: `trifecta-runner@${project}.iam.gserviceaccount.com`,
    image: `${process.env.GCP_REGION}-docker.pkg.dev/${project}/trifecta/meridian-runner:cpu`,
  };
}

function credentials() {
  return JSON.parse(Buffer.from(process.env.GCP_SA_KEY_B64, 'base64').toString('utf8'));
}

export async function getAccessToken() {
  const auth = new GoogleAuth({
    credentials: credentials(),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  return typeof t === 'string' ? t : t?.token;
}

// Submit a Vertex AI CustomJob that runs the meridian-runner for one model version.
export async function submitTrainingJob({ versionId, smoke }) {
  const { project, region, bucket, runtimeServiceAccount, image } = gcp();
  const token = await getAccessToken();
  const env = [
    { name: 'MODEL_VERSION_ID', value: versionId },
    { name: 'SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL },
    { name: 'SUPABASE_SECRET_KEY', value: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: 'GCS_BUCKET', value: bucket },
    { name: 'SMOKE', value: smoke ? '1' : '0' },
    // Phase 0/1 interim: train on the public simulated dataset (the client's harmonised
    // BigQuery table becomes the source once harmonisation runs). Reads a URL fine.
    { name: 'TRAINING_CSV', value: process.env.TRAINING_CSV || 'https://raw.githubusercontent.com/google/meridian/refs/heads/main/meridian/data/simulated_data/csv/geo_all_channels.csv' },
  ];
  const body = {
    displayName: `trifecta-${versionId.slice(0, 8)}${smoke ? '-smoke' : ''}`,
    jobSpec: {
      workerPoolSpecs: [{
        machineSpec: { machineType: smoke ? 'n1-standard-4' : 'n1-highmem-8' },
        replicaCount: 1,
        containerSpec: {
          imageUri: image,
          command: ['python', '-m', 'meridian_runner.run_version'],
          args: ['--model-version-id', versionId],
          env,
        },
      }],
      serviceAccount: runtimeServiceAccount,
    },
  };
  const resp = await fetch(
    `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/customJobs`,
    { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  const jr = await resp.json();
  if (!resp.ok) {
    const msg = jr?.error?.message || `Vertex submit failed (${resp.status})`;
    const e = new Error(msg); e.detail = jr; throw e;
  }
  return jr; // { name: ".../customJobs/123", state: "JOB_STATE_QUEUED", ... }
}
