'use strict';

// OWNZ FORGE — OFFLINE GODOT DIAGNOSTICS V1
// Heuristic checks only. Not a replacement for Godot.


function stripInlineComment(line) {
  let quote = null;
  let triple = false;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (quote) {
      if (triple) {
        if (line.slice(i, i + 3) === quote.repeat(3)) {
          quote = null;
          triple = false;
          i += 2;
        }
      } else if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '#') return line.slice(0, i);

    if (ch === '"' || ch === "'") {
      quote = ch;
      triple = line.slice(i, i + 3) === ch.repeat(3);
      if (triple) i += 2;
    }
  }

  return line;
}

function analyzeScript(source) {
  if (typeof source !== 'string') {
    throw new TypeError('Source must be a string');
  }

  const warnings = [];
  const lines = source.split(/\r?\n/);
  const stack = [];
  const functions = new Map();
  const classStack = [];
  let currentClass = "";
  let classIndent = -1;
  const pairs = { ')': '(', ']': '[', '}': '{' };

  let quote = null;
  let triple = false;
  let escaped = false;

  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    if (trimmed && !quote && currentClass && indent <= classIndent) currentClass = "";
    if (trimmed && !trimmed.startsWith("#") && !quote) while (classStack.length && indent <= classStack[classStack.length-1].indent) classStack.pop();
    const classMatch = /^class +([A-Za-z_][A-Za-z0-9_]*) *:/.exec(trimmed);
    if (classMatch && !quote) { currentClass = classMatch[1]; classIndent = indent; }
    if (classMatch && !quote) classStack.push({name:classMatch[1],indent});
    const fn = /^(?:static +)?func +([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
    if (fn) fn[1] = (classStack.map(c=>c.name).join("::") || "global") + "::" + fn[1];
    if (fn && !quote) { if (functions.has(fn[1])) warnings.push({line:row+1,rule:"duplicate-function",message:"Duplicate function: "+fn[1]}); else functions.set(fn[1],row+1); }

    const codePart = stripInlineComment(line).trim();

    if (!quote && /^(func|if|elif|else|for|while|match|class)\b/.test(codePart) &&
        !codePart.endsWith(':') &&
        !codePart.endsWith('(') &&
        !codePart.endsWith(',')) {
      warnings.push({
        line: row + 1,
        rule: 'possible-missing-colon',
        message: 'Check whether this declaration needs a colon.'
      });
    }

    for (let col = 0; col < line.length; col++) {
      const ch = line[col];

      if (quote) {
        if (triple) {
          if (line.slice(col, col + 3) === quote.repeat(3)) {
            quote = null;
            triple = false;
            col += 2;
          }
        } else if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === quote) {
          quote = null;
        }
        continue;
      }

      if (ch === '#') break;

      if (ch === '"' || ch === "'") {
        quote = ch;
        triple = line.slice(col, col + 3) === ch.repeat(3);
        if (triple) col += 2;
        continue;
      }

      if ('([{'.includes(ch)) {
        stack.push({ ch, line: row + 1 });
      } else if (')]}'.includes(ch)) {
        const previous = stack[stack.length - 1];

        if (previous && previous.ch === pairs[ch]) {
          stack.pop();
        } else {
          warnings.push({
            line: row + 1,
            rule: 'unmatched-bracket',
            message: 'Unexpected closing bracket: ' + ch
          });
        }
      }
    }

    if (quote && !triple) {
      warnings.push({
        line: row + 1,
        rule: 'unclosed-string',
        message: 'String is not closed before the end of the line.'
      });
      quote = null;
      escaped = false;
    }
  }

  for (const item of stack) {
    warnings.push({
      line: item.line,
      rule: 'unclosed-bracket',
      message: 'Opening bracket has no matching close: ' + item.ch
    });
  }

  return {
    lineCount: lines.length,
    functions: Array.from(functions, ([name, line]) => ({ name, line })),
    warningCount: warnings.length,
    warnings
  };
}

module.exports = { analyzeScript };
