import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

const SHORTCUTS: Array<[string, string]> = [
  ['?', '단축키 도움말 열기'],
  ['Ctrl/⌘ + K', '명령 팔레트 (페이지·코인 검색)'],
  ['D', '대시보드'],
  ['M', '마켓 스크리너'],
  ['A', '시장 분석'],
  ['B', '백테스트'],
  ['P', '포트폴리오'],
  ['N', '알림 센터'],
  ['Esc', '열린 모달 닫기'],
];

export function KeyboardShortcutsModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>키보드 단축키</DialogTitle>
          <DialogDescription>입력 필드에 포커스가 없을 때 동작합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 mt-2">
          {SHORTCUTS.map(([k, l]) => (
            <div key={k} className="flex items-center justify-between text-sm border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground">{l}</span>
              <kbd className="font-mono text-xs px-2 py-0.5 bg-muted rounded border border-border">{k}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
