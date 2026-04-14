export async function apiFetch(path, options = {}) {
  const { token = '', headers = {}, ...fetchOptions } = options;
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // Ignore JSON parsing failures and use the default message.
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const formatApiDate = (value) => {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
};
