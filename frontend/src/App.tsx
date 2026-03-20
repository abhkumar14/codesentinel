import { useState, useCallback, useEffect, useRef } from 'react'
import { usePipeline } from './hooks/usePipeline'
import { AgentPanel } from './components/AgentPanel'
import { ReportViewer } from './components/ReportViewer'
import { AgentRegistry } from './components/AgentRegistry'
import { StreamLog } from './components/StreamLog'
import { ProjectUpload, ScanMode } from './components/ProjectUpload'
import {
  Shield, Play, Square, RotateCcw,
  Terminal, BarChart3, Settings, Activity,
  ChevronRight, Cpu, FolderOpen,
  WifiOff, RefreshCw, AlertTriangle, Server
} from 'lucide-react'

const DEMO_CODE = `import sqlite3
import hashlib
import os
import subprocess
from flask import Flask, request, jsonify

app = Flask(__name__)
SECRET_KEY = "hardcoded_secret_123"
DB_PATH = "/var/app/users.db"

def get_user(username):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor.execute(query)
    return cursor.fetchone()

def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = get_user(data['username'])
    if user and user[2] == hash_password(data['password']):
        return jsonify({"token": SECRET_KEY, "user": user[0]})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/exec', methods=['POST'])
def execute_command():
    cmd = request.form.get('cmd')
    result = subprocess.run(cmd, shell=True, capture_output=True)
    return result.stdout

@app.route('/file')
def read_file():
    filename = request.args.get('name')
    with open(f"/app/files/{filename}") as f:
        return f.read()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
`

type BackendStatus = 'checking' | 'online' | 'offline' | 'error'

async function checkBackend(): Promise<{ status: BackendStatus; detail?: string }> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(4000) })
    if (res.ok) return { status: 'online' }
    return { status: 'error', detail: `Server responded with ${res.status}` }
  } catch (e: any) {
    if (e?.name === 'AbortError') return { status: 'offline', detail: 'Request timed out' }
    return { status: 'offline', detail: e?.message ?? 'Cannot reach backend' }
  }
}

function BackendDownPage({ status, detail, onRetry, retrying }: {
  status: BackendStatus; detail?: string; onRetry: () => void; retrying: boolean
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 font-sans"
      style={{ background: '#0a0e1a', color: '#e2e8f0' }}>
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8"
        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
        {status === 'offline' ? <WifiOff size={36} className="text-red-400" /> : <Server size={36} className="text-orange-400" />}
      </div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-2 text-center">
        {status === 'offline' ? 'Backend is not running' : 'Backend returned an error'}
      </h1>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-8 leading-relaxed">
        CodeSentinel cannot reach the API server. Start the backend and try again.
      </p>
      {detail && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-2 mb-8 font-mono text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          <AlertTriangle size={12} />{detail}
        </div>
      )}
      <div className="rounded-xl p-5 mb-8 w-full max-w-md" style={{ background: '#0f1629', border: '1px solid #1e2d4a' }}>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">How to start the backend</p>
        <div className="space-y-4">
          <div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>Java</span>
            <pre className="mt-1.5 text-[11px] font-mono rounded-lg p-3 text-slate-300" style={{ background: '#0a0e1a' }}>{`cd codesentinel-java/backend\njava -jar target/codesentinel-backend-1.0.0.jar`}</pre>
          </div>
        </div>
      </div>
      <button onClick={onRetry} disabled={retrying}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
        <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
        {retrying ? 'Checking…' : 'Retry Connection'}
      </button>
      <p className="text-[11px] text-slate-700 mt-4">Auto-retrying every 10 seconds</p>
    </div>
  )
}

function CheckingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-sans" style={{ background: '#0a0e1a' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
        <Shield size={28} className="text-white" />
      </div>
      <p className="text-sm text-slate-500 font-mono">Connecting to backend…</p>
      <div className="flex gap-1.5 mt-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

type Tab = 'agents' | 'report' | 'registry' | 'log'
type InputMode = 'snippet' | 'project'

interface ProjectScanState {
  running: boolean
  error: string | null
  done: boolean
  info: {
    filename: string; totalFiles: number; skippedFiles: number
    scanUnits: number; mode: string; unitLabels: string[]
  } | null
  currentUnit: { label: string; index: number; total: number } | null
  completedUnits: string[]
}

const INITIAL_SCAN: ProjectScanState = {
  running: false, error: null, done: false,
  info: null, currentUnit: null, completedUnits: []
}

// How long (ms) with NO token/event before we consider it stalled.
// Set to 5 minutes — Ollama can be very slow on large files.
const STALL_TIMEOUT_MS = 5 * 60 * 1000

export default function App() {
  const { status, startAnalysis, connectProjectWs, cancel, reset } = usePipeline()

  const [code, setCode] = useState(DEMO_CODE)
  const [activeTab, setActiveTab] = useState<Tab>('agents')
  const [inputMode, setInputMode] = useState<InputMode>('snippet')
  const [snippetRunning, setSnippetRunning] = useState(false)

  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [backendDetail, setBackendDetail] = useState<string | undefined>()
  const [retrying, setRetrying] = useState(false)

  const [scan, setScan] = useState<ProjectScanState>(INITIAL_SCAN)
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track whether project_complete has fired so onclose doesn't false-alarm
  const projectDoneRef = useRef(false)

  const doHealthCheck = useCallback(async () => {
    const result = await checkBackend()
    setBackendStatus(result.status)
    setBackendDetail(result.detail)
    return result.status
  }, [])

  useEffect(() => {
    doHealthCheck()
    const iv = setInterval(() => { if (backendStatus !== 'online') doHealthCheck() }, 10_000)
    return () => clearInterval(iv)
  }, [backendStatus, doHealthCheck])

  const handleRetry = useCallback(async () => {
    setRetrying(true); await doHealthCheck(); setRetrying(false)
  }, [doHealthCheck])

  // ── Stall watchdog ────────────────────────────────────────────────────────
  // Only fires when NOTHING arrives for STALL_TIMEOUT_MS.
  // Each arriving token/event resets it, so long LLM responses never trip it.
  const clearStall = () => {
    if (stallTimer.current) { clearTimeout(stallTimer.current); stallTimer.current = null }
  }
  const resetStall = useCallback((onStall: () => void) => {
    clearStall()
    stallTimer.current = setTimeout(onStall, STALL_TIMEOUT_MS)
  }, [])

  const failScan = useCallback((message: string) => {
    clearStall()
    setScan(s => ({ ...s, running: false, error: message }))
    reset()
  }, [reset])

  const handleReset = () => {
    clearStall()
    projectDoneRef.current = false
    reset()
    setScan(INITIAL_SCAN)
    setSnippetRunning(false)
    setActiveTab('agents')
  }

  // ── Snippet ───────────────────────────────────────────────────────────────
  const handleSnippetSubmit = async () => {
    if (!code.trim() || snippetRunning) return
    setSnippetRunning(true)
    setActiveTab('agents')
    try { await startAnalysis(code) } catch (e) { console.error(e) }
    finally { setSnippetRunning(false) }
  }

  // ── Project upload ────────────────────────────────────────────────────────
  const handleProjectSubmit = async (file: File, mode: ScanMode) => {
    clearStall()
    projectDoneRef.current = false
    setScan({ ...INITIAL_SCAN, running: true })
    setActiveTab('agents')

    // Step 1: upload ZIP
    let sessionId: string
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', mode)

      const res = await fetch('/api/analyse-project', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        let detail = `Upload failed (${res.status})`
        try { const b = await res.json(); detail = b.error ?? b.message ?? detail } catch { }
        throw new Error(detail)
      }

      const body = await res.json()
      sessionId = body.session_id
      if (!sessionId) throw new Error('Backend did not return a session ID')

    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Upload timed out — check your network and try again'
        : (e?.message ?? 'Upload failed')
      failScan(msg)
      return
    }

    // Step 2: connect WS through pipeline hook (drives AgentPanel + StreamLog)
    const ws = connectProjectWs(sessionId)

    // Start stall watchdog — resets on each event, only fires if silent for 5 min
    const onStall = () =>
      failScan('No response from backend for 5 minutes — Ollama may have crashed. Check backend logs.')
    resetStall(onStall)

    // Step 3: wrap onmessage — pipeline hook handles agent events, we handle project events
    const pipelineHandler = ws.onmessage
    ws.onmessage = (ev) => {
      // Let usePipeline update agents/stream panels
      if (pipelineHandler) (pipelineHandler as EventListener)(ev)

      // Reset stall timer on every arriving message (including streaming tokens)
      resetStall(onStall)

      try {
        const event = JSON.parse(ev.data)

        switch (event.type) {
          case 'project_info':
            setScan(s => ({
              ...s, error: null,
              info: {
                filename: event.filename ?? file.name,
                totalFiles: event.total_files ?? 0,
                skippedFiles: event.skipped_files ?? 0,
                scanUnits: event.scan_units ?? 0,
                mode: event.mode ?? mode,
                unitLabels: event.unit_labels ?? [],
              },
            }))
            break

          case 'unit_start':
            setScan(s => ({
              ...s,
              currentUnit: {
                label: event.unit_label ?? event.agent ?? '',
                index: event.unit_index ?? 0,
                total: event.unit_total ?? 0,
              },
            }))
            break

          case 'unit_complete':
            setScan(s => ({
              ...s,
              completedUnits: [...s.completedUnits, event.unit_label ?? event.agent ?? ''],
              currentUnit: null,
            }))
            break

          case 'project_complete':
            // Mark done BEFORE clearing timer so onclose can check it
            projectDoneRef.current = true
            clearStall()
            setScan(s => ({ ...s, running: false, done: true, currentUnit: null, error: null }))
            ws.close()
            break

          case 'pipeline_status':
            if (event.status === 'error') {
              failScan(event.message ?? 'Analysis failed — check backend logs')
            }
            break
        }
      } catch { }
    }

    ws.onerror = () => {
      // Only report error if we haven't already successfully completed
      if (!projectDoneRef.current) {
        failScan('WebSocket connection lost — check backend is still running')
      }
    }

    ws.onclose = () => {
      clearStall()
      // Only show error if pipeline didn't finish cleanly
      if (!projectDoneRef.current) {
        setScan(s => {
          if (s.running && !s.error) {
            return { ...s, running: false, error: 'Connection closed unexpectedly. Check backend logs.' }
          }
          return s
        })
      }
    }
  }

  if (backendStatus === 'checking') return <CheckingPage />
  if (backendStatus === 'offline' || backendStatus === 'error') {
    return <BackendDownPage status={backendStatus} detail={backendDetail} onRetry={handleRetry} retrying={retrying} />
  }

  const agentCount = Object.keys(status.agents).length
  const doneCount = Object.values(status.agents).filter(a => a.status === 'complete').length
  const isActive = status.running || snippetRunning || scan.running

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'agents', label: 'Agents', icon: <Cpu size={13} />, badge: agentCount > 0 ? `${doneCount}/${agentCount}` : undefined },
    { id: 'report', label: 'Report', icon: <BarChart3 size={13} />, badge: status.finalReport ? '✓' : undefined },
    { id: 'log', label: 'Stream', icon: <Activity size={13} /> },
    { id: 'registry', label: 'Registry', icon: <Settings size={13} /> },
  ]

  return (
    <div className="min-h-screen font-sans" style={{ background: '#0a0e1a', color: '#e2e8f0' }}>

      <header className="flex items-center gap-4 px-6 py-3 border-b"
        style={{ borderColor: '#1e2d4a', background: '#0f1629' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-100 tracking-tight">CodeSentinel</span>
            <span className="text-[10px] text-slate-500 ml-2 font-mono">multi-agent AI review</span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <ChevronRight size={12} className="text-slate-700" />
          {status.language && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded"
              style={{ background: 'rgba(20,184,166,0.15)', color: '#5eead4' }}>
              {status.language}
            </span>
          )}
          {isActive && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {inputMode === 'project' ? 'scanning project…' : 'analysing'}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: '#22c55e' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            backend online
          </div>
          {(isActive || status.finalReport || scan.info || scan.error) && (
            <button onClick={handleReset}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200 transition-all">
              <RotateCcw size={12} /> Reset
            </button>
          )}
          {isActive ? (
            <button onClick={() => { cancel(); clearStall(); setScan(INITIAL_SCAN) }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium text-red-300"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Square size={12} /> Stop
            </button>
          ) : (
            inputMode === 'snippet' && (
              <button onClick={handleSnippetSubmit} disabled={snippetRunning || !code.trim()}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                <Play size={12} /> Analyse
              </button>
            )
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-53px)]">
        <div className="w-1/2 flex flex-col border-r" style={{ borderColor: '#1e2d4a' }}>
          <div className="flex items-center gap-1 px-4 py-2 border-b"
            style={{ borderColor: '#1e2d4a', background: '#0f1629' }}>
            {([
              { id: 'snippet' as InputMode, label: 'Code Snippet', icon: <Terminal size={12} /> },
              { id: 'project' as InputMode, label: 'Project ZIP', icon: <FolderOpen size={12} /> },
            ]).map(opt => (
              <button key={opt.id} onClick={() => setInputMode(opt.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  background: inputMode === opt.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: inputMode === opt.id ? '#93c5fd' : '#64748b',
                  border: inputMode === opt.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                }}>
                {opt.icon} {opt.label}
              </button>
            ))}
            {inputMode === 'snippet' && (
              <span className="ml-auto text-xs text-slate-600 font-mono">{code.split('\n').length} lines</span>
            )}
          </div>

          {inputMode === 'snippet' ? (
            <>
              <textarea
                className="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none"
                style={{ background: '#0a0e1a', color: '#e2e8f0', lineHeight: '1.7', caretColor: '#3b82f6' }}
                value={code} onChange={e => setCode(e.target.value)}
                placeholder="Paste your code here…" spellCheck={false}
              />
              {!isActive && !status.finalReport && (
                <div className="p-4 border-t" style={{ borderColor: '#1e2d4a' }}>
                  <button onClick={handleSnippetSubmit} disabled={snippetRunning || !code.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                    <Play size={14} /> Run Multi-Agent Analysis
                  </button>
                  <p className="text-center text-[10px] text-slate-600 mt-2">Meta-agent auto-selects relevant agents</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-5">
              <ProjectUpload
                onSubmit={handleProjectSubmit}
                isRunning={scan.running}
                projectInfo={scan.info}
                currentUnit={scan.currentUnit}
                completedUnits={scan.completedUnits}
                uploadError={scan.error}
              />
            </div>
          )}
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="flex items-center gap-1 px-4 py-2 border-b"
            style={{ borderColor: '#1e2d4a', background: '#0f1629' }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  background: activeTab === tab.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: activeTab === tab.id ? '#93c5fd' : '#64748b',
                  border: activeTab === tab.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                }}>
                {tab.icon} {tab.label}
                {tab.badge && (
                  <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-mono"
                    style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'agents' && <AgentPanel pipeline={status} />}
            {activeTab === 'report' && (
              status.finalReport
                ? <ReportViewer report={status.finalReport} />
                : <div className="flex flex-col items-center justify-center h-full text-center">
                  <BarChart3 size={40} className="text-slate-800 mb-4" />
                  <p className="text-sm text-slate-600">Report will appear here after analysis</p>
                  {isActive && <p className="text-xs text-slate-700 mt-2">{doneCount}/{agentCount} agents complete</p>}
                </div>
            )}
            {activeTab === 'log' && <StreamLog pipeline={status} />}
            {activeTab === 'registry' && <AgentRegistry />}
          </div>
        </div>
      </div>
    </div>
  )
}
