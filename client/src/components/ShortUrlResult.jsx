import { useState } from 'react';
import styles from './ShortUrlResult.module.css';

function ShortUrlResult({ result }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = result.shortUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.label}>Short URL generated</span>
        {result.expiresAt && (
          <span className={styles.expiry}>
            Expires {new Date(result.expiresAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className={styles.resultRow}>
        <a
          href={result.shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.shortUrl}
        >
          {result.shortUrl}
        </a>
        <button className={`${styles.copyBtn} ${copied ? styles.copied : ''}`} onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className={styles.originalRow}>
        <span className={styles.originalLabel}>Original:</span>
        <span className={styles.originalUrl} title={result.originalUrl}>
          {result.originalUrl}
        </span>
      </div>

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          Code: <code className={styles.code}>{result.shortCode}</code>
        </span>
        <span className={styles.metaItem}>
          Created: {new Date(result.createdAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default ShortUrlResult;
