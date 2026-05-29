import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAnalytics } from '../api.js';
import AnalyticsTable from '../components/AnalyticsTable.jsx';
import styles from './Analytics.module.css';

function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [shortCode, setShortCode] = useState(searchParams.get('code') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-lookup if code arrives via query param (e.g. from Dashboard)
  useEffect(() => {
    const paramCode = searchParams.get('code');
    if (paramCode && paramCode !== shortCode) {
      setShortCode(paramCode);
    }
    if (paramCode) {
      runLookup(paramCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runLookup = async (code) => {
    const trimmed = (code || shortCode).trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await getAnalytics(trimmed);
      setData(result);
      setSearchParams({ code: trimmed }, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLookup = (e) => {
    e.preventDefault();
    runLookup(shortCode);
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.heading}>Analytics</h1>
        <p className={styles.subheading}>Look up click statistics for any short code.</p>
      </div>

      <form className={styles.lookupForm} onSubmit={handleLookup}>
        <div className={styles.inputRow}>
          <div className={styles.inputWrapper}>
            <span className={styles.prefix}>Code:</span>
            <input
              type="text"
              className={styles.codeInput}
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              placeholder="abc1234"
              disabled={isLoading}
            />
          </div>
          <button type="submit" className={styles.lookupBtn} disabled={isLoading || !shortCode.trim()}>
            {isLoading ? 'Loading...' : 'Look up'}
          </button>
        </div>
      </form>

      {error && (
        <div className={styles.errorBanner}>{error}</div>
      )}

      {data && <AnalyticsTable data={data} />}
    </div>
  );
}

export default Analytics;
