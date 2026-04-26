import { useState, useCallback, useRef } from 'react';
import { Cpu, Zap, Database } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import GraphViewer from '../components/GraphViewer';
import QueryPanel from '../components/QueryPanel';

// Node execution order for visual simulation
const EXEC_ORDER_CORRECT = ['retrieve', 'eval_each_doc', 'refine', 'generate'];
const EXEC_ORDER_WEB = ['retrieve', 'eval_each_doc', 'rewrite_query', 'web_search', 'refine', 'generate'];

export default function Dashboard() {
  const [activeChatId, setActiveChatId] = useState(null);
  const [hasKbDocs, setHasKbDocs] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState({});
  const timeoutsRef = useRef([]);

  const handleSelectChat = useCallback((chatId) => {
    setActiveChatId(chatId);
    setNodeStatuses({});
  }, []);

  const handleKbChange = useCallback(() => {
    setHasKbDocs(true);
  }, []);

  // Simulate node-by-node execution animation
  const simulateExecution = useCallback((execOrder) => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setNodeStatuses({});

    const delay = 600;
    execOrder.forEach((nodeId, i) => {
      const t1 = setTimeout(() => {
        setNodeStatuses((prev) => ({ ...prev, [nodeId]: 'running' }));
      }, i * delay);
      const t2 = setTimeout(() => {
        setNodeStatuses((prev) => ({ ...prev, [nodeId]: 'completed' }));
      }, (i + 1) * delay);
      timeoutsRef.current.push(t1, t2);
    });
  }, []);

  const handleQueryResult = useCallback(({ status, data }) => {
    if (status === 'running') {
      simulateExecution(EXEC_ORDER_CORRECT);
    }
    if (status === 'done' && data) {
      const path = data.verdict === 'CORRECT' ? EXEC_ORDER_CORRECT : EXEC_ORDER_WEB;
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      const final = {};
      path.forEach((id) => { final[id] = 'completed'; });
      setNodeStatuses(final);
    }
    if (status === 'error') {
      setNodeStatuses((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k] === 'running') next[k] = 'error';
        });
        return next;
      });
    }
  }, [simulateExecution]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar with KB + Chats */}
      <Sidebar activeChatId={activeChatId} onSelectChat={handleSelectChat} onKbChange={handleKbChange} />

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* ── Top bar ──────────────────────────────── */}
        <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-subtle bg-surface/60 backdrop-blur-md relative z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-8 h-8 rounded-lg shadow-md shadow-indigo-500/10 object-cover"
            />
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              CRAG Pipeline
            </h1>
            <span className="text-[10px] font-medium text-txt-muted bg-card px-2 py-0.5 rounded-full border border-subtle">
              v2.0
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-txt-muted">
            {activeChatId ? (
              <>
                <Zap size={12} className="text-emerald-400" />
                <span>Querying your Knowledge Base</span>
              </>
            ) : (
              <span>Upload docs to KB, then create a chat</span>
            )}
          </div>
        </header>

        {/* ── Content ───────────────────────────────── */}
        {!activeChatId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-card border border-subtle flex items-center justify-center mx-auto mb-4">
                <Database size={28} className="text-txt-muted" />
              </div>
              <h2 className="text-lg font-semibold text-txt mb-2">No chat selected</h2>
              <p className="text-sm text-txt-sec max-w-sm">
                Upload documents to your Knowledge Base in the sidebar, then create a chat to start asking questions.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT — Graph */}
            <main className="flex-1 bg-transparent relative z-10">
              <GraphViewer nodeStatuses={nodeStatuses} />
            </main>

            {/* RIGHT — Query */}
            <aside className="w-[420px] shrink-0 border-l border-subtle bg-surface/40 backdrop-blur-2xl overflow-hidden relative z-20 shadow-[-8px_0_32px_-12px_rgba(0,0,0,0.5)]">
              <QueryPanel onQueryResult={handleQueryResult} isIngested={true} chatId={activeChatId} />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
