import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [status, setStatus] = useState('확인 중...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('연결 실패'));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>MJUHack</h1>
        <p>백엔드 상태: {status}</p>
      </header>
    </div>
  );
}

export default App;
