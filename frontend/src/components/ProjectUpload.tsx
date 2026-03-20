import { useState, useRef, useCallback } from 'react'
import {
  Upload, FolderOpen, Zap, Layers, FileSearch,
  X, CheckCircle, Loader2, AlertTriangle, RefreshCw
} from 'lucide-react'

export type ScanMode = 'smart' | 'aggregated' | 'per_file'

interface Props {
  onSubmit: (file: File, mode: ScanMode) => Promise<void>
  isRunning: boolean
  projectInfo?: {
    filename: string; totalFiles: number; skippedFiles: number
    scanUnits: number; mode: string; unitLabels: string[]
  } | null
  currentUnit?: { label: string; index: number; total: number } | null
  completedUnits?: string[]
  uploadError?: string | null
}

const MODES: { id: ScanMode; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { id: 'smart', label: 'Smart Scan', desc: 'High-risk files only — auth, DB, routes, config. Fastest.', icon: <Zap size={14} />, color: '#f59e0b' },
  { id: 'aggregated', label: 'Full Scan', desc: 'All files grouped by language. Thorough.', icon: <Layers size={14} />, color: '#3b82f6' },
  { id: 'per_file', label: 'Per-file Scan', desc: 'Every file scanned individually. Most detailed, slowest.', icon: <FileSearch size={14} />, color: '#8b5cf6' },
]

export function ProjectUpload({
  onSubmit, isRunning, projectInfo, currentUnit, completedUnits = [], uploadError
}: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [mode, setMode] = useState<ScanMode>('smart')
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.zip')) return
    setSelectedFile(f)
  }

  const openPicker = () => {
    if (inputRef.current) { inputRef.current.value = ''; inputRef.current.click() }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleSubmit = async () => {
    if (!selectedFile || submitting || isRunning) return
    setSubmitting(true)
    try { await onSubmit(selectedFile, mode) }
    finally { setSubmitting(false) }
  }

  const formatBytes = (n: number) =>
    n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'

  const hasError = !!uploadError
  const showForm = !isRunning && !projectInfo && !hasError
  const showError = hasError && !isRunning
  const showProgress = isRunning || (projectInfo && !hasError)

  return (
    <div className="space-y-4">

      {/* Hidden file input */}
      <input ref={inputRef} type="file" accept=".zip"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {showError && (
        <div className="space-y-4">
          {/* Error card */}
          <div className="rounded-xl p-5 space-y-3"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.15)' }}>
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-300 mb-1">Upload Failed</p>
                <p className="text-xs text-slate-400 leading-relaxed break-words">{uploadError}</p>
              </div>
            </div>

            {/* Hints based on error content */}
            <div className="rounded-lg px-3 py-2.5 space-y-1.5"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Suggestions</p>
              {uploadError?.toLowerCase().includes('zip') && (
                <p className="text-xs text-slate-400">
                  • Create the ZIP using the terminal instead of macOS Archive Utility:
                  <br />
                  <code className="text-[10px] font-mono text-slate-300 mt-1 block pl-2">
                    zip -r project.zip . -x "*.git*" -x "node_modules/*"
                  </code>
                </p>
              )}
              {uploadError?.toLowerCase().includes('timeout') && (
                <p className="text-xs text-slate-400">• Check your network connection and that the backend is still running</p>
              )}
              {uploadError?.toLowerCase().includes('websocket') && (
                <p className="text-xs text-slate-400">• The backend may have crashed — check the terminal running the server</p>
              )}
              {uploadError?.toLowerCase().includes('60 seconds') && (
                <p className="text-xs text-slate-400">• Ollama may be slow to respond — try a smaller file or switch to Smart Scan mode</p>
              )}
              <p className="text-xs text-slate-400">• Check backend terminal logs for the full error details</p>
            </div>
          </div>

          {/* Retry button */}
          <button
            onClick={openPicker}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      )}

      {/* ── Upload form ──────────────────────────────────────────────────── */}
      {showForm && (
        <>
          {/* Drop zone */}
          <div
            role="button" tabIndex={0}
            className="rounded-xl border-2 border-dashed transition-all cursor-pointer"
            style={{
              borderColor: dragging ? '#3b82f6' : selectedFile ? '#22c55e' : '#1e2d4a',
              background: dragging ? 'rgba(59,130,246,0.06)' : 'transparent',
            }}
            onClick={openPicker}
            onKeyDown={e => e.key === 'Enter' && openPicker()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="flex flex-col items-center justify-center py-10 gap-3 pointer-events-none">
              {selectedFile ? (
                <>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(34,197,94,0.15)' }}>
                    <CheckCircle size={24} className="text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-200">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatBytes(selectedFile.size)}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(59,130,246,0.12)' }}>
                    <Upload size={22} className="text-blue-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-300">Drop your project <span className="text-blue-400">.zip</span> here</p>
                    <p className="text-xs text-slate-600 mt-1">or click to browse — up to 50 MB</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {selectedFile && (
            <button className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors py-1"
              onClick={() => setSelectedFile(null)}>
              <X size={12} /> Remove file
            </button>
          )}

          {/* Tip: use terminal zip on macOS */}
          <div className="rounded-lg px-3 py-2"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <p className="text-[11px] text-amber-500/80">
              <span className="font-semibold">macOS tip:</span> Use terminal <code className="font-mono">zip</code> instead of Archive Utility to avoid format issues:
            </p>
            <pre className="text-[10px] font-mono text-slate-400 mt-1">
              zip -r project.zip . -x "*.git*" -x "node_modules/*"
            </pre>
          </div>

          {/* Scan mode */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Scan Mode</p>
            <div className="space-y-2">
              {MODES.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                  style={{
                    background: mode === m.id ? m.color + '18' : '#0f1629',
                    border: `1px solid ${mode === m.id ? m.color + '55' : '#1e2d4a'}`,
                  }}>
                  <span style={{ color: m.color }} className="flex-shrink-0">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{m.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                  </div>
                  <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all"
                    style={{ borderColor: mode === m.id ? m.color : '#334155', background: mode === m.id ? m.color : 'transparent' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={!selectedFile || submitting || isRunning}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
              : <><FolderOpen size={14} /> Scan Project</>}
          </button>

          <p className="text-center text-[10px] text-slate-600">
            Python · Java · JS/TS · Go · Rust · Ruby · PHP · C/C++ · Kotlin · Swift
          </p>
        </>
      )}

      {/* ── Progress state ───────────────────────────────────────────────── */}
      {showProgress && (
        <div className="space-y-4">
          {/* Spinner before project_info arrives */}
          {isRunning && !projectInfo && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={36} className="text-blue-400 animate-spin" />
              <p className="text-sm text-slate-400">Uploading and extracting project…</p>
              <p className="text-xs text-slate-600">This may take a moment for large projects</p>
            </div>
          )}

          {/* Project info + unit progress */}
          {projectInfo && (
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: '#0f1629', border: '1px solid #1e2d4a' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <FolderOpen size={16} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{projectInfo.filename}</p>
                  <p className="text-xs text-slate-500">
                    {projectInfo.totalFiles} files · {projectInfo.skippedFiles} skipped · {projectInfo.scanUnits} units
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                  {projectInfo.mode}
                </span>
              </div>

              {/* Progress bar */}
              {projectInfo.scanUnits > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-slate-600">
                      {completedUnits.length} / {projectInfo.scanUnits} units complete
                    </span>
                    {isRunning && <Loader2 size={10} className="text-blue-400 animate-spin" />}
                    {!isRunning && <CheckCircle size={10} className="text-green-400" />}
                  </div>
                  <div className="w-full rounded-full overflow-hidden" style={{ height: '3px', background: '#1e2d4a' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(completedUnits.length / projectInfo.scanUnits) * 100}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                      }} />
                  </div>
                </div>
              )}

              {/* Unit list */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {projectInfo.unitLabels.map((label, i) => {
                  const isDone = completedUnits.includes(label)
                  const isActive = currentUnit?.label === label
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
                        style={{ background: isDone ? '#22c55e' : isActive ? '#3b82f6' : '#1e2d4a' }} />
                      <span className="text-[11px] font-mono truncate flex-1"
                        style={{ color: isDone ? '#4ade80' : isActive ? '#93c5fd' : '#475569' }}>
                        {label}
                      </span>
                      {isActive && <Loader2 size={10} className="ml-auto flex-shrink-0 text-blue-400 animate-spin" />}
                      {isDone && <CheckCircle size={10} className="ml-auto flex-shrink-0 text-green-500" />}
                    </div>
                  )
                })}
              </div>

              {/* Done message */}
              {!isRunning && completedUnits.length === projectInfo.scanUnits && (
                <div className="flex items-center gap-2 text-xs text-green-400 pt-1 border-t border-slate-800">
                  <CheckCircle size={13} /> All units scanned successfully
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
