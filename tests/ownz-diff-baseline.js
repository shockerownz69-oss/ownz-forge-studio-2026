export function ownzBuildDiff(before, after) {
  // PHASE 13 — CLEAN LINE DIFF
  const splitLines = text => {
    if (text === '') return [];
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
  };

  const oldLines = splitLines(before);
  const newLines = splitLines(after);
  const n = oldLines.length;
  const m = newLines.length;

  // Prevent expensive comparisons on very large files.
  if (n * m > 250000) {
    return {
      tooLarge: true,
      added: 0,
      removed: 0,
      lines: []
    };
  }

  const dp = Array.from(
    { length: n + 1 },
    () => new Uint32Array(m + 1)
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;

  while (i < n || j < m) {
    if (i < n && j < m && oldLines[i] === newLines[j]) {
      lines.push({ type: 'same', text: oldLines[i] });
      i++;
      j++;
    } else if (
      j < m &&
      (i === n || dp[i][j + 1] > dp[i + 1][j])
    ) {
      lines.push({ type: 'add', text: newLines[j++] });
      added++;
    } else {
      lines.push({ type: 'remove', text: oldLines[i++] });
      removed++;
    }
  }

  return { tooLarge: false, added, removed, lines };
}

export function ownzRenderDiff(before, after, summary, container) {
  const diff = ownzBuildDiff(before, after);
  container.replaceChildren();

  if (diff.tooLarge) {
    summary.textContent =
      'File too large for line-by-line comparison. Review the full proposed code below.';
    return;
  }

  summary.textContent =
    '+' + diff.added + ' added · −' +
    diff.removed + ' removed';

  const fragment = document.createDocumentFragment();

  for (const line of diff.lines) {
    const element = document.createElement('div');

    element.textContent =
      (line.type === 'add' ? '+ ' :
       line.type === 'remove' ? '− ' : '  ') +
      line.text;

    element.style.cssText =
      'white-space:pre-wrap;overflow-wrap:anywhere;' +
      'padding:5px 7px;border-radius:4px;' +
      (line.type === 'add'
        ? 'background:#102b19;color:#8af0a6;'
        : line.type === 'remove'
          ? 'background:#351414;color:#ff9292;'
          : 'background:#181818;color:#aaa;');

    fragment.appendChild(element);
  }

  container.appendChild(fragment);
}
