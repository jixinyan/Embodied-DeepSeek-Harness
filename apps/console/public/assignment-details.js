export function createAssignmentSelection(api, changed, failed) {
  let key;
  let value;
  let controller;
  let problem;
  let loading = false;
  const clear = () => {
    key = undefined;
    value = undefined;
    problem = undefined;
    loading = false;
    controller?.abort();
    controller = undefined;
  };
  return {
    get loading() {
      return loading;
    },
    get error() {
      return problem;
    },
    select(runId, assignment) {
      if (!runId || !assignment?.detailsStored) {
        clear();
        return undefined;
      }
      const selectedKey = `${runId}/${assignment.id}`;
      if (key === selectedKey) return value;
      clear();
      key = selectedKey;
      loading = true;
      controller = new AbortController();
      const signal = controller.signal;
      const params = new URLSearchParams({ assignment: assignment.id });
      void api(
        `/api/runs/${encodeURIComponent(runId)}/assignments?${params}`,
        undefined,
        signal,
      ).then(
        (result) => {
          if (key !== selectedKey || signal.aborted) return;
          value = result;
          loading = false;
          changed();
        },
        (error) => {
          if (key !== selectedKey || signal.aborted) return;
          loading = false;
          problem = error.message;
          failed(error.message);
          changed();
        },
      );
      return undefined;
    },
    clear,
  };
}

export function bindAssignmentDetails(container, body, api, action) {
  const find = (name) => container.querySelector(`[data-assignment="${name}"]`);
  let revision = 0;
  let runId;
  let loading = false;
  let controller;
  const update = async () => {
    const requestRevision = ++revision;
    controller?.abort();
    controller = new AbortController();
    const assignment = find('selection').value;
    body.textContent = '';
    loading = Boolean(assignment);
    find('selection').disabled = loading || !assignment;
    find('refresh').disabled = loading || !assignment;
    find('status').textContent = assignment ? 'Loading assignment details…' : 'No assignments.';
    if (!assignment) return;
    try {
      const params = new URLSearchParams({ assignment });
      const result = await api(
        `/api/runs/${encodeURIComponent(runId)}/assignments?${params}`,
        undefined,
        controller.signal,
      );
      if (requestRevision !== revision) return;
      body.textContent = JSON.stringify(result, null, 2);
      body.scrollTop = 0;
      find('status').textContent =
        `${result.assignment.member} · ${result.assignment.status} · ${result.archived ? 'Archived details' : 'Current details'}`;
    } catch (error) {
      if (requestRevision !== revision) return;
      find('status').textContent = 'Assignment details could not be loaded.';
      throw error;
    } finally {
      if (requestRevision === revision) {
        loading = false;
        find('selection').disabled = false;
        find('refresh').disabled = false;
      }
    }
  };
  find('selection').onchange = () => action(update);
  find('refresh').onclick = () => action(update);
  return {
    async open(id, assignments) {
      revision++;
      runId = id;
      find('selection').replaceChildren(
        ...assignments.map((assignment) => {
          const option = document.createElement('option');
          option.value = assignment.id;
          option.textContent = `${assignment.member} · ${assignment.id}`;
          return option;
        }),
      );
      container.hidden = false;
      await update();
    },
    close() {
      revision++;
      controller?.abort();
      controller = undefined;
      runId = undefined;
      loading = false;
      container.hidden = true;
      body.textContent = '';
      find('selection').replaceChildren();
    },
  };
}
