import { LegalPage } from "./LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="개인정보처리방침"
      intro="서비스 이용 시 수집·처리되는 개인정보 항목과 목적을 안내합니다."
      sections={[
        { title: "1. 수집 항목", body: "이메일, 인증 토큰, 거래소 API Key/Secret(암호화 저장), 매매 로그, 디바이스/접속 정보." },
        { title: "2. 수집 목적", body: "서비스 제공, 신호 산출, 보안 모니터링, 분쟁 대응, 통계 분석." },
        { title: "3. 보관 기간", body: "회원 탈퇴 즉시 파기. 단, 법령상 보관 의무가 있는 경우 해당 기간 보관." },
        { title: "4. 제3자 제공", body: "법령에 따른 요청이 없는 한 제3자에게 제공하지 않습니다." },
        { title: "5. 이용자 권리", body: "언제든지 본인 정보의 열람·정정·삭제·처리정지를 요청할 수 있습니다." },
      ]}
    />
  );
}
