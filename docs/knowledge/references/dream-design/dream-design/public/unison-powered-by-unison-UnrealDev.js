(() => {
  if (document.getElementById('unison-powered-by')) return;
  const link = document.createElement('a');
  link.id = 'unison-powered-by';
  link.href = 'https://unisontasks.com';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Powered by Unison';
  link.setAttribute('aria-label', 'Powered by Unison');
  link.style.cssText = 'display:block;padding:14px 16px;text-align:center;font:500 12px/1.4 system-ui,sans-serif;color:#64748b;background:#f8fafc;text-decoration:none;';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(link), { once: true });
})();
