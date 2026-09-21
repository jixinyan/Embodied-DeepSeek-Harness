export function bindSessionAudit(container, body, api, action) {
  const find = (name) => container.querySelector(`[data-audit="${name}"]`);
  let revision = 0;
  let runId;
  let index;
  let page;
  let loading = false;
  let problem;
  const render = () => {
    find('assignment').disabled = loading || !index?.sessions.length;
    find('first-assignments').disabled = loading || !runId;
    find('next-assignments').disabled = loading || !index?.nextAfter;
    find('earlier').disabled = loading || !page || page.afterOffset === 0;
    find('later').disabled = loading || !page || page.throughOffset === page.eventTotal;
    find('latest').disabled = loading || !find('assignment').value;
    find('status').textContent = loading
      ? 'Loading audit page…'
      : problem
        ? problem
        : page
          ? `Events ${page.events.length ? page.afterOffset + 1 : 0}–${page.throughOffset} of ${page.eventTotal} · Read-only`
          : 'No published audit events for this task.';
  };
  const update = async (operation, cursor) => {
    const requestRevision = ++revision;
    const selectedRun = runId;
    const previousPage = page;
    problem = undefined;
    if (operation === 'index' || operation === 'latest') {
      page = undefined;
      body.textContent = '';
    }
    loading = true;
    render();
    const base = `/api/runs/${encodeURIComponent(selectedRun)}/audit`;
    try {
      if (operation === 'index') {
        const query = cursor ? `?afterAssignment=${encodeURIComponent(cursor)}` : '';
        const result = await api(base + query);
        if (requestRevision !== revision) return;
        index = result;
        page = undefined;
        find('assignment').replaceChildren(
          ...index.sessions.map((session) => {
            const option = document.createElement('option');
            option.value = session.assignmentId;
            option.textContent = `${session.assignmentId} · ${session.eventTotal} events`;
            return option;
          }),
        );
      }
      const assignment = find('assignment').value;
      if (!assignment) {
        body.textContent = '';
        return;
      }
      const params = new URLSearchParams({ assignment });
      if (operation === 'earlier' || operation === 'later') {
        params.set(operation === 'earlier' ? 'before' : 'after', String(cursor));
        params.set('through', String(previousPage.eventTotal));
      }
      const result = await api(`${base}?${params}`);
      if (requestRevision !== revision) return;
      page = result;
      body.textContent = JSON.stringify(page, null, 2);
      body.scrollTop = 0;
    } catch (error) {
      if (requestRevision !== revision) return;
      problem = 'Audit page could not be loaded. Refresh or select another assignment.';
      throw error;
    } finally {
      if (requestRevision === revision) {
        loading = false;
        render();
      }
    }
  };
  find('assignment').onchange = () => action(() => update('latest'));
  find('first-assignments').onclick = () => action(() => update('index'));
  find('next-assignments').onclick = () => action(() => update('index', index.nextAfter));
  find('earlier').onclick = () => action(() => update('earlier', page.afterOffset));
  find('later').onclick = () => action(() => update('later', page.throughOffset));
  find('latest').onclick = () => action(() => update('latest'));
  return {
    async open(id) {
      revision++;
      runId = id;
      index = undefined;
      page = undefined;
      body.textContent = '';
      find('assignment').replaceChildren();
      container.hidden = false;
      await update('index');
    },
    close() {
      revision++;
      runId = undefined;
      index = undefined;
      page = undefined;
      loading = false;
      problem = undefined;
      container.hidden = true;
      body.textContent = '';
      find('assignment').replaceChildren();
    },
  };
}
