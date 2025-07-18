import { Octokit } from "@octokit/rest";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Set this in your environment securely
const OWNER = 'TKTK123456';
const REPO = 'openfrontioAPI';
const WORKFLOW_ID = 'extractOpenfrontData.yml'; // Workflow filename
const REF = 'main'; // Branch name where workflow lives

export default async function getDumpData(date) {
  const octokit = new Octokit({
    auth: GITHUB_TOKEN
  })
  let res = await octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
    owner: OWNER,
    repo: REPO,
    workflow_id: WORKFLOW_ID,
    ref: REF,
    inputs: {
        date, // pass the date in YYYYMMDD format
    },
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  if (res.status === 204) {
    console.log('Workflow triggered successfully!');
  } else {
    const text = await res.text();
    throw new Error(`Failed to trigger workflow: ${res.status} ${text}`);
  }
}

// Example usage: trigger workflow for July 15, 2025
//getDumpData('20250715').catch(console.error);
