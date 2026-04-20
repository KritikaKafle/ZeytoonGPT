import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Menu, ChevronDown, Bot, User as UserIcon, AlertCircle, Paperclip, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase, Conversation, Message, AITool, Attachment } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sendChatMessage, generateImage } from '../lib/chatApi';

type Props = {
  conversation: Conversation | null;
  tools: AITool[];
  onOpenSidebar: () => void;
  onConversationCreated: (conv: Conversation) => void;
  onConversationUpdated: (conv: Conversation) => void;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = 'image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx';

export default function ChatView({ conversation, tools, onOpenSidebar, onConversationCreated, onConversationUpdated }: Props) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string>('');
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imgSize, setImgSize] = useState<string>('1024x1024');
  const [imgQuality, setImgQuality] = useState<string>('standard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tools.length && !selectedToolId) setSelectedToolId(tools[0].id);
  }, [tools]);

  useEffect(() => {
    if (conversation) {
      setSelectedToolId(conversation.tool_id || tools[0]?.id || '');
      loadMessages(conversation.id);
    } else {
      setMessages([]);
    }
    setPendingAttachments([]);
    setError(null);
  }, [conversation?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at');
    setMessages((data || []).map(m => ({ ...m, attachments: m.attachments || [] })));
  };

  const selectedTool = tools.find(t => t.id === selectedToolId);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length || !profile) return;
    setError(null);
    setUploading(true);
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds 10MB limit.`);
        continue;
      }
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError(`Upload failed: ${upErr.message}`);
        continue;
      }
      const { data: pub } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      newAttachments.push({
        url: pub.publicUrl,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
      });
    }
    setPendingAttachments(prev => [...prev, ...newAttachments]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePending = (url: string) => {
    setPendingAttachments(prev => prev.filter(a => a.url !== url));
  };

  const handleSend = async () => {
    const userContent = input.trim();
    if ((!userContent && pendingAttachments.length === 0) || sending || !profile || !selectedToolId) return;
    const attachments = pendingAttachments;
    setInput('');
    setPendingAttachments([]);
    setError(null);
    setSending(true);

    let activeConv = conversation;
    if (!activeConv) {
      const title = (userContent || attachments[0]?.name || 'New Chat').slice(0, 50);
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ user_id: profile.id, title, tool_id: selectedToolId })
        .select()
        .maybeSingle();
      if (newConv) {
        activeConv = newConv;
        onConversationCreated(newConv);
      }
    }
    if (!activeConv) { setSending(false); return; }

    const { data: userMsg } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConv.id,
        role: 'user',
        content: userContent,
        attachments,
      })
      .select()
      .maybeSingle();
    if (userMsg) setMessages(prev => [...prev, { ...userMsg, attachments: userMsg.attachments || [] }]);

    const isImage = selectedTool?.model_kind === 'image';

    let assistantContent = '';
    let assistantAttachments: Attachment[] = [];
    let tokensUsed = 0;

    if (isImage) {
      const imgRes = await generateImage(selectedToolId, userContent, {
        size: imgSize,
        quality: imgQuality,
        output_format: 'png',
      });
      if (imgRes.error || !imgRes.attachment) {
        setError(imgRes.error || 'Image generation failed');
        setSending(false);
        return;
      }
      assistantContent = `Generated image for: "${userContent}"`;
      assistantAttachments = [imgRes.attachment];
      tokensUsed = imgRes.tokensUsed;
    } else {
      const history = [...messages, userMsg].filter(Boolean).map(m => ({
        role: m!.role,
        content: m!.content,
        attachments: (m!.attachments || []) as Attachment[],
      }));
      const result = await sendChatMessage(selectedToolId, history);
      if (result.error) {
        setError(result.error);
        setSending(false);
        return;
      }
      assistantContent = result.message;
      tokensUsed = result.tokensUsed;
    }

    const { data: aiMsg } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConv.id,
        role: 'assistant',
        content: assistantContent,
        tokens_used: tokensUsed,
        attachments: assistantAttachments,
      })
      .select()
      .maybeSingle();
    if (aiMsg) setMessages(prev => [...prev, { ...aiMsg, attachments: aiMsg.attachments || [] }]);

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', activeConv.id);
    onConversationUpdated({ ...activeConv, updated_at: new Date().toISOString() });

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 min-h-0">
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onOpenSidebar} className="md:hidden text-slate-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowToolPicker(!showToolPicker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition text-white"
            >
              <Bot className="w-4 h-4 text-emerald-400" />
              <span className="font-medium">{selectedTool?.display_name || 'Select Model'}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {showToolPicker && (
              <div className="absolute top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-10 overflow-hidden">
                {tools.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => { setSelectedToolId(tool.id); setShowToolPicker(false); }}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-700/60 transition ${
                      selectedToolId === tool.id ? 'bg-slate-700/40' : ''
                    }`}
                  >
                    <div className="text-white font-medium text-sm">{tool.display_name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{tool.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !sending ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
              <img src="/zeytoongpt.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">How can I help you today?</h1>
            <p className="text-slate-400 max-w-md">
              Ask anything, upload a photo or document, or get help from {selectedTool?.display_name || 'AI'}.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 max-w-2xl w-full">
              {[
                'Write a poem about the ocean',
                'Explain quantum computing simply',
                'Help me plan a weekly meal prep',
                'Draft a professional email',
              ].map(example => (
                <button
                  key={example}
                  onClick={() => setInput(example)}
                  className="text-left text-sm text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl px-4 py-3 transition"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {sending && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex-shrink-0 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 bg-slate-900 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="mb-3 flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {selectedTool?.model_kind === 'image' && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">Size</span>
              {['1024x1024', '1792x1024', '1024x1792'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setImgSize(s)}
                  className={`px-2.5 py-1 rounded-full border transition ${
                    imgSize === s
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {s}
                </button>
              ))}
              <span className="text-slate-400 ml-2">Quality</span>
              {['standard', 'hd'].map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setImgQuality(q)}
                  className={`px-2.5 py-1 rounded-full border transition ${
                    imgQuality === q
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition">
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pt-3">
                {pendingAttachments.map(att => (
                  <AttachmentChip key={att.url} attachment={att} onRemove={() => removePending(att.url)} />
                ))}
              </div>
            )}
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedTool?.model_kind === 'image'
                  ? `Describe the image you want ${selectedTool.display_name} to create...`
                  : `Message ${selectedTool?.display_name || 'AI'}...`
              }
              rows={1}
              className="w-full bg-transparent text-white placeholder-slate-500 resize-none px-4 py-3.5 pl-12 pr-14 focus:outline-none max-h-48"
              style={{ minHeight: '52px' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              title="Attach image or document"
              className="absolute left-2 bottom-2 w-9 h-9 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 disabled:opacity-40 transition flex items-center justify-center"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && pendingAttachments.length === 0) || sending || uploading}
              className="absolute right-2 bottom-2 w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-xs text-slate-500 text-center mt-2">
            AI may produce inaccurate information. Images are analyzed by vision-capable models; documents up to 10MB.
          </p>
        </div>
      </div>
    </div>
  );
}

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const isImage = attachment.type.startsWith('image/');
  return (
    <div className="relative group flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg pl-1 pr-2 py-1 max-w-xs">
      {isImage ? (
        <img src={attachment.url} alt={attachment.name} className="w-10 h-10 rounded object-cover" />
      ) : (
        <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-emerald-300" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs text-white truncate max-w-[140px]">{attachment.name}</div>
        <div className="text-[10px] text-slate-500">{(attachment.size / 1024).toFixed(0)} KB</div>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 text-slate-500 hover:text-red-400"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const { profile } = useAuth();
  const attachments = message.attachments || [];
  return (
    <div className="flex gap-4">
      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
        isUser ? 'bg-slate-700' : 'bg-gradient-to-br from-emerald-400 to-teal-600'
      }`}>
        {isUser ? (
          <UserIcon className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white mb-1">
          {isUser ? (profile?.full_name || 'You') : 'Assistant'}
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map(att => (
              att.type.startsWith('image/') ? (
                <a key={att.url} href={att.url} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={att.url}
                    alt={att.name}
                    className="max-h-56 rounded-xl border border-slate-700 object-cover"
                  />
                </a>
              ) : (
                <a
                  key={att.url}
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-lg px-3 py-2 text-sm"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <div className="min-w-0">
                    <div className="text-white truncate max-w-[220px]">{att.name}</div>
                    <div className="text-[10px] text-slate-500">{(att.size / 1024).toFixed(0)} KB</div>
                  </div>
                </a>
              )
            ))}
          </div>
        )}
        {message.content && (
          <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}

void ImageIcon;
