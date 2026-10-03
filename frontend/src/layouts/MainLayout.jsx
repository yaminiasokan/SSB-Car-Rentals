import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function MainLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return (
    <>
      <Navbar />
      <main className="page" key={pathname} style={{ minHeight: '60vh' }}><Outlet /></main>
      <Footer />
    </>
  );
}
