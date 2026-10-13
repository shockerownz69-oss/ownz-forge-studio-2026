export function renderFunctionList(container, functions, query, onJump) {
  if (!container) return;
  container.replaceChildren();
  const matches = functions.filter(item =>
    item.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  if (!matches.length) {
    container.textContent = functions.length
      ? 'No matching functions.'
      : 'No functions detected.';
    return;
  }
  for (const item of matches) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${item.name} — Line ${item.line}`;
    button.style.cssText = 'display:block;width:100%;text-align:left;padding:12px;margin:5px 0;min-height:44px;background:#301515;color:white;border:1px solid #a43b3b;border-radius:6px;overflow-wrap:anywhere';
    button.addEventListener('click', () => onJump(item.line));
    container.appendChild(button);
  }
}
