import { useState } from 'react';
import styles from './UrlForm.module.css';

function UrlForm({ onResult, onError, isLoading, setIsLoading }) {
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!originalUrl.trim()) return;

    setIsLoading(true);
    onError(null);

    try {
      const { shortenUrl } = await import('../api.js');
      const result = await shortenUrl({
        originalUrl: originalUrl.trim(),
        customAlias: customAlias.trim() || undefined,
        expiresInHours: expiresInHours ? parseFloat(expiresInHours) : undefined,
      });
      onResult(result);
      setOriginalUrl('');
      setCustomAlias('');
      setExpiresInHours('');
    } catch (err) {
      onError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.primaryRow}>
        <input
          type="text"
          className={styles.urlInput}
          value={originalUrl}
          onChange={(e) => setOriginalUrl(e.target.value)}
          placeholder="https://your-very-long-url.com/goes/here"
          disabled={isLoading}
          autoFocus
        />
        <button type="submit" className={styles.submitBtn} disabled={isLoading || !originalUrl.trim()}>
          {isLoading ? <span className={styles.spinner} /> : 'Shorten'}
        </button>
      </div>

      <button
        type="button"
        className={styles.advancedToggle}
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? '- Hide' : '+ Show'} options
      </button>

      {showAdvanced && (
        <div className={styles.advancedGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Custom alias</label>
            <div className={styles.aliasWrapper}>
              <span className={styles.aliasPrefixHint}>linksnip/</span>
              <input
                type="text"
                className={styles.input}
                value={customAlias}
                onChange={(e) => setCustomAlias(e.target.value)}
                placeholder="my-link"
                disabled={isLoading}
              />
            </div>
            <span className={styles.hint}>3–30 chars, letters/numbers/hyphens/underscores</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Expires in (hours)</label>
            <input
              type="number"
              className={styles.input}
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              placeholder="24"
              min="0.1"
              step="0.5"
              disabled={isLoading}
            />
            <span className={styles.hint}>Leave blank for a permanent link</span>
          </div>
        </div>
      )}
    </form>
  );
}

export default UrlForm;
