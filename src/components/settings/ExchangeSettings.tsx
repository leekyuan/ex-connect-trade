/**
 * ExchangeSettings.tsx — 멀티거래소 API 연동 (localStorage 기반)
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ChevronDown, ChevronUp, Trash2, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

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

const storageKey = (id: string) => `cryptoedge_api_${id}`;

interface ExchangeConfig {
  apiKey?: string;
  secretKey?: string;
  passphrase?: string;
  connected?: boolean;
  balance?: string;
}

function loadConfig(id: string): ExchangeConfig {
  try { return JSON.parse(localStorage.getItem(storageKey(id)) || '{}'); }
  catch { return {}; }
}

function saveConfig(id: string, cfg: ExchangeConfig) {
  localStorage.setItem(storageKey(id), JSON.stringify(cfg));
}

function ExchangeCard({ exchange }: { exchange: ExchangeMeta }) {
  const saved = loadConfig(exchange.id);
  const [apiKey, setApiKey] = useState(saved.apiKey || '');
  const [secretKey, setSecretKey] = useState(saved.secretKey || '');
  const [passphrase, setPassphrase] = useState(saved.passphrase || '');
  const [showSecret, setShowSecret] = useState(false);
  const [connected, setConnected] = useState(!!saved.connected);
  const [balance, setBalance] = useState(saved.balance || '');
  const [expanded, setExpanded] = useState(false);
  const needsPassphrase = ['okx', 'bitget'].includes(exchange.id);

  const handleSave = () => {
    if (!apiKey || !secretKey) { toast.error('API Key와 Secret을 입력하세요'); return; }
    if (needsPassphrase && !passphrase) { toast.error('Passphrase가 필요합니다'); return; }
    saveConfig(exchange.id, { apiKey, secretKey, passphrase, connected, balance });
    toast.success(`${exchange.name} 설정 저장됨`);
  };

  const handleDelete = () => {
    localStorage.removeItem(storageKey(exchange.id));
    setApiKey(''); setSecretKey(''); setPassphrase(''); setConnected(false); setBalance('');
    toast(`${exchange.name} 설정 삭제됨`);
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
            {connected && balance ? `✓ 연결됨 · ${balance}` : apiKey ? '키 저장됨 · 미연결' : '미설정'}
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
            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={`${exchange.name} API Key`} className="font-mono text-sm" />
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
              <Input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="API 생성 시 설정한 Passphrase" className="font-mono text-sm" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} size="sm" className="flex-1">저장</Button>
            <Button onClick={handleDelete} variant="outline" size="sm">
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
          연결된 거래소로 잔고 조회, 자동 주문 실행, 포트폴리오 추적이 가능합니다.
          API 키는 이 브라우저에만 저장되며 외부로 전송되지 않습니다.
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
