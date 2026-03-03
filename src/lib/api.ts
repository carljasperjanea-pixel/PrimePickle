export async function apiRequest(endpoint: string, method: string = 'GET', body?: any) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`/api${endpoint}`, options);
  
  if (response.status === 401) {
    // Handle unauthorized (redirect to login if needed)
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'API request failed');
  }

  return response.json();
}

export const useUser = async () => {
  try {
    const data = await apiRequest('/user');
    return data.user;
  } catch (e) {
    return null;
  }
};
