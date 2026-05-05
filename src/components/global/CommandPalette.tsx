import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { LayoutDashboard, LineChart, FlaskConical, PieChart, Bell, Settings, TrendingUp } from 'lucide-react';
import { useCoinMarketCap } from '@/hooks/useCoinMarketCap';

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

const PAGES = [
  { label: '대시보드', to: '/dashboard', icon: LayoutDashboard, key: 'D' },
  { label: '마켓 스크리너', to: '/market-screener', icon: TrendingUp, key: 'M' },
  { label: '시장 분석', to: '/market-analysis', icon: LineChart, key: 'A' },
  { label: '백테스트', to: '/backtest', icon: FlaskConical, key: 'B' },
  { label: '포트폴리오', to: '/portfolio', icon: PieChart, key: 'P' },
  { label: '알림 센터', to: '/alerts', icon: Bell, key: 'N' },
  { label: '설정', to: '/settings', icon: Settings, key: ',' },
];

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { coins } = useCoinMarketCap(60_000);

  const go = (path: string) => { onOpenChange(false); navigate(path); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="페이지 또는 코인 검색 (BTC, Ethereum...)" />
      <CommandList>
        <CommandEmpty>결과가 없습니다.</CommandEmpty>
        <CommandGroup heading="페이지">
          {PAGES.map(p => (
            <CommandItem key={p.to} value={p.label} onSelect={() => go(p.to)}>
              <p.icon className="h-4 w-4 mr-2" /> {p.label}
              <kbd className="ml-auto text-[10px] text-muted-foreground border border-border rounded px-1">{p.key}</kbd>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="코인 → 시장 분석">
          {coins.slice(0, 30).map(c => (
            <CommandItem
              key={c.id}
              value={`${c.symbol} ${c.name}`}
              onSelect={() => go(`/market-analysis?symbol=${c.symbol}`)}
            >
              <span className="font-mono w-12 text-foreground">{c.symbol}</span>
              <span className="text-muted-foreground">{c.name}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">${c.price >= 1 ? c.price.toFixed(2) : c.price.toFixed(4)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}
