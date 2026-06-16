import { LegalPage } from "./LegalPage";

export default function RefundPage() {
  return (
    <LegalPage
      title="환불 정책"
      intro="유료 구독에 관한 환불 기준을 안내합니다."
      sections={[
        { title: "1. 결제일로부터 7일 이내", body: "유료 기능을 한 번도 사용하지 않은 경우 전액 환불 가능합니다." },
        { title: "2. 부분 환불", body: "결제일로부터 7일 이후 또는 유료 기능 사용 이력이 있는 경우 잔여 일수에 대한 부분 환불을 검토합니다." },
        { title: "3. 환불 불가", body: "결제 후 30일 경과, 약관 위반으로 인한 정지, 가상자산 거래 손실은 환불 대상이 아닙니다." },
        { title: "4. 신청 방법", body: "고객센터로 결제 정보와 함께 환불 사유를 보내주세요. 영업일 기준 5일 이내 처리됩니다." },
      ]}
    />
  );
}
