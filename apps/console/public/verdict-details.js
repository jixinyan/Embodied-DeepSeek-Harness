export function bindVerdictDetails(container, body, api, action) {
  const find = (name) => container.querySelector(`[data-verdict="${name}"]`);
  let runId;
  let revision = 0;
  let controller;
  const update = async () => {
    const current = ++revision;
    controller?.abort();
    controller = new AbortController();
    const verdict = find('selection').value;
    body.textContent = '';
    find('status').textContent = verdict ? 'Loading accepted verdict…' : 'No accepted verdicts.';
    find('refresh').disabled = !verdict;
    if (!verdict) return;
    try {
      const result = await api(
        `/api/runs/${encodeURIComponent(runId)}/verdicts?${new URLSearchParams({ verdict })}`,
        undefined,
        controller.signal,
      );
      if (revision !== current) return;
      body.textContent = JSON.stringify(result.result, null, 2);
      body.scrollTop = 0;
      find('status').textContent =
        `Formal verdict: ${result.result.status} · ${result.result.checks.length} checks`;
    } catch (error) {
      if (revision !== current) return;
      find('status').textContent = 'Accepted verdict could not be loaded.';
      throw error;
    }
  };
  find('selection').onchange = () => action(update);
  find('refresh').onclick = () => action(update);
  return {
    async open(id, verdicts) {
      runId = id;
      find('selection').replaceChildren(
        ...verdicts.map((verdict) => {
          const option = document.createElement('option');
          option.value = verdict.verdict_id;
          option.textContent = `${verdict.status} · ${verdict.task_scope.goal_id ?? verdict.task_scope.task_id} · ${verdict.verdict_id}`;
          return option;
        }),
      );
      if (verdicts.length) find('selection').value = verdicts.at(-1).verdict_id;
      container.hidden = false;
      await update();
    },
    close() {
      revision++;
      controller?.abort();
      controller = undefined;
      runId = undefined;
      container.hidden = true;
      body.textContent = '';
      find('selection').replaceChildren();
      find('status').textContent = '';
    },
  };
}
