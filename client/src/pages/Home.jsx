import { useState } from 'react';
import UrlForm from '../components/UrlForm.jsx';
import ShortUrlResult from '../components/ShortUrlResult.jsx';
import styles from './Home.module.css';

function Home() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.heading}>
          Shorten. Share. <span className={styles.accent}>Track.</span>
        </h1>
        <p className={styles.subheading}>
          Fast URL shortener with Redis caching, async analytics, and expiring links.
        </p>
      </div>

      <div className={styles.formCard}>
        <UrlForm
          onResult={setResult}
          onError={setError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <span className={styles.errorIcon}>!</span>
          {error}
        </div>
      )}

      {result && <ShortUrlResult result={result} />}
    </div>
  );
}

export default Home;
