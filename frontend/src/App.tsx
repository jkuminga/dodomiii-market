import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

function HomePage() {
  return (
    <main className="page">
      <h1>DODOMIII MARKET</h1>
      <p>뜨개/모루 꽃다발 및 뜨개 굿즈 쇼핑몰 MVP 베이스가 준비되었습니다.</p>
    </main>
  );
}

function NotFoundPage() {
  return <Navigate to="/" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
