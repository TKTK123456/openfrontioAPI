const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Set this in your environment securely
const OWNER = 'TKTK123456';
const REPO = 'openfrontioAPI';
const WORKFLOW_ID = 'extractOpenfrontData.yml'; // Workflow filename
const REF = 'main'; // Branch name where workflow lives

export default async function getDumpData(date) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`;
  
  const body = {
    ref: REF,
    inputs: {
      date, // pass the date in YYYYMMDD format
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 204) {
    console.log('Workflow triggered successfully!');
  } else {
    const text = await res.text();
    throw new Error(`Failed to trigger workflow: ${res.status} ${text}`);
  }
}

// Example usage: trigger workflow for July 15, 2025
getDumpData('20250715').catch(console.error);
