import { useEffect, useState } from 'react';
import { Bell, BellOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'cryptoedge-push-enabled';

export function PushNotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
    setEnabled(localStorage.getItem(STORAGE_KEY) === '1' && Notification.permission === 'granted');
  }, []);

  const requestAndEnable = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('이 브라우저는 알림을 지원하지 않습니다');
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p === 'granted') {
        localStorage.setItem(STORAGE_KEY, '1');
        setEnabled(true);
        new Notification('CryptoEdge 알림 활성화', {
          body: '신뢰도 임계값 도달 시 푸시 알림을 받습니다.',
          icon: '/favicon.ico',
        });
        toast.success('푸시 알림이 활성화되었습니다');
      } else {
        toast.error('알림 권한이 거부되었습니다');
      }
    } catch (e: any) {
      toast.error('알림 권한 요청 실패: ' + (e?.message ?? ''));
    }
  };

  const disable = () => {
    localStorage.setItem(STORAGE_KEY, '0');
    setEnabled(false);
    toast.success('푸시 알림이 비활성화되었습니다');
  };

  const test = () => {
    if (Notification.permission !== 'granted') {
      toast.error('먼저 알림 권한을 허용하세요');
      return;
    }
    new Notification('🔔 테스트 알림', {
      body: 'BTC 통합 신호 신뢰도 82% (LONG) 도달 — 진입 검토 권장',
      icon: '/favicon.ico',
    });
    toast.success('테스트 알림 전송됨');
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        {enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-base font-bold">브라우저 푸시 알림</h2>
      </div>

      <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">권한 상태</span>
          <span className="flex items-center gap-1 font-medium">
            {permission === 'granted' ? (
              <><Check className="h-3 w-3 text-emerald-500" /> 허용됨</>
            ) : permission === 'denied' ? (
              <><X className="h-3 w-3 text-red-500" /> 거부됨</>
            ) : permission === 'unsupported' ? (
              <span className="text-amber-500">지원 안됨</span>
            ) : (
              <span className="text-muted-foreground">미설정</span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">알림 발송</span>
          <span className={`font-medium ${enabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            {enabled ? '활성화됨' : '꺼짐'}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        시장 분석 페이지에서 통합 신호 신뢰도가 65% 이상 도달하면 브라우저 알림으로 즉시 통지합니다.
      </p>

      <div className="flex gap-2">
        {enabled ? (
          <button
            onClick={disable}
            className="flex-1 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80"
          >
            알림 비활성화
          </button>
        ) : (
          <button
            onClick={requestAndEnable}
            disabled={permission === 'unsupported' || permission === 'denied'}
            className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            푸시 알림 활성화
          </button>
        )}
        <button
          onClick={test}
          disabled={permission !== 'granted'}
          className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          테스트
        </button>
      </div>

      {permission === 'denied' && (
        <p className="text-[11px] text-red-400">
          브라우저 설정에서 이 사이트의 알림을 허용해주세요.
        </p>
      )}
    </div>
  );
}
