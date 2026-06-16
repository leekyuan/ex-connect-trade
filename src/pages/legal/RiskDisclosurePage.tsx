import { LegalPage } from "./LegalPage";

export default function RiskDisclosurePage() {
  return (
    <LegalPage
      title="투자 유의사항"
      intro="암호화폐 선물 거래는 원금 전액 손실 위험을 동반합니다. 반드시 숙지 후 거래하세요."
      sections={[
        { title: "1. 원금 손실 위험", body: "레버리지 거래는 짧은 시간에 원금의 100%가 청산될 수 있습니다." },
        { title: "2. 신호의 한계", body: "본 서비스 신호는 과거 데이터 기반 통계적 추정이며, 미래 수익을 보장하지 않습니다." },
        { title: "3. 검증 기준", body: "전략 검증 탭의 7대 기준을 모두 통과한 신호만 실거래에 사용할 것을 권장합니다." },
        { title: "4. Paper Mode 권장", body: "실거래 전 최소 30회 이상 Paper Mode 검증을 권장합니다." },
        { title: "5. 자기책임 원칙", body: "모든 매매의 최종 의사결정과 결과는 전적으로 이용자 본인의 책임입니다." },
      ]}
    />
  );
}
