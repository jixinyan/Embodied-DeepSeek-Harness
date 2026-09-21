export function bindWorkspaceHistory(
  container,
  api,
  { openRun, inspectSession, selectedRun, changed, failed },
) {
  const find = (name) => container.querySelector(`[data-workspace="${name}"]`);
  let sessionBefore = null;
  let runBefore = null;
  let scope = '';
  let selectedSession;
  let revision = 0;
  let controller;
  let data;
  let signature;
  let pending;
  const request = (path, values, signal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
    return api(`${path}?${params}`, undefined, signal);
  };
  const render = () => {
    const { tasks, sessions } = data;
    find('sessions').replaceChildren();
    for (const session of sessions.sessions) {
      const row = document.createElement('div');
      const button = document.createElement('button');
      button.className = 'user-session-heading';
      button.classList.toggle('active', scope === session.id);
      const title = document.createElement('strong');
      title.textContent = `Session ${session.id.slice(0, 8)} · ${session.state}`;
      const detail = document.createElement('span');
      detail.textContent = `${session.environment ?? 'Unknown environment'} · ${session.embodiment ?? 'Unknown embodiment'} · ${session.runCount} tasks`;
      button.append(title, detail);
      button.onclick = () =>
        navigate(() => {
          scope = session.id;
          selectedSession = session;
          runBefore = null;
        });
      const inspect = document.createElement('button');
      inspect.textContent = 'Inspect session';
      inspect.onclick = () => inspectSession(session.id);
      row.append(button, inspect);
      find('sessions').append(row);
    }
    const options = new Map([
      ['', 'All tasks'],
      ['standalone', 'Standalone tasks'],
    ]);
    for (const session of [selectedSession, sessions.activeSession, ...sessions.sessions])
      if (session)
        options.set(
          session.id,
          `Session ${session.id.slice(0, 8)} · ${session.environment ?? 'Unknown environment'}`,
        );
    find('scope').replaceChildren(...[...options].map(([id, label]) => new Option(label, id)));
    find('scope').value = scope;
    find('runs').replaceChildren();
    for (const run of tasks.runs) {
      const button = document.createElement('button');
      button.classList.toggle('active', run.id === selectedRun());
      if (run.id === selectedRun()) button.setAttribute('aria-current', 'true');
      button.title = `${run.instruction}\n${run.id} · ${new Date(run.createdAt).toLocaleString()}`;
      const title = document.createElement('strong');
      title.textContent =
        run.instruction.length > 72 ? `${run.instruction.slice(0, 71)}…` : run.instruction;
      const detail = document.createElement('span');
      detail.textContent = `${run.state} · ${run.userSessionId ? `Session ${run.userSessionId.slice(0, 8)}` : 'Standalone'} · ${new Date(run.createdAt).toLocaleString()}`;
      button.append(title, detail);
      button.onclick = () => openRun(run.id);
      find('runs').append(button);
    }
    find('session-status').textContent = sessions.sessions.length
      ? `${sessions.sessions.length} sessions · ${sessionBefore ? 'Earlier history' : 'Recent history'}`
      : 'No sessions in this selection.';
    find('run-status').textContent = tasks.runs.length
      ? `${tasks.runs.length} tasks · ${runBefore ? 'Earlier history' : 'Recent history'}`
      : 'No tasks in this selection.';
    find('sessions-earlier').disabled = !sessions.nextBeforeId;
    find('runs-earlier').disabled = !tasks.nextBeforeId;
    find('sessions-latest').disabled = !sessionBefore;
    find('runs-latest').disabled = !runBefore;
  };
  async function load() {
    const ownRevision = ++revision;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    try {
      const [tasks, sessions] = await Promise.all([
        request('/api/runs', { before: runBefore, session: scope }, signal),
        request('/api/sessions', { before: sessionBefore }, signal),
      ]);
      if (ownRevision !== revision) return undefined;
      data = { tasks, sessions };
      const currentSignature = JSON.stringify([
        tasks.runs,
        sessions.sessions,
        sessions.activeId,
        scope,
        sessionBefore,
        runBefore,
        selectedRun(),
      ]);
      if (signature !== currentSignature) {
        render();
        signature = currentSignature;
      }
      changed(data);
      return data;
    } catch (error) {
      if (ownRevision !== revision) return undefined;
      throw error;
    }
  }
  function refresh() {
    const key = JSON.stringify([sessionBefore, runBefore, scope]);
    if (pending?.key === key) return pending.promise;
    const promise = load();
    pending = { key, promise };
    const clear = () => {
      if (pending?.promise === promise) pending = undefined;
    };
    void promise.then(clear, clear);
    return promise;
  }
  function navigate(change) {
    change();
    void refresh().catch((error) => failed(error.message));
  }
  find('scope').onchange = () =>
    navigate(() => {
      scope = find('scope').value;
      selectedSession =
        data.sessions.sessions.find((session) => session.id === scope) ??
        (data.sessions.activeSession?.id === scope ? data.sessions.activeSession : selectedSession);
      runBefore = null;
    });
  find('sessions-earlier').onclick = () =>
    navigate(() => {
      sessionBefore = data.sessions.nextBeforeId;
    });
  find('sessions-latest').onclick = () =>
    navigate(() => {
      sessionBefore = null;
    });
  find('runs-earlier').onclick = () =>
    navigate(() => {
      runBefore = data.tasks.nextBeforeId;
    });
  find('runs-latest').onclick = () =>
    navigate(() => {
      runBefore = null;
    });
  return {
    refresh,
    close() {
      revision++;
      controller?.abort();
    },
  };
}

export function bindTaskContextHistory(container, api, changed, failed) {
  const find = (name) => container.querySelector(`[data-context="${name}"]`);
  let sessionId;
  let before = null;
  let next = null;
  let runs = [];
  let revision = 0;
  let controller;
  let pending;
  async function load(id) {
    const ownRevision = ++revision;
    controller?.abort();
    controller = new AbortController();
    if (sessionId !== id) {
      sessionId = id;
      before = null;
      runs = [];
    }
    find('earlier').disabled = true;
    find('latest').disabled = true;
    if (!id) {
      runs = [];
      find('status').textContent = 'No active session.';
      changed();
      return;
    }
    find('status').textContent = 'Loading task outcomes…';
    const params = new URLSearchParams({ session: id });
    if (before) params.set('before', before);
    try {
      const result = await api(`/api/runs?${params}`, undefined, controller.signal);
      if (ownRevision !== revision) return;
      runs = result.runs;
      next = result.nextBeforeId;
      find('earlier').disabled = !next;
      find('latest').disabled = !before;
      find('status').textContent =
        `${runs.length} tasks · ${before ? 'Earlier outcomes' : 'Recent outcomes'}`;
      changed();
    } catch (error) {
      if (ownRevision !== revision) return;
      find('status').textContent = 'Task outcomes could not be loaded.';
      throw error;
    }
  }
  function refresh(id) {
    const key = JSON.stringify([id, sessionId === id ? before : null]);
    if (pending?.key === key) return pending.promise;
    const promise = load(id);
    pending = { key, promise };
    const clear = () => {
      if (pending?.promise === promise) pending = undefined;
    };
    void promise.then(clear, clear);
    return promise;
  }
  find('earlier').onclick = () => {
    if (!container.parentElement.querySelector('#task-context').reportValidity()) return;
    before = next;
    void refresh(sessionId).catch((error) => failed(error.message));
  };
  find('latest').onclick = () => {
    if (!container.parentElement.querySelector('#task-context').reportValidity()) return;
    before = null;
    void refresh(sessionId).catch((error) => failed(error.message));
  };
  return {
    refresh,
    get runs() {
      return runs;
    },
    close() {
      revision++;
      controller?.abort();
    },
  };
}
