const env = import.meta.env;
const API_BASE = env.VITE_API_BASE;

export class ApiClient {
  async health() {
    const token = await miro.board.getIdToken();

    const response = await fetch(`${API_BASE}/api/v1/health`, {
      method: "GET",
      mode: "cors",
      cache: "no-cache",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  }

  async summarizeText(text: string): Promise<string> {
    const token = await miro.board.getIdToken();

    const response = await fetch(`${API_BASE}/api/v1/summarize`, {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });

    const { data } = await response.json();

    return data;
  }
}
