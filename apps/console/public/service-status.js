export function bindServiceStatus(root, request) {
  const list = root.querySelector('[data-services="list"]');
  const status = root.querySelector('[data-services="status"]');
  const refresh = root.querySelector('[data-services="refresh"]');
  const controller = new AbortController();
  let pending = false;
  const update = async () => {
    if (pending || controller.signal.aborted) return;
    pending = true;
    try {
      const snapshot = await request(
        '/api/services',
        undefined,
        AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      );
      if (typeof snapshot.managed !== 'boolean' || !Array.isArray(snapshot.services))
        throw new Error('Invalid managed service status.');
      root.hidden = !snapshot.services.length;
      const cards = snapshot.services.map((service) => {
        if (
          typeof service.label !== 'string' ||
          !['idle', 'starting', 'ready', 'stopping', 'stopped', 'failed'].includes(service.state) ||
          !Number.isSafeInteger(service.leases) ||
          service.leases < 0
        )
          throw new Error('Invalid managed service identity or lifecycle state.');
        const card = document.createElement('article');
        card.className = 'inset';
        const heading = document.createElement('strong');
        heading.textContent = service.label;
        const detail = document.createElement('p');
        detail.textContent = `${service.state} · ${service.leases} active service leases`;
        card.append(heading, detail);
        if (service.error) {
          const error = document.createElement('p');
          error.setAttribute('role', 'alert');
          error.textContent = service.error;
          card.append(error);
        }
        return card;
      });
      list.replaceChildren(...cards);
      status.setAttribute('role', 'status');
      status.textContent = snapshot.services.some((service) => service.state === 'failed')
        ? 'A configured service failed. Its affected environment is being released.'
        : 'Configured services start with their selected environment and stop after its final lease.';
    } catch (error) {
      if (!controller.signal.aborted) {
        root.hidden = false;
        status.textContent = error.message;
        status.setAttribute('role', 'alert');
      }
    } finally {
      pending = false;
    }
  };
  refresh.addEventListener('click', update, { signal: controller.signal });
  const timer = setInterval(() => {
    if (!document.hidden) void update();
  }, 1500);
  void update();
  return {
    close() {
      controller.abort();
      clearInterval(timer);
    },
  };
}
