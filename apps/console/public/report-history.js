export function bindReportHistory(container, body, api, action) {
  const find = (name) => container.querySelector(`[data-reports="${name}"]`);
  let revision = 0;
  let runId;
  let page;
  let loading = false;
  let problem;
  const render = () => {
    const selected = find('assignment').value;
    find('assignment').disabled = loading || !find('assignment').options.length;
    find('latest').disabled = loading || !selected;
    find('earlier').disabled = loading || !page?.reportHistoryPage.nextBeforeReportId;
    const versions = page?.reportHistory.map((record) => record.version) ?? [];
    find('status').textContent = loading
      ? 'Loading report history…'
      : problem
        ? problem
        : versions.length
          ? `Versions ${versions[0]}–${versions.at(-1)} · Latest version ${page.reportHistoryPage.latestVersion} · Read-only`
          : 'No published reports in this selection.';
  };
  const update = async (before) => {
    const requestRevision = ++revision;
    const assignment = find('assignment').value;
    page = undefined;
    body.textContent = '';
    problem = undefined;
    loading = Boolean(assignment);
    render();
    if (!assignment) return;
    const params = new URLSearchParams({ assignment });
    if (before) params.set('before', before);
    try {
      const result = await api(`/api/runs/${encodeURIComponent(runId)}/reports?${params}`);
      if (requestRevision !== revision) return;
      page = result;
      body.textContent = JSON.stringify(page, null, 2);
      body.scrollTop = 0;
    } catch (error) {
      if (requestRevision !== revision) return;
      problem = 'Report history could not be loaded. Refresh or select another assignment.';
      throw error;
    } finally {
      if (requestRevision === revision) {
        loading = false;
        render();
      }
    }
  };
  find('assignment').onchange = () => action(() => update());
  find('latest').onclick = () => action(() => update());
  find('earlier').onclick = () => action(() => update(page.reportHistoryPage.nextBeforeReportId));
  return {
    async open(id, assignments) {
      revision++;
      runId = id;
      container.hidden = false;
      find('assignment').replaceChildren(
        ...assignments.map((assignment) => {
          const option = document.createElement('option');
          option.value = assignment.id;
          option.textContent = `${assignment.member} · ${assignment.id}`;
          return option;
        }),
      );
      await update();
    },
    close() {
      revision++;
      runId = undefined;
      page = undefined;
      loading = false;
      problem = undefined;
      container.hidden = true;
      body.textContent = '';
      find('assignment').replaceChildren();
    },
  };
}
