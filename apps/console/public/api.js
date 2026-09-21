export async function api(path, data, signal) {
  const response = await fetch(
    path,
    data === undefined
      ? { signal }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal,
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed: ${response.status}`);
  return result;
}
