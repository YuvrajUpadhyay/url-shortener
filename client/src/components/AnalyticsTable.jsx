import styles from './AnalyticsTable.module.css';

function AnalyticsTable({ data }) {
  if (!data) return null;

  const { shortCode, originalUrl, totalClicks, createdAt, expiresAt, recentClicks } = data;

  return (
    <div className={styles.container}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalClicks.toLocaleString()}</span>
          <span className={styles.statLabel}>Total Clicks</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{recentClicks.length}</span>
          <span className={styles.statLabel}>Shown (last 100)</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{shortCode}</span>
          <span className={styles.statLabel}>Short Code</span>
        </div>
      </div>

      <div className={styles.metaBlock}>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Original URL</span>
          <a href={originalUrl} target="_blank" rel="noopener noreferrer" className={styles.metaValue}>
            {originalUrl}
          </a>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>Created</span>
          <span className={styles.metaValue}>{new Date(createdAt).toLocaleString()}</span>
        </div>
        {expiresAt && (
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>Expires</span>
            <span className={`${styles.metaValue} ${styles.expiry}`}>
              {new Date(expiresAt).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {recentClicks.length === 0 ? (
        <div className={styles.empty}>No clicks recorded yet.</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Timestamp</th>
                <th>IP Address</th>
                <th>Referer</th>
              </tr>
            </thead>
            <tbody>
              {recentClicks.map((click, idx) => (
                <tr key={idx}>
                  <td className={styles.indexCell}>{idx + 1}</td>
                  <td className={styles.monoCell}>{new Date(click.timestamp).toLocaleString()}</td>
                  <td className={styles.monoCell}>{click.ip || '—'}</td>
                  <td className={styles.monoCell}>{click.referer || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AnalyticsTable;
