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
  const inspection = report?.images?.inspection;
  const ready = inspection?.state === 'ready';
  const collection = report?.originalCollection;
  const preview = collection?.preview;
  const retirement = report?.recordRetirement;
  const selectedSessions = new Set(report?.selectedSessionIds ?? []);
  const sessionList = container.querySelector('#retention-sessions');
  sessionList.replaceChildren();
  for (const session of report?.sessions ?? []) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = session.sessionId;
    checkbox.checked = selectedSessions.has(session.sessionId);
    checkbox.disabled = busy || Boolean(report?.blockedBy);
    label.append(
      checkbox,
      document.createTextNode(
        ` ${session.profileId} · ${session.createdAt} · ${session.taskCount} tasks · ${session.recordCount} records`,
      ),
    );
    sessionList.append(label, document.createElement('br'));
  }
  const selectedRows = (report?.sessions ?? []).filter((session) =>
    selectedSessions.has(session.sessionId),
  );
  const selected = selectedRows.length > 0;
  const unarchived = selectedRows.some((session) => session.unarchivedRequests > 0);
  const retirementPreview = retirement?.preview;
  text(
    'retirement-status',
    !retirement?.available
      ? (retirement?.reason ?? 'Record retention ownership is not configured.')
      : retirementPreview
        ? `${retirementPreview.selected.length} selected records · ${retirementPreview.retainedRecords} retained records · ${retirementPreview.skillCount} verified SKILL sources. Delete inspected history removes the selected records.`
        : report?.result?.operation === 'request_identity_archive'
          ? `Preserved ${report.result.archivedRecords} request identities. Inspect selected history to preview deletion.`
          : report?.result?.operation === 'domain_record_retirement'
            ? `Deleted ${report.result.removedRecords} inspected records. Archived request identities remain reserved.`
            : 'Select closed sessions and archive their request identities before inspection.',
  );
  container.querySelector('#archive-requests').disabled =
    busy || !retirement?.available || Boolean(report?.blockedBy) || !selected || !unarchived;
  container.querySelector('#inspect-records').disabled =
    busy || !retirement?.available || Boolean(report?.blockedBy) || !selected || unarchived;
  container.querySelector('#retire-records').disabled =
    busy || !retirement?.available || Boolean(report?.blockedBy) || !retirementPreview;
  for (const [field, usage] of [
    ['image-retained', preview?.inspection.retainedObjects],
    ['image-unreferenced', preview?.inspection.unreferencedObjects],
  ])
    text(field, usage ? `${usage.files} files · ${byteSize(usage.bytes)}` : 'Not inspected');
  text(
    'collection-status',
    !collection?.available
      ? (collection?.reason ?? 'Original-image retention ownership is not configured.')
      : preview
        ? `${preview.sourceIds.length} reference sources checked · ${preview.skillCount} SKILL sources verified. Only the displayed unreferenced originals will be deleted.`
        : 'Inspect references to preview original-image cleanup.',
  );
  text(
    'images',
    ready
      ? `${inspection.objects.files} files · ${byteSize(inspection.objects.bytes)}`
      : 'Not inspected',
  );
  text(
    'image-cache',
    ready
      ? `${inspection.requestCache.files} files · ${byteSize(inspection.requestCache.bytes)}`
      : 'Not inspected',
  );
  text(
    'image-status',
    report?.images?.available === false
      ? 'This image provider does not expose cache maintenance.'
      : inspection?.state === 'busy'
        ? 'Image operations are in progress. Refresh after they finish.'
        : ready
          ? 'Request images can be regenerated from the retained originals.'
          : 'Image usage has not been inspected.',
  );
  text(
    'status',
    busy
      ? 'Storage operation in progress.'
      : (report?.blockedBy ??
          (report?.result
            ? report.result.operation === 'request_cache_clear'
              ? `Cleared ${report.result.removedFiles} cached images · reclaimed ${byteSize(report.result.reclaimedBytes)}.`
              : report.result.operation === 'original_image_collection'
                ? `Deleted ${report.result.removedFiles} unreferenced originals · reclaimed ${byteSize(report.result.reclaimedBytes)}.`
                : report.result.operation === 'request_identity_archive'
                  ? `Preserved ${report.result.archivedRecords} request identities.`
                  : report.result.operation === 'domain_record_retirement'
                    ? `Deleted ${report.result.removedRecords} inspected records.`
                    : `Reclaimed ${byteSize(report.result.reclaimedBytes)}. All current records retained.`
            : statistics
              ? 'Compaction requires an idle workspace and ends retained task scopes.'
              : 'Open to inspect storage.')),
  );
  container.querySelector('#refresh-storage').disabled = busy;
  container.querySelector('#compact-storage').disabled =
    busy || !statistics || Boolean(report.blockedBy) || statistics.supersededBytes === 0;
  container.querySelector('#clear-image-cache').disabled =
    busy || !ready || Boolean(report.blockedBy) || inspection.requestCache.files === 0;
  container.querySelector('#inspect-originals').disabled =
    busy || !collection?.available || Boolean(report?.blockedBy);
  container.querySelector('#collect-originals').disabled =
    busy ||
    !collection?.available ||
    Boolean(report?.blockedBy) ||
    !preview ||
    preview.inspection.unreferencedObjects.files === 0;
}

export function bindStorageMaintenance(container, api, action) {
  let report;
  const update = async (operation) => {
    const collectionToken = report?.originalCollection?.preview?.token;
    const retirementToken = report?.recordRetirement?.preview?.token;
    const sessionIds = [...container.querySelectorAll('#retention-sessions input:checked')].map(
      (input) => input.value,
    );
    if (report)
      report = {
        ...report,
        result: undefined,
        originalCollection: { ...report.originalCollection, preview: undefined },
        recordRetirement: { ...report.recordRetirement, preview: undefined },
        selectedSessionIds: sessionIds,
      };
    renderStorageMaintenance(container, report, true);
    try {
      const response =
        operation === 'compact'
          ? await api('/api/storage/compact', { expectedSequence: report.statistics.sequence })
          : operation === 'clear-cache'
            ? await api('/api/storage/clear-request-cache', {
                expectedRevision: report.images.inspection.revision,
              })
            : operation === 'inspect-originals'
              ? await api('/api/storage/inspect-originals', {})
              : operation === 'collect-originals'
                ? await api('/api/storage/collect-originals', { token: collectionToken })
                : operation === 'archive-requests'
                  ? await api('/api/storage/archive-requests', {
                      sessionIds,
                      expectedSequence: report.statistics.sequence,
                    })
                  : operation === 'inspect-records'
                    ? await api('/api/storage/inspect-records', { sessionIds })
                    : operation === 'retire-records'
                      ? await api('/api/storage/retire-records', { token: retirementToken })
                      : await api('/api/storage');
      if (operation) report = { ...report, ...response };
      else
        report = {
          ...response,
          ...(await api('/api/storage/retention')),
          selectedSessionIds: sessionIds,
        };
    } finally {
      renderStorageMaintenance(container, report);
    }
  };
  container.ontoggle = () => {
    if (container.open) void action(() => update());
  };
  container.querySelector('#refresh-storage').onclick = () => action(() => update());
  container.querySelector('#compact-storage').onclick = () => action(() => update('compact'));
  container.querySelector('#clear-image-cache').onclick = () => action(() => update('clear-cache'));
  container.querySelector('#inspect-originals').onclick = () =>
    action(() => update('inspect-originals'));
  container.querySelector('#collect-originals').onclick = () =>
    action(() => update('collect-originals'));
  container.querySelector('#archive-requests').onclick = () =>
    action(() => update('archive-requests'));
  container.querySelector('#inspect-records').onclick = () =>
    action(() => update('inspect-records'));
  container.querySelector('#retire-records').onclick = () => action(() => update('retire-records'));
  container.querySelector('#retention-sessions').onchange = () => {
    report = {
      ...report,
      selectedSessionIds: [...container.querySelectorAll('#retention-sessions input:checked')].map(
        (input) => input.value,
      ),
      recordRetirement: { ...report.recordRetirement, preview: undefined },
    };
    renderStorageMaintenance(container, report);
  };
}
