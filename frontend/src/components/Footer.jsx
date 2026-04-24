import { Link } from 'react-router-dom';

// 실제 운영 시 .env로 치환 (VITE_BIZ_* 주입하거나 빌드 시 치환)
const BIZ = {
  name: import.meta.env.VITE_BIZ_NAME || '스마트팜',
  ceo: import.meta.env.VITE_BIZ_CEO || '홍길동',
  brn: import.meta.env.VITE_BIZ_BRN || '000-00-00000',    // 사업자등록번호
  mob: import.meta.env.VITE_BIZ_MOB || '0000-00-00000',   // 통신판매업신고번호
  address: import.meta.env.VITE_BIZ_ADDRESS || '충청남도 논산시 ...',
  tel: import.meta.env.VITE_BIZ_TEL || '010-0000-0000',
  email: import.meta.env.VITE_BIZ_EMAIL || 'support@smartfarm.kr',
};

export default function Footer() {
  return (
    <footer style={{ padding: '24px 20px', borderTop: '1px solid #1f2630', fontSize: 12, color: '#6c7686', lineHeight: 1.7 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="flex" style={{ gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
          <Link to="/terms">이용약관</Link>
          <Link to="/privacy" style={{ fontWeight: 600, color: '#c8ced6' }}>개인정보처리방침</Link>
          <a href={`mailto:${BIZ.email}`}>고객지원</a>
        </div>
        <div>
          {BIZ.name} · 대표: {BIZ.ceo} · 사업자등록번호: {BIZ.brn} · 통신판매업신고: {BIZ.mob}<br/>
          주소: {BIZ.address} · 연락처: {BIZ.tel} · 이메일: {BIZ.email}<br/>
          © 2026 {BIZ.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
