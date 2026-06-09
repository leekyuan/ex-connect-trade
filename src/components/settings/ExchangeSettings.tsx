/**
 * ExchangeSettings.tsx — 멀티거래소 API 연동
 *
 * SECURITY: 모든 API 키/시크릿/패스프레이즈는 RLS 보호된
 * public.exchange_api_keys 테이블에만 저장됩니다. localStorage에는
 * 비밀이 저장되지 않습니다.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ChevronDown, ChevronUp, Trash2, AlertTriangle, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ExchangeMeta {
  id: string;
  name: string;
  emoji: string;
  note: string;
}

const EXCHANGES: ExchangeMeta[] = [
  { id: 'binance', name: 'Binance Futures', emoji: '🟡', note: '출금 권한 절대 부여 금지. Futures 거래 권한만 활성화, IP 화이트리스트 권장.' },
  { id: 'okx',     name: 'OKX',             emoji: '⬛', note: 'API 생성 시 Trade 권한만 선택. Passphrase 필수.' },
  { id: 'bybit',   name: 'Bybit',           emoji: '🟠', note: 'Unified Trading Account 사용 권장.' },
  { id: 'bitget',  name: 'Bitget',          emoji: '🔵', note: 'Passphrase 필수. 선물 전용 API 키 권장.' },
  { id: 'gate',    name: 'Gate.io',         emoji: '🟢', note: 'Futures Trading 권한만 활성화.' },
];

function ExchangeCard({ exchange }: { exchange: ExchangeMeta }) {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [connected, setConnected] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const needsPassphrase = ['okx', 'bitget'].includes(exchange.id);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from('exchange_api_keys')
        .select('id')
        .eq('exchange', exchange.id)
        .maybeSingle();
      if (alive) setConnected(!!data);
    })();
    return () => { alive = false; };
  }, [exchange.id]);

  const handleSave = async () => {
    if (!apiKey || !secretKey) { toast.error('API Key와 Secret을 입력하세요'); return; }
    if (needsPassphrase && !passphrase) { toast.error('Passphrase가 필요합니다'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('로그인이 필요합니다'); return; }
      const { error } = await (supabase as any)
        .from('exchange_api_keys')
        .upsert(
          {
            user_id: user.id,
            exchange: exchange.id,
            api_key: apiKey,
            api_secret: secretKey,
            passphrase: passphrase || null,
          },
          { onConflict: 'user_id,exchange' },
        );
      if (error) throw error;
      setConnected(true);
      setApiKey(''); setSecretKey(''); setPassphrase('');
      toast.success(`${exchange.name} 설정 저장됨 (서버측 암호 저장소)`);
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await (supabase as any)
        .from('exchange_api_keys')
        .delete()
        .eq('exchange', exchange.id);
      setApiKey(''); setSecretKey(''); setPassphrase(''); setConnected(false);
      toast(`${exchange.name} 설정 삭제됨`);
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.message ?? e}`);
    }
  };

  return (
    <Card className={connected ? 'border-emerald-500/40' : ''}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="text-xl">{exchange.emoji}</span>
        <div className="flex-1">
          <div className="text-sm font-medium">{exchange.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {connected ? '✓ 키 저장됨' : '미설정'}
          </div>
        </div>
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <CardContent className="space-y-3 border-t border-border pt-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>출금 권한 절대 부여 금지. {exchange.note}</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">API Key</Label>
            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={`${exchange.name} API Key`} className="font-mono text-sm" autoComplete="off" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Secret Key</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                placeholder="Secret Key"
                className="font-mono text-sm pr-10"
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowSecret(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {needsPassphrase && (
            <div className="space-y-1.5">
              <Label className="text-xs">Passphrase <span className="text-destructive">*필수</span></Label>
              <Input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="API 생성 시 설정한 Passphrase" className="font-mono text-sm" autoComplete="off" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} size="sm" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              저장
            </Button>
            <Button onClick={handleDelete} variant="outline" size="sm" disabled={!connected}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ExchangePrioritySettings() {
  const [priority, setPriority] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('exchange_priority');
      if (raw) return JSON.parse(raw);
    } catch {}
    return ['BINANCE', 'OKX', 'BYBIT', 'MEXC', 'BITGET'];
  });

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= priority.length) return;
    const next = [...priority];
    [next[idx], next[j]] = [next[j], next[idx]];
    setPriority(next);
  };

  const save = () => {
    localStorage.setItem('exchange_priority', JSON.stringify(priority));
    toast.success('차트 우선순위 저장됨');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">차트 조회 거래소 우선순위</CardTitle>
        <p className="text-xs text-muted-foreground">Binance 미상장 코인은 아래 순서로 자동 폴백하여 차트를 표시합니다.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {priority.map((ex, idx) => (
          <div key={ex} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="w-6 text-xs text-muted-foreground">{idx + 1}</span>
            <span className="flex-1 text-sm font-medium">{ex}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => move(idx, -1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === priority.length - 1} onClick={() => move(idx, 1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button onClick={save} className="w-full mt-2" size="sm">우선순위 저장</Button>
      </CardContent>
    </Card>
  );
}

export default function ExchangeSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">거래소 API 연동</CardTitle>
        <p className="text-xs text-muted-foreground">
          API 키는 RLS 보호된 서버측 저장소에만 보관됩니다. 로그인된 본인 이외 누구도 접근할 수 없습니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {EXCHANGES.map(ex => <ExchangeCard key={ex.id} exchange={ex} />)}
        <div className="pt-2">
          <ExchangePrioritySettings />
        </div>
      </CardContent>
    </Card>
  );
}
