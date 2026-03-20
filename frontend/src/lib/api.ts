const BASE = '/api'

export const api = {
  async analyse(code: string, language?: string, selectedAgents?: string[]) {
    const res = await fetch(`${BASE}/analyse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, selected_agents: selectedAgents }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<{ session_id: string; status: string }>
  },

  async cancelAnalysis(sessionId: string) {
    await fetch(`${BASE}/analyse/${sessionId}`, { method: 'DELETE' })
  },

  async listAgents() {
    const res = await fetch(`${BASE}/agents`)
    return res.json() as Promise<{ agents: import('../types').AgentConfig[] }>
  },

  async registerAgent(payload: {
    name: string
    phase: string
    model: string
    prompt_template: string
    description?: string
  }) {
    const res = await fetch(`${BASE}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async toggleAgent(name: string, enabled: boolean) {
    const res = await fetch(`${BASE}/agents/${name}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async deleteAgent(name: string) {
    const res = await fetch(`${BASE}/agents/${name}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async health() {
    const res = await fetch(`${BASE}/health`)
    return res.json()
  },
}
