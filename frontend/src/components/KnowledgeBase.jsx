import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Trash2, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Database } from 'lucide-react';
import api from '../services/api';

export default function KnowledgeBase({ onKbChange }) {
    const [docs, setDocs] = useState([]);
    const [expanded, setExpanded] = useState(true);
    const [ingestType, setIngestType] = useState('simple_pdf');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const fileRef = useRef();

    const isFileMode = ['simple_pdf', 'ocr_pdf', 'txt', 'audio'].includes(ingestType);

    useEffect(() => {
        fetchDocs();
    }, []);

    const fetchDocs = async () => {
        try {
            const res = await api.get('/documents');
            setDocs(res.data);
        } catch { /* silent */ }
    };

    const handleUpload = async () => {
        setLoading(true);
        setStatus(null);
        setMessage('');
        try {
            const form = new FormData();
            if (isFileMode && file) {
                form.append('file', file);
                form.append('source_type', ingestType);
            } else if (!isFileMode && url.trim()) {
                form.append('url', url.trim());
                form.append('source_type', ingestType);
            } else {
                setStatus('error');
                setMessage(isFileMode ? 'Select a file first.' : 'Enter a URL.');
                setLoading(false);
                return;
            }
            const res = await api.post('/documents', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setStatus('success');
            setMessage(res.data.message);
            setFile(null);
            setUrl('');
            fetchDocs();
            onKbChange?.();
        } catch (err) {
            setStatus('error');
            setMessage(err.response?.data?.detail || 'Upload failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (docId) => {
        try {
            await api.delete(`/documents/${docId}`);
            setDocs((prev) => prev.filter((d) => d.id !== docId));
            onKbChange?.();
        } catch { /* silent */ }
    };

    const getAccept = () => {
        if (ingestType === 'audio') return '.mp3,.wav,.m4a,.ogg';
        if (ingestType === 'txt') return '.txt';
        return '.pdf';
    };

    return (
        <div className="border-b border-subtle">
            {/* Toggle header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-hover/50 transition-colors"
            >
                <div className="flex items-center gap-2 text-sm font-semibold text-txt">
                    <Database size={14} className="text-primary" />
                    Knowledge Base
                    {docs.length > 0 && (
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">
                            {docs.length}
                        </span>
                    )}
                </div>
                {expanded ? <ChevronUp size={14} className="text-txt-muted" /> : <ChevronDown size={14} className="text-txt-muted" />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Source type */}
                    <select
                        value={ingestType}
                        onChange={(e) => { setIngestType(e.target.value); setFile(null); setUrl(''); }}
                        className="w-full bg-surface border border-subtle rounded-lg px-2.5 py-1.5 text-xs text-txt focus:outline-none focus:border-primary transition-all"
                    >
                        <option value="simple_pdf">PDF</option>
                        <option value="ocr_pdf">OCR PDF</option>
                        <option value="txt">Text (.txt)</option>
                        <option value="audio">Audio</option>
                        <option value="youtube">YouTube</option>
                        <option value="website">Website</option>
                    </select>

                    {/* File / URL input */}
                    {isFileMode ? (
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="border border-dashed border-subtle rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-xs text-txt-sec"
                        >
                            {file ? (
                                <p className="text-txt font-medium truncate">{file.name}</p>
                            ) : (
                                <p>Click to select file</p>
                            )}
                            <input ref={fileRef} type="file" accept={getAccept()} className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                        </div>
                    ) : (
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder={ingestType === 'youtube' ? 'YouTube URL...' : 'Website URL...'}
                            className="w-full bg-surface border border-subtle rounded-lg px-3 py-2 text-xs text-txt placeholder:text-txt-muted focus:outline-none focus:border-primary transition-all"
                        />
                    )}

                    {/* Upload button */}
                    <button
                        onClick={handleUpload}
                        disabled={loading}
                        className="w-full py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                        {loading ? <><Loader2 size={12} className="animate-spin" /> Processing...</> : <><Upload size={12} /> Upload to KB</>}
                    </button>

                    {/* Status */}
                    {status && (
                        <div className={`flex items-center gap-2 p-2 rounded-lg text-[11px] ${status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {status === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            <span className="truncate">{message}</span>
                        </div>
                    )}

                    {/* Document list */}
                    {docs.length > 0 && (
                        <div className="space-y-1 pt-1">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-txt-muted">Documents</p>
                            {docs.map((doc) => (
                                <div key={doc.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-card-hover transition-colors">
                                    <FileText size={12} className="shrink-0 text-txt-muted" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-txt truncate">{doc.filename}</p>
                                        <p className="text-[10px] text-txt-muted">{doc.chunk_count} chunks</p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(doc.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error/20 text-txt-muted hover:text-error transition-all"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
