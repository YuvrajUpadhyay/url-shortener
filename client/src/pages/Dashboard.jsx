import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUrls, deleteUrl } from '../api.js';
import styles from './Dashboard.module.css';

function Dashboard() {
  const [urlList, setUrlList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletingCode, setDeletingCode] = useState(null);
  const navigate = useNavigate();

  const fetchUrls = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUrls({ page, limit: 15 });
      setUrlList(data.urls);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUrls(1);
  }, [fetchUrls]);

  const handleDelete = async (shortCode) => {
    if (!window.confirm(`Deactivate "${shortCode}"? This cannot be undone.`)) return;
    setDeletingCode(shortCode);
    try {
      await deleteUrl(shortCode);
      setUrlList((prev) => prev.filter((u) => u.shortCode !== shortCode));
      setPagination((p) => ({ ...p, total: p.total - 1 }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingCode(null);
    }
  };

  const handleCopy = async (shortUrl) => {
    try {
      await navigator.clipboard.writeText(shortUrl);
    } catch {
      /* silent — no visual feedback on error here */
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Dashboard</h1>
          <p className={styles.subheading}>
            {pagination.total > 0 ? `${pagination.total} active links` : 'No active links yet'}
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={() => fetchUrls(pagination.page)} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {!isLoading && urlList.length === 0 && !error && (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No short URLs created yet.</p>
          <button className={styles.createBtn} onClick={() => navigate('/')}>
            Create your first link
          </button>
        </div>
      )}

      {urlList.length > 0 && (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Short Code</th>
                  <th>Original URL</th>
                  <th className={styles.centerCol}>Clicks</th>
                  <th className={styles.centerCol}>Created</th>
                  <th className={styles.centerCol}>Expires</th>
                  <th className={styles.centerCol}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {urlList.map((url) => {
                  const isExpired = url.expiresAt && new Date(url.expiresAt) < new Date();
                  return (
                    <tr key={url.shortCode} className={isExpired ? styles.expiredRow : ''}>
                      <td>
                        <div className={styles.codeCell}>
                          <code className={styles.code}>{url.shortCode}</code>
                          {url.customAlias && (
                            <span className={styles.aliasBadge}>alias</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <a
                          href={url.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.originalUrl}
                          title={url.originalUrl}
                        >
                          {url.originalUrl.length > 60
                            ? url.originalUrl.slice(0, 60) + '…'
                            : url.originalUrl}
                        </a>
                      </td>
                      <td className={styles.centerCol}>
                        <span className={styles.clicks}>{url.clicks.toLocaleString()}</span>
                      </td>
                      <td className={`${styles.centerCol} ${styles.monoSmall}`}>
                        {new Date(url.createdAt).toLocaleDateString()}
                      </td>
                      <td className={`${styles.centerCol} ${styles.monoSmall}`}>
                        {url.expiresAt ? (
                          <span className={isExpired ? styles.expiredLabel : styles.expiryLabel}>
                            {isExpired ? 'Expired' : new Date(url.expiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className={styles.permanent}>Permanent</span>
                        )}
                      </td>
                      <td className={styles.centerCol}>
                        <div className={styles.actions}>
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleCopy(url.shortUrl)}
                            title="Copy short URL"
                          >
                            Copy
                          </button>
                          <button
                            className={styles.actionBtn}
                            onClick={() => navigate(`/analytics?code=${url.shortCode}`)}
                            title="View analytics"
                          >
                            Stats
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            onClick={() => handleDelete(url.shortCode)}
                            disabled={deletingCode === url.shortCode}
                            title="Deactivate link"
                          >
                            {deletingCode === url.shortCode ? '...' : 'Del'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className={styles.paginationBar}>
              <button
                className={styles.pageBtn}
                onClick={() => fetchUrls(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                className={styles.pageBtn}
                onClick={() => fetchUrls(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
