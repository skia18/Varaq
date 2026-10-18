import { ArrowLeft, Feather } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import landscape from '@/assets/auth-landscape.jpg';
import '@/styles/auth.css';

export function AuthLayout() {
  return (
    <main className="account-scene">
      <img className="account-landscape" src={landscape} alt="" fetchPriority="high" />
      <div className="account-scene-wash" />
      <Link to="/" className="account-back">
        <ArrowLeft size={16} />
        The commons
      </Link>
      <section className="account-box" aria-label="Your Varaq account">
        <Link to="/" className="brand account-brand" aria-label="Varaq home">
          <span className="brand-name">varaq</span>
          <span className="brand-urdu" lang="ur">
            ورق
          </span>
        </Link>
        <p className="account-tagline">Leave a page of yourself behind.</p>
        <div className="account-rule" aria-hidden="true">
          <span />
          <Feather />
          <span />
        </div>
        <Outlet />
      </section>
      <p className="account-scene-note">Somewhere quiet. Something yours.</p>
    </main>
  );
}
