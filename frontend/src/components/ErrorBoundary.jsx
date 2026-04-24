import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', err, info);
    // Sentry 클라이언트 SDK 연동 시 여기서 보고
  }
  reset = () => this.setState({ err: null });
  render() {
    if (this.state.err) {
      return (
        <div style={{ maxWidth: 520, margin: '80px auto', padding: 24, background: '#161c25', border: '1px solid #c24a4a', borderRadius: 12 }}>
          <h2 style={{ color: '#ff8f8f', marginTop: 0 }}>⚠ 화면 오류</h2>
          <p style={{ color: '#c8ced6' }}>예기치 않은 오류가 발생했습니다. 새로고침하거나 아래 "다시 시도" 버튼을 눌러주세요.</p>
          <pre style={{ background: '#0f141c', padding: 10, borderRadius: 6, fontSize: 12, color: '#8a96a5', overflowX: 'auto' }}>
            {String(this.state.err?.message || this.state.err)}
          </pre>
          <div style={{ marginTop: 14 }}>
            <button onClick={this.reset}>다시 시도</button>
            <button className="ghost" onClick={() => { location.href = '/'; }} style={{ marginLeft: 8 }}>홈으로</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
