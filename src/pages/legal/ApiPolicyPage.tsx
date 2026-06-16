import { LegalPage } from "./LegalPage";

export default function ApiPolicyPage() {
  return (
    <LegalPage
      title="API 보안 정책"
      intro="거래소 API 키는 이용자의 자산과 직결되므로 아래 정책을 반드시 준수합니다."
      sections={[
        { title: "1. 출금 권한 금지", body: "출금(Withdraw) 권한이 부여된 API 키는 시스템 상 차단되며, 이용자 또한 입력해서는 안 됩니다." },
        { title: "2. 거래 권한만 허용", body: "Read + Trade 권한만 부여된 키를 사용해야 합니다." },
        { title: "3. IP Whitelist 권장", body: "거래소가 지원할 경우 IP Whitelist를 반드시 설정하세요." },
        { title: "4. 저장 방식", body: "Secret은 서버 측 암호화 저장 후 화면에 다시 노출되지 않습니다." },
        { title: "5. 키 분실 시", body: "키 분실/탈취 의심 시 즉시 거래소에서 키를 폐기하고, 서비스 내에서도 삭제하세요." },
      ]}
    />
  );
}
