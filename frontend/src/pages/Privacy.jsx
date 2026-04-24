import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: 24 }}>
      <h1>개인정보처리방침</h1>
      <p style={{ color: '#8a96a5' }}>시행일: 2026-04-24 · v1</p>

      <h2>1. 수집하는 개인정보 항목</h2>
      <ul>
        <li>필수: 이메일, 이름, 비밀번호(암호화 저장)</li>
        <li>자동 수집: 접속 IP, 브라우저 정보, 서비스 이용 기록(감사 로그)</li>
        <li>선택: 마케팅 수신 동의 여부</li>
        <li>결제 이용 시: 토스페이먼츠가 처리하며, 본 서비스는 카드번호 뒤 4자리와 카드사명만 저장</li>
      </ul>

      <h2>2. 이용 목적</h2>
      <ul>
        <li>회원 식별 및 서비스 제공</li>
        <li>하우스 이상 상황 알림 발송 (이메일·푸시·카카오)</li>
        <li>결제 및 정기 구독 관리</li>
        <li>법적 분쟁 대응, 악용 방지</li>
      </ul>

      <h2>3. 보유 및 이용 기간</h2>
      <ul>
        <li>회원 탈퇴 시 즉시 파기 (단, 관계 법령에 따라 보관해야 하는 정보는 해당 기간 보관)</li>
        <li>전자상거래법: 계약·결제 기록 5년, 소비자 불만 3년</li>
        <li>통신비밀보호법: 로그인 기록 3개월</li>
      </ul>

      <h2>4. 제3자 제공</h2>
      <p>원칙적으로 제3자 제공하지 않으며, 아래 경우만 예외입니다:</p>
      <ul>
        <li>법령 근거 또는 수사기관 요청</li>
        <li>이용자가 사전 동의한 경우</li>
      </ul>

      <h2>5. 위탁 처리</h2>
      <table>
        <thead><tr><th>수탁자</th><th>위탁 업무</th></tr></thead>
        <tbody>
          <tr><td>토스페이먼츠</td><td>결제 처리</td></tr>
          <tr><td>Anthropic</td><td>병해 진단 AI (이미지 비지속 전송)</td></tr>
          <tr><td>기상청(KMA)</td><td>날씨 정보</td></tr>
          <tr><td>Solapi / 카카오</td><td>알림톡 발송 (선택 기능)</td></tr>
        </tbody>
      </table>

      <h2>6. 이용자 권리</h2>
      <ul>
        <li>개인정보 열람·수정·삭제 요청: 계정 설정 페이지 또는 운영자 문의</li>
        <li>개인정보 이동: 계정 설정에서 전체 데이터 JSON 내보내기 가능</li>
        <li>회원 탈퇴: 계정 설정 → 회원 탈퇴 (즉시 삭제)</li>
      </ul>

      <h2>7. 기술적·관리적 보호 조치</h2>
      <ul>
        <li>비밀번호: bcrypt 해싱 저장 (평문 미보관)</li>
        <li>전송 구간: HTTPS 암호화</li>
        <li>접근 통제: JWT 토큰 + Refresh Token 로테이션</li>
        <li>감사 로그: 가입·로그인·비번 변경·탈퇴 등 기록</li>
      </ul>

      <h2>8. 14세 미만 아동</h2>
      <p>본 서비스는 14세 이상만 가입할 수 있습니다.</p>

      <h2>9. 개인정보 보호책임자</h2>
      <p>문의: privacy@smartfarm.kr</p>

      <p style={{ marginTop: 40 }}><Link to="/register">← 돌아가기</Link></p>
    </div>
  );
}
