export function createTaskCatalogSelection(api, changed, failed) {
  let key = null;
  let controller;
  let catalog = null;
  let pending = false;
  let failedKey = null;
  return {
    get catalog() {
      return catalog;
    },
    ready(session) {
      return (
        !session?.taskCatalog ||
        Boolean(catalog && key === `${session.id}:${session.taskCatalog.digest}`)
      );
    },
    select(session, retry = false) {
      const next = session?.taskCatalog ? `${session.id}:${session.taskCatalog.digest}` : null;
      if (next === key && !retry) return;
      controller?.abort();
      key = next;
      catalog = null;
      pending = false;
      failedKey = null;
      if (!next) return;
      const request = new AbortController();
      controller = request;
      pending = true;
      api(`/api/sessions/${session.id}/tasks`, undefined, request.signal)
        .then((value) => {
          if (request.signal.aborted || key !== next) return;
          if (
            value?.descriptor?.digest !== session.taskCatalog.digest ||
            value?.descriptor?.revision !== session.taskCatalog.revision ||
            value?.descriptor?.source !== session.taskCatalog.source ||
            value.revision !== session.taskCatalog.revision ||
            !value.tasks ||
            !Object.keys(value.tasks).length
          )
            throw new Error('Session task catalog does not match the selected session.');
          catalog = value;
          pending = false;
          changed();
        })
        .catch((error) => {
          if (request.signal.aborted || key !== next) return;
          pending = false;
          failedKey = next;
          failed(error.message);
          changed();
        });
    },
    get status() {
      return pending ? 'loading' : failedKey ? 'error' : catalog ? 'ready' : 'inactive';
    },
    close() {
      controller?.abort();
      key = null;
      catalog = null;
      pending = false;
      failedKey = null;
    },
  };
}
