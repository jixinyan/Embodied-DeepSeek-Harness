export function bindClarification(root, api, action) {
  const question = root.querySelector('[data-clarification="question"]');
  const reason = root.querySelector('[data-clarification="reason"]');
  const options = root.querySelector('[data-clarification="options"]');
  const answer = root.querySelector('textarea');
  const submit = root.querySelector('[data-clarification="submit"]');
  const status = root.querySelector('[data-clarification="status"]');
  let current;
  let sending = false;
  let signature;
  const storageKey = (runId, id) => `edh.clarification:${runId}:${id}`;
  const stored = (key) => {
    const text = sessionStorage.getItem(key);
    if (text === null) return { draft: '' };
    const value = JSON.parse(text);
    if (
      !value ||
      value.version !== 1 ||
      typeof value.draft !== 'string' ||
      value.draft.length > 12000 ||
      (value.request !== undefined &&
        (!value.request ||
          typeof value.request.text !== 'string' ||
          value.request.text.length > 12000 ||
          !/^[a-f0-9-]{36}$/.test(value.request.requestId)))
    )
      throw new Error('Stored clarification response is invalid.');
    return value;
  };
  const save = () => {
    if (!current || current.record.state !== 'pending') return;
    const key = storageKey(current.runId, current.record.id);
    sessionStorage.setItem(
      key,
      JSON.stringify({ ...stored(key), version: 1, draft: answer.value }),
    );
  };
  const controls = () => {
    const enabled = current && !current.readOnly && current.record.state === 'pending' && !sending;
    answer.disabled = !enabled;
    submit.disabled = !enabled || !answer.value.trim();
    for (const button of options.querySelectorAll('button')) button.disabled = !enabled;
  };
  answer.addEventListener('input', () => {
    save();
    controls();
  });
  const render = (view) => {
    const record = view?.clarification;
    root.hidden = !record;
    if (!record) {
      current = undefined;
      signature = undefined;
      return;
    }
    const id = `${view.id}:${record.id}`;
    let admitted = record;
    if (
      current?.runId === view.id &&
      current.record.id === record.id &&
      current.record.state === 'answered' &&
      record.state === 'pending'
    )
      admitted = current.record;
    if (
      current?.runId === view.id &&
      current.record.id === record.id &&
      current.record.state === 'answered' &&
      record.state === 'answered' &&
      current.record.delivery !== 'queued' &&
      record.delivery === 'queued'
    )
      admitted = current.record;
    current = { runId: view.id, readOnly: view.readOnly, record: admitted };
    question.textContent = admitted.question;
    reason.textContent = admitted.reason;
    if (signature !== id) {
      signature = id;
      answer.value = stored(storageKey(view.id, record.id)).draft;
      options.replaceChildren(
        ...admitted.options.map((label) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'button small';
          button.textContent = label;
          button.onclick = () => {
            answer.value = label;
            save();
            controls();
            answer.focus();
          };
          return button;
        }),
      );
    }
    if (admitted.response) answer.value = admitted.response.text;
    status.textContent =
      admitted.state === 'pending'
        ? view.readOnly
          ? 'This task is read-only.'
          : 'Waiting for your response. Task criteria remain unchanged.'
        : admitted.state === 'answered'
          ? `Response saved · Delivery ${admitted.delivery}${admitted.error ? ` · ${admitted.error}` : ''}`
          : `${admitted.state}${admitted.error ? ` · ${admitted.error}` : ''}`;
    controls();
  };
  submit.onclick = () =>
    action(async () => {
      if (!current || current.readOnly || current.record.state !== 'pending' || sending) return;
      const target = current;
      const text = answer.value.trim();
      if (!text) throw new Error('Enter a response.');
      const key = storageKey(target.runId, target.record.id);
      const previous = stored(key);
      const request =
        previous.request?.text === text
          ? previous.request
          : { requestId: crypto.randomUUID(), text };
      sessionStorage.setItem(key, JSON.stringify({ version: 1, draft: answer.value, request }));
      sending = true;
      controls();
      try {
        const result = await api(
          `/api/runs/${target.runId}/clarifications/${target.record.id}`,
          request,
        );
        sessionStorage.removeItem(key);
        if (current?.runId === target.runId && current.record.id === target.record.id)
          render({ id: target.runId, readOnly: current.readOnly, clarification: result.record });
      } finally {
        sending = false;
        controls();
      }
    });
  return render;
}
