import { Link } from 'react-router-dom';

export function CollectionsPage() {
  return (
    <div className="page-content">
      <header className="page-intro">
        <div>
          <h1>Collections</h1>
          <p>A place for gathered pages.</p>
        </div>
      </header>
      <section className="empty-page">
        <h2>No collections yet.</h2>
        <Link to="/" className="literary-button">
          Browse the commons
        </Link>
      </section>
    </div>
  );
}
