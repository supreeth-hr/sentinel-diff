/**
 * Minimal dashboard HTML: fetches /api/runs and shows risk over time and run counts.
 */
export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sentinel-Diff Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.5rem; }
    .filters { margin: 1rem 0; display: flex; gap: 1rem; align-items: center; }
    .filters input, .filters button { padding: 0.4rem 0.8rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; }
    .meta { color: #666; font-size: 0.9rem; margin-top: 1rem; }
    .error { color: #c00; }
  </style>
</head>
<body>
  <h1>Sentinel-Diff Dashboard</h1>
  <p>Risk trends and run history. Data from <code>runs</code> table when <code>DATABASE_URL</code> is set.</p>
  <div class="filters">
    <label>Repo (owner/name): <input type="text" id="repo" placeholder="e.g. myorg/myrepo"></label>
    <label>Since (ISO date): <input type="date" id="since"></label>
    <button id="fetch">Fetch runs</button>
  </div>
  <div id="out"></div>
  <div class="meta" id="meta"></div>
  <script>
    document.getElementById('fetch').onclick = async () => {
      const repo = document.getElementById('repo').value.trim();
      const since = document.getElementById('since').value || undefined;
      const params = new URLSearchParams();
      if (repo) params.set('repo', repo);
      if (since) params.set('since', since + 'T00:00:00.000Z');
      const out = document.getElementById('out');
      const meta = document.getElementById('meta');
      try {
        const res = await fetch('/api/runs?' + params.toString());
        const data = await res.json();
        if (!res.ok) { out.innerHTML = '<p class="error">' + (data.message || res.status) + '</p>'; return; }
        const runs = data.runs || [];
        meta.textContent = runs.length + ' run(s)';
        if (runs.length === 0) {
          out.innerHTML = '<p>No runs found. Trigger a PR analysis via webhook to store metrics.</p>';
          return;
        }
        let table = '<table><thead><tr><th>Repo</th><th>PR</th><th>Risk</th><th>Violations</th><th>Drift</th><th>Time</th></tr></thead><tbody>';
        runs.forEach(r => {
          table += '<tr><td>' + r.repo_owner + '/' + r.repo_name + '</td><td>#' + r.pr_number + '</td><td>' + r.risk_score + '/10</td><td>' + r.violation_count + '</td><td>' + r.drift_count + '</td><td>' + new Date(r.created_at).toLocaleString() + '</td></tr>';
        });
        table += '</tbody></table>';
        out.innerHTML = table;
      } catch (e) {
        out.innerHTML = '<p class="error">' + e.message + '</p>';
      }
    };
  </script>
</body>
</html>`;
}
