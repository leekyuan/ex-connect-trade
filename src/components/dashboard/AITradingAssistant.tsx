import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, Loader2, X, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type Msg = { role: 'user' | 'assistant'; content: string };

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-chat`;
const SUGGESTIONS = [
  '지금 진입해도 될까?',
  '이 신호 신뢰해도 돼?',
  '레버리지 몇 배가 안전해?',
  'ICT/와이코프 관점은?',
];

interface Props {
  /** 시장 분석 컨텍스트 (현재 코인/신호/플랜) — 있으면 시스템 프롬프트에 주입 */
  context?: string;
  /** 헤더 부제목 */
  subtitle?: string;
  /** 작은 모드: 채팅창만 (대시보드용 floating 토글 비활성) */
  embedded?: boolean;
}

export function AITradingAssistant({ context, subtitle, embedded }: Props = {}) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let acc = '';

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken =
        sessionData?.session?.access_token ??
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

      const resp = await fetch(STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ messages: [...messages, userMsg], context }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 429) toast.error('요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
        else if (resp.status === 402) toast.error('AI 크레딧이 부족합니다.');
        else toast.error(err.error || 'AI 응답 실패');
        setLoading(false);
        return;
      }
      if (!resp.body) throw new Error('No stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;
      // create assistant placeholder
      setMessages(p => [...p, { role: 'assistant', content: '' }]);

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages(p => p.map((m, i) =>
                i === p.length - 1 && m.role === 'assistant' ? { ...m, content: acc } : m
              ));
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error(e);
        toast.error('AI 연결 실패');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  if (!open && !embedded) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:opacity-90"
      >
        <MessageSquare className="h-4 w-4" /> AI 코치
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col" style={{ minHeight: 480, maxHeight: 600 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/20 grid place-items-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">AI 트레이딩 코치</h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> {subtitle ?? 'Lovable AI · Gemini'}
            </p>
          </div>
        </div>
        {!embedded && (
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              매매·신호·이론·리스크 관리 등 무엇이든 물어보세요.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted transition-colors text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{m.content || '...'}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> 생각 중...
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-border p-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요..."
          className="flex-1 bg-muted/30 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
          disabled={loading}
        />
        <Button type="submit" size="sm" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
