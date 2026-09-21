const byteSize = (bytes) => {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid storage byte count.');
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

export function renderStorageMaintenance(container, report, busy = false) {
  const text = (field, value) => {
    container.querySelector(`[data-storage="${field}"]`).textContent = value;
  };
  const statistics = report?.statistics;
  text('journal', statistics ? byteSize(statistics.journalBytes) : 'Not loaded');
  text('records', statistics ? String(statistics.records) : 'Not loaded');
  text('superseded', statistics ? byteSize(statistics.supersededBytes) : 'Not loaded');
  text(
    'status',
    busy
      ? 'Storage operation in progress.'
      : (report?.blockedBy ??
          (report?.result
            ? `Reclaimed ${byteSize(report.result.reclaimedBytes)}. All current records retained.`
            : statistics
              ? 'Compaction requires an idle workspace and ends retained task scopes.'
              : 'Open to inspect storage.')),
  );
  container.querySelector('#refresh-storage').disabled = busy;
  container.querySelector('#compact-storage').disabled =
    busy || !statistics || Boolean(report.blockedBy) || statistics.supersededBytes === 0;
}

export function bindStorageMaintenance(container, api, action) {
  let report;
  const update = async (compact = false) => {
    renderStorageMaintenance(container, report, true);
    try {
      report = compact
        ? await api('/api/storage/compact', { expectedSequence: report.statistics.sequence })
        : await api('/api/storage');
    } finally {
      renderStorageMaintenance(container, report);
    }
  };
  container.ontoggle = () => {
    if (container.open) void action(() => update());
  };
  container.querySelector('#refresh-storage').onclick = () => action(() => update());
  container.querySelector('#compact-storage').onclick = () => action(() => update(true));
}
