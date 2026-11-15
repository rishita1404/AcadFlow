import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals';

const VITALS_ENDPOINT = '/api/v1/metrics/web-vitals';

function sendToAnalytics(metric) {
  // Validate that no personal or PII data is transmitted
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: metric.rating,
    navigationType: metric.navigationType,
    page: window.location.pathname,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(VITALS_ENDPOINT, blob);
  } else {
    fetch(VITALS_ENDPOINT, {
      body,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // non-blocking
    });
  }
}

export function reportWebVitals() {
  try {
    onCLS(sendToAnalytics);
    onINP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
  } catch (err) {
    // Graceful fallback if unsupported in current environment
    console.debug('[web-vitals] reporting not supported', err);
  }
}
