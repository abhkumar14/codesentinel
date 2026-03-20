import { useCallback, useEffect, useRef, useState } from 'react'
import { PipelineEvent, PipelineStatus, AgentPhase } from '../types'
import { api } from '../lib/api'

const INITIAL_STATUS = (): PipelineStatus => ({
  running: false,
  sessionId: null,
  language: null,
  selectedAgents: [],
  statusMessage: '',
  agents: {},
  finalReport: null,
  error: null,
})

export function usePipeline() {
  const [status, setStatus] = useState<PipelineStatus>(INITIAL_STATUS)
  const wsRef = useRef<WebSocket | null>(null)

  const reset = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      wsRef.current.onclose = null
      if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close()
      wsRef.current = null
    }
    setStatus(INITIAL_STATUS())
  }, [])

  // ── Core event handler — shared by both snippet and project WS ───────────
  const handleEvent = useCallback((event: PipelineEvent) => {
    setStatus(s => {
      switch (event.type) {

        case 'pipeline_status': {
          let lang = s.language
          if (event.status === 'language_detected') lang = event.message ?? null
          return {
            ...s,
            language: lang,
            statusMessage: `${event.status}${event.message ? ': ' + event.message : ''}`,
          }
        }

        case 'agent_start': {
          const name = event.agent!
          return {
            ...s,
            agents: {
              ...s.agents,
              [name]: {
                name,
                phase: (event.phase as AgentPhase) ?? 'parallel',
                status: 'running',
                output: '',
                startedAt: Date.now(),
              },
            },
          }
        }

        case 'agent_token': {
          const name = event.agent!
          const prev = s.agents[name]
          if (!prev) return s
          return {
            ...s,
            agents: {
              ...s.agents,
              [name]: { ...prev, output: prev.output + (event.token ?? '') },
            },
          }
        }

        case 'agent_complete': {
          const name = event.agent!
          const prev = s.agents[name]
          return {
            ...s,
            agents: {
              ...s.agents,
              [name]: {
                ...(prev ?? { name, phase: 'parallel' as AgentPhase, output: '' }),
                status: 'complete',
                result: event.result,
                output: event.result?.result ?? prev?.output ?? '',
                completedAt: Date.now(),
              },
            },
          }
        }

        case 'agent_error': {
          const name = event.agent!
          const prev = s.agents[name]
          return {
            ...s,
            agents: {
              ...s.agents,
              [name]: {
                ...(prev ?? { name, phase: 'parallel' as AgentPhase, output: '' }),
                status: 'error',
                output: event.error ?? 'Unknown error',
                completedAt: Date.now(),
              },
            },
          }
        }

        case 'pipeline_complete': {
          return {
            ...s,
            running: false,
            finalReport: event.report ?? null,
            statusMessage: 'Analysis complete',
          }
        }

        // Project scan unit events — just update status message
        case 'unit_start': {
          return {
            ...s,
            statusMessage: `Scanning: ${event.agent ?? ''}`,
          }
        }

        case 'unit_complete': {
          return {
            ...s,
            statusMessage: `Completed: ${event.agent ?? ''}`,
          }
        }

        case 'project_complete': {
          return {
            ...s,
            running: false,
            statusMessage: 'Project scan complete',
          }
        }

        default:
          return s
      }
    })
  }, [])

  // ── Snippet analysis ─────────────────────────────────────────────────────
  const startAnalysis = useCallback(async (code: string) => {
    reset()
    setStatus(s => ({ ...s, running: true, statusMessage: 'Starting pipeline…' }))

    const { session_id } = await api.analyse(code)
    setStatus(s => ({ ...s, sessionId: session_id }))

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${session_id}`)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      try { handleEvent(JSON.parse(ev.data)) } catch { }
    }
    ws.onerror = () => setStatus(s => ({ ...s, running: false, error: 'WebSocket error' }))

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 20_000)
    ws.onclose = () => {
      clearInterval(ping)
      setStatus(s => ({ ...s, running: s.finalReport ? false : s.running }))
    }
  }, [reset, handleEvent])

  // ── Project WS connection — called from App.tsx after upload ─────────────
  const connectProjectWs = useCallback((sessionId: string) => {
    // Reset agent/stream state but keep running=true
    setStatus(s => ({
      ...INITIAL_STATUS(),
      running: true,
      sessionId,
      statusMessage: 'Extracting project…',
    }))

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${sessionId}`)
    wsRef.current = ws

    ws.onopen = () => console.log('[usePipeline] WS connected for project', sessionId)

    ws.onmessage = (ev) => {
      try { handleEvent(JSON.parse(ev.data)) } catch (e) { console.error('[WS parse]', e) }
    }

    ws.onerror = () => {
      setStatus(s => ({ ...s, running: false, error: 'WebSocket error' }))
    }

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 20_000)

    ws.onclose = () => {
      clearInterval(ping)
      setStatus(s => ({
        ...s,
        running: false,
        statusMessage: s.error ? s.statusMessage : 'Connection closed',
      }))
    }

    return ws
  }, [handleEvent])

  const cancel = useCallback(async () => {
    if (status.sessionId) {
      try { await api.cancelAnalysis(status.sessionId) } catch { }
    }
    reset()
  }, [status.sessionId, reset])

  return { status, startAnalysis, connectProjectWs, cancel, reset }
}
