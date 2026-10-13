import { ownerFetch } from './owner-session.js';
import {gdscriptAutocomplete} from './gdscript-autocomplete.js';
import {renderFunctionList} from './function-navigator.js';

import {EditorView,basicSetup} from 'codemirror'; import {Decoration,ViewPlugin} from '@codemirror/view';
import {openSearchPanel} from '@codemirror/search';
import {EditorState,StateEffect,StateField,Compartment} from '@codemirror/state';
import {javascript} from '@codemirror/lang-javascript';
import {oneDark} from '@codemirror/theme-one-dark';

const tree = document.getElementById('tree');
const status = document.getElementById('status');
const filename = document.getElementById('filename');
const tabsBar = document.getElementById('forge-tabs');
const saveButton = document.getElementById('save-file');
const saveIndicator = document.getElementById('save-indicator');
const goToLineButton = document.getElementById('ownz-go-to-line');
const wrapToggle = document.getElementById('ownz-wrap-toggle');


const OWNZ_DRAFT_STORAGE_V1 = 'ownz-forge-draft-v1:';

function draftKey(file) {
  return OWNZ_DRAFT_STORAGE_V1 + file;
}

function storeDraft(file, content, savedContent) {
  try {
    if (content === savedContent) {
      localStorage.removeItem(draftKey(file));
      return;
    }

    localStorage.setItem(draftKey(file), JSON.stringify({
      file,
      content,
      baseContent: savedContent,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Draft storage unavailable:', error);
    status.textContent = 'Warning: Unable to save drafts in browser storage (localStorage).';
  }
}

function clearDraft(file) {
  try {
    localStorage.removeItem(draftKey(file));
  } catch (error) {
    console.warn('Could not clear draft:', error);
  }
}

function archiveRejectedDraft(file, draft) {
  try {
    const key = 'ownz-forge-rejected-v1:' + file;
    const existing = localStorage.getItem(key);

    if (existing) {
      const previous = JSON.parse(existing);
      if (previous.content !== draft.content) {
        const historyKey = key + ':' + Date.now();
        localStorage.setItem(historyKey, existing);
      }
    }

    localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.warn('Could not archive rejected draft:', error);
    status.textContent = 'Warning: rejected draft archive unavailable';
  }
}

function recoverForgeDraft(file, diskContent) {
  try {
    const raw = localStorage.getItem(draftKey(file));
    if (!raw) return diskContent;

    const draft = JSON.parse(raw);
    if (!draft || draft.file !== file ||
        typeof draft.content !== 'string' ||
        typeof draft.baseContent !== 'string') {
      console.warn('Invalid draft found:', file);
      return diskContent;
    }

    if (draft.content === diskContent) {
      clearDraft(file);
      return diskContent;
    }

    const diskChanged = draft.baseContent !== diskContent;
    const message = diskChanged
      ? 'RECOVERY WARNING: The saved file has changed since this draft was created. Restore the older unsaved draft into the editor? The disk file will NOT be overwritten until you press SAVE.'
      : 'Unsaved changes were recovered for ' + file + '. Restore your draft?';

    if (window.confirm(message)) {
      return draft.content;
    }

    // Archive rejected work before returning to the saved file.
    archiveRejectedDraft(file, draft);
    return diskContent;
  } catch (error) {
    console.warn('Draft recovery unavailable:', error);
    return diskContent;
  }
}

function snapshotActiveDraft() {
  if (!activeFile) return;
  const tab = openTabs.get(activeFile);
  if (!tab) return;
  storeDraft(
    activeFile,
    ownzEditor.state.doc.toString(),
    tab.savedContent
  );
}

let ownzScheduleLiveDiagnostics = null;

const openTabs = new Map();
let activeFile = null;
let loadingFiles = new Set();
let switching = false;
let warningHighlightTimer = null;

const setWarningHighlight = StateEffect.define();
const warningLineMark = Decoration.line({class:"ownz-warning-line"});
const warningHighlightField = StateField.define({create:()=>Decoration.none,update:(marks,tr)=>{for(const e of tr.effects)if(e.is(setWarningHighlight))return e.value;return marks.map(tr.changes)},provide:f=>EditorView.decorations.from(f)});
const wrapCompartment = new Compartment();
let wrapEnabled = false;
try { wrapEnabled = localStorage.getItem("ownz-forge-wrap-lines") === "true"; } catch (error) { console.warn("Wrap preference unavailable:", error); }
const extensions = [
  basicSetup,
  gdscriptAutocomplete,
  warningHighlightField,
  wrapCompartment.of(wrapEnabled ? EditorView.lineWrapping : []),
  javascript(),
  oneDark,
  EditorView.theme({
    '&': {minHeight:'320px',fontSize:'14px'},
    '.cm-scroller': {overflow:'auto'},
    '.cm-line.ownz-warning-line': {backgroundColor:'rgba(255,45,45,.22)',boxShadow:'inset 3px 0 #ff3030'},
  }),
  EditorView.updateListener.of(update => {
    if (update.docChanged && activeFile && !switching) {
    ownzScheduleLiveDiagnostics?.();
      const tab = openTabs.get(activeFile);
      if (tab) {
        tab.state = update.state;
        storeDraft(activeFile, update.state.doc.toString(), tab.savedContent);
      }
      renderTabs();
      updateSaveIndicator();
    }
  })
];

function makeState(content) {
  return EditorState.create({doc:content,extensions});
}

const ownzEditor = new EditorView({
  state:makeState(''),
  parent:document.getElementById('editor')
});

if (wrapToggle) {
  const updateWrapButton = () => {
    wrapToggle.textContent = wrapEnabled ? "↩ WRAP ON" : "↩ WRAP OFF";
    wrapToggle.setAttribute("aria-pressed", String(wrapEnabled));
  };
  updateWrapButton();
  wrapToggle.addEventListener("click", () => {
    wrapEnabled = !wrapEnabled;
    ownzEditor.dispatch({effects: wrapCompartment.reconfigure(wrapEnabled ? EditorView.lineWrapping : [])});
    try { localStorage.setItem("ownz-forge-wrap-lines", String(wrapEnabled)); } catch (error) { console.warn("Wrap preference not saved:", error); }
    updateWrapButton();
  });
}

goToLineButton?.addEventListener("click", () => {
  if (!activeFile) return window.alert("Open a file first.");
  const answer = window.prompt("Go to line (1-" + ownzEditor.state.doc.lines + "):");
  if (answer === null) return;
  const value = answer.trim();
  if (!/^[0-9]+$/.test(value)) return window.alert("Enter a valid line number.");
  const line = Number(value);
  if (!Number.isSafeInteger(line) || line < 1 || line > ownzEditor.state.doc.lines) return window.alert("Line number is out of range.");
  const position = ownzEditor.state.doc.line(line).from;
  clearTimeout(warningHighlightTimer);
  ownzEditor.dispatch({selection:{anchor:position},scrollIntoView:true,effects:setWarningHighlight.of(Decoration.set([warningLineMark.range(position)]))});
  warningHighlightTimer = setTimeout(() => ownzEditor.dispatch({effects:setWarningHighlight.of(Decoration.none)}), 3000);
  ownzEditor.focus();
});

function dirtyTab(tab) {
  return tab.state.doc.toString() !== tab.savedContent;
}

function captureActiveState() {
  if (activeFile && openTabs.has(activeFile)) {
    openTabs.get(activeFile).state = ownzEditor.state;
  }
}

function updateSaveIndicator() {
  const tab = openTabs.get(activeFile);
  if (!tab) {
    saveIndicator.textContent = 'No file selected';
    saveIndicator.style.color = '#aaa';
    return;
  }
  const dirty = tab.state.doc.toString() !== tab.savedContent;
  saveIndicator.textContent = dirty ? '● Unsaved changes' : 'All changes saved';
  saveIndicator.style.color = dirty ? '#ffb454' : '#78df98';
}

function highlightTree() {
  document.querySelectorAll('.tree-item').forEach(button => {
    button.classList.toggle('active',button.dataset.path === activeFile);
  });
}

function activateTab(file) {
  if (!openTabs.has(file)) return;
  clearTimeout(warningHighlightTimer); warningHighlightTimer = null;
  ownzEditor.dispatch({effects:setWarningHighlight.of(Decoration.none)});
  captureActiveState();
  switching = true;
  activeFile = file;
  ownzEditor.setState(openTabs.get(file).state);
  switching = false;
  filename.textContent = file.split('/').pop();
  highlightTree();
  renderTabs();
  updateSaveIndicator();
  status.textContent = 'Opened: ' + file;
  ownzScheduleLiveDiagnostics?.();
}

function renderTabs() {
  if (!tabsBar) return;
  captureActiveState();
  tabsBar.replaceChildren();

  for (const [file,tab] of openTabs) {
    const wrapper = document.createElement('div');
    wrapper.className = 'forge-tab' + (file === activeFile ? ' active' : '');
    wrapper.setAttribute('role','tab');
    wrapper.setAttribute('aria-selected',String(file === activeFile));

    const name = document.createElement('span');
    name.textContent = file.split('/').pop();
    wrapper.appendChild(name);

    if (dirtyTab(tab)) {
      const dot = document.createElement('span');
      dot.className = 'forge-tab-dirty';
      dot.textContent = '●';
      wrapper.appendChild(dot);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'forge-tab-close';
    close.textContent = '×';
    close.setAttribute('aria-label','Close ' + file);
    close.style.background = 'transparent';
    close.style.border = '0';
    close.style.cursor = 'pointer';
    close.addEventListener('click',event => {
      event.stopPropagation();
      closeTab(file);
    });
    wrapper.appendChild(close);

    wrapper.addEventListener('click',() => activateTab(file));
    tabsBar.appendChild(wrapper);
  }
}

function closeTab(file) {
  captureActiveState();
  const tab = openTabs.get(file);
  if (!tab) return;

  if (dirtyTab(tab) &&
      !window.confirm('Discard unsaved changes in ' + file + '?')) {
    return;
  }

  const wasActive = file === activeFile;
  openTabs.delete(file);

  if (wasActive) {
    activeFile = null;
    const next = [...openTabs.keys()].at(-1);
    if (next) {
      activateTab(next);
    } else {
      switching = true;
      ownzEditor.setState(makeState(''));
      switching = false;
      filename.textContent = 'CODE EDITOR';
      status.textContent = 'No file open';
      highlightTree();
      renderTabs();
      updateSaveIndicator();
    }
  } else {
    renderTabs();
  }
}

async function getJSON(url) {
  const response = await (url.startsWith("/api/") ? ownerFetch(url) : fetch(url));
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}

async function openForgeFile(file) {
  if (openTabs.has(file)) {
    activateTab(file);
    return;
  }
  if (loadingFiles.has(file)) return;
  loadingFiles.add(file);
  status.textContent = 'Loading ' + file + '...';

  try {
    const data = await getJSON('/api/file?path=' + encodeURIComponent(file));
    if (typeof data.content !== 'string') throw new Error('Invalid file content');
    const recoveredContent = recoverForgeDraft(file,data.content);
    openTabs.set(file,{
      state:makeState(recoveredContent),
      savedContent:data.content,
      savedVersion:data.version
    });
    activateTab(file);
  } catch(error) {
    status.textContent = 'Open failed: ' + error.message;
  } finally {
    loadingFiles.delete(file);
  }
}

async function loadForgeFolder(folder,container,depth=0) {
  try {
    const entries = await getJSON('/api/files?path=' + encodeURIComponent(folder));
    entries.sort((a,b) =>
      a.type === b.type ? a.name.localeCompare(b.name) :
      a.type === 'folder' ? -1 : 1
    );

    for (const entry of entries) {
      const file = folder + '/' + entry.name;
      const button = document.createElement('button');
      button.className = 'tree-item' + (entry.type === 'folder' ? ' folder' : '');
      button.textContent = (entry.type === 'folder' ? '📁 ' : '📄 ') + entry.name;
      button.style.paddingLeft = (8 + depth * 16) + 'px';
      button.dataset.path = file;
      container.appendChild(button);

      if (entry.type === 'folder') {
        const children = document.createElement('div');
        container.appendChild(children);
        let loaded = false;
        button.addEventListener('click',async () => {
          if (!loaded) {
            await loadForgeFolder(file,children,depth+1);
            loaded = true;
            children.hidden = false;
          } else {
            children.hidden = !children.hidden;
          }
          button.textContent = (children.hidden ? '📁 ' : '📂 ') + entry.name;
        });
      } else {
        button.addEventListener('click',() => openForgeFile(file));
      }
    }
  } catch(error) {
    const message = document.createElement('p');
    message.textContent = 'Explorer error: ' + error.message;
    container.appendChild(message);
  }
}

let ownzSaveInProgress = false;

async function saveForgeFile() {
  captureActiveState();
  const file = activeFile;
  const tab = openTabs.get(file);
  if (!tab) return;
  if (ownzSaveInProgress) return;
  ownzSaveInProgress = true;

  const content = tab.state.doc.toString();
  const confirmEmptySave = content.length === 0 && tab.savedContent.length > 0;
  if (confirmEmptySave && !window.confirm("WARNING: This will erase all existing code in " + file + ". Save an empty file?")) {
    ownzSaveInProgress = false;
    status.textContent = "Empty-file save canceled: " + file;
    return;
  }
  saveButton.disabled = true;
  status.textContent = 'Saving ' + file + '...';

  try {
    const response = await ownerFetch('/api/file?path=' + encodeURIComponent(file),{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({content, expectedVersion:tab.savedVersion, confirmEmptySave})
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      if (response.status === 409) throw new Error("SAVE CONFLICT — Your unsaved edits remain in the editor. " + (result.error || "File changed on disk."));
      throw new Error(result.error || 'HTTP ' + response.status);
    }

    if (typeof result.version !== 'string' || !/^[a-f0-9]{64}$/.test(result.version)) throw new Error('Save response missing valid version');
    tab.savedContent = content;
    tab.savedVersion = result.version;
    storeDraft(file, tab.state.doc.toString(), tab.savedContent);
    renderTabs();
    updateSaveIndicator();
    if (activeFile === file) status.textContent = tab.state.doc.toString() === content ? 'Saved successfully: ' + file : 'Saved previous version; newer edits remain unsaved: ' + file;
  } catch(error) {
    if (activeFile === file) status.textContent = 'Save failed: ' + error.message;
  } finally {
    ownzSaveInProgress = false;
    saveButton.disabled = false;
  }
}


function listForgeDrafts() {
  const drafts = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key ||
          (!key.startsWith('ownz-forge-draft-v1:') &&
           !key.startsWith('ownz-forge-rejected-v1:'))) continue;

      try {
        const draft = JSON.parse(localStorage.getItem(key));
        if (draft && typeof draft.file === 'string' &&
            typeof draft.content === 'string') {
          drafts.push({key,draft});
        }
      } catch (error) {
        console.warn('Invalid recovery entry:',key,error);
      }
    }
  } catch (error) {
    status.textContent = 'Cannot access browser recovery storage';
  }
  return drafts;
}

async function openRecoveryManager() {
  const drafts = listForgeDrafts();

  if (!drafts.length) {
    window.alert('No recovery drafts found.');
    return;
  }

  const menu = drafts.map((entry,index) => {
    const type = entry.key.startsWith('ownz-forge-rejected-v1:')
      ? 'ARCHIVED' : 'ACTIVE';
    return (index+1) + '. [' + type + '] ' + entry.draft.file;
  }).join('\n');

  const choice = window.prompt(
    'OWNZ FORGE RECOVERY MANAGER\n\n' +
    menu + '\n\nEnter a draft number (Cancel to exit):'
  );

  if (choice === null) return;

  const index = Number(choice)-1;
  if (!Number.isInteger(index) || !drafts[index]) {
    window.alert('Invalid draft number.');
    return;
  }

  const selected = drafts[index];
  const action = window.prompt(
    'Draft: ' + selected.draft.file +
    '\nType RESTORE to open it or DELETE to remove it:'
  );

  if (!action) return;

  if (action.trim().toUpperCase() === 'DELETE') {
    if (!window.confirm('Permanently delete this recovery entry?')) return;
    try {
      localStorage.removeItem(selected.key);
      status.textContent = 'Recovery entry deleted';
    } catch(error) {
      status.textContent = 'Recovery deletion failed: ' + error.message;
    }
    return;
  }

  if (action.trim().toUpperCase() !== 'RESTORE') {
    window.alert('Unknown action.');
    return;
  }

  const file = selected.draft.file;

  if (!openTabs.has(file)) {
    await openForgeFile(file);
  }

  if (!openTabs.has(file)) {
    status.textContent = 'Could not open file for recovery';
    return;
  }

  activateTab(file);
  const tab = openTabs.get(file);
  tab.state = makeState(selected.draft.content);
  switching = true;
  ownzEditor.setState(tab.state);
  switching = false;
  renderTabs();
  updateSaveIndicator();
  status.textContent = 'Recovered draft: ' + file + ' (not saved to disk)';
}

document.getElementById('recovery-manager')
  ?.addEventListener('click',openRecoveryManager);

document.getElementById('forge-find')
  ?.addEventListener('click',() => {
    if (!activeFile) return;
    openSearchPanel(ownzEditor);
    ownzEditor.focus();
  });

saveButton.addEventListener('click',saveForgeFile);
document.addEventListener('keydown',event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveForgeFile();
  }
});

tree.textContent = '';
loadForgeFolder('ECHOBOUND',tree);
openForgeFile('ECHOBOUND/scripts/main.gd');


// OWNZ_PHASE8D_TOOLBAR
import {undo as forgeUndo, redo as forgeRedo} from '@codemirror/commands';

const forgeToolbar = document.getElementById('forge-mobile-toolbar');

if (forgeToolbar) {
  const updateScrollHint = () => forgeToolbar.style.setProperty("--forge-scroll-hint", forgeToolbar.scrollLeft + forgeToolbar.clientWidth < forgeToolbar.scrollWidth - 2 ? "1" : "0");
  forgeToolbar.addEventListener("scroll", updateScrollHint, {passive:true});
  window.addEventListener("resize", updateScrollHint);
  requestAnimationFrame(updateScrollHint);
  // Preserve the editor selection when tapping toolbar buttons.
  forgeToolbar.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) event.preventDefault();
  });

  forgeToolbar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !forgeToolbar.contains(button)) return;

    const action = button.dataset.forgeAction;

    if (action === 'undo') {
      forgeUndo(ownzEditor);
      return;
    }

    if (action === 'redo') {
      forgeRedo(ownzEditor);
      return;
    }

    if (!activeFile) return;

    const selection = ownzEditor.state.selection.main;
    const from = selection.from;
    const to = selection.to;
    const selected = ownzEditor.state.sliceDoc(from, to);

    let replacement;
    let cursor;

    if (action === 'tab') {
      replacement = '    ';
      cursor = from + replacement.length;
    } else if (button.dataset.forgePair) {
      const pair = button.dataset.forgePair;
      replacement = pair[0] + selected + pair[1];
      cursor = from + 1 + selected.length;
    } else if (button.dataset.forgeInsert !== undefined) {
      replacement = button.dataset.forgeInsert;
      cursor = from + replacement.length;
    } else {
      return;
    }

    ownzEditor.dispatch({
      changes: {from, to, insert: replacement},
      selection: {anchor: cursor},
      scrollIntoView: true
    });

    ownzEditor.focus();
  });
}

// PHASE 9B — Mobile file and folder creation
async function forgeCreateItem(kind) {
  const isFile = kind === 'file';
  const label = isFile ? 'file' : 'folder';

  const name = window.prompt(
    'New ' + label + ' name (inside ECHOBOUND):',
    isFile ? 'new_script.gd' : 'new_folder'
  );

  if (name === null) return;

  const cleanName = name.trim();

  if (
    !cleanName ||
    cleanName === '.' ||
    cleanName === '..' ||
    cleanName.includes('/') ||
    cleanName.includes('\\') ||
    /[\x00-\x1f]/.test(cleanName)
  ) {
    status.textContent = 'Invalid ' + label + ' name.';
    return;
  }

  const targetPath = 'ECHOBOUND/' + cleanName;
  const endpoint = isFile ? '/api/create-file' : '/api/create-folder';
  const button = document.getElementById(
    isFile ? 'forge-new-file' : 'forge-new-folder'
  );

  button.disabled = true;
  status.textContent = 'Creating ' + label + '...';

  try {
    const response = await ownerFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isFile
          ? { path: targetPath, content: '' }
          : { path: targetPath }
      )
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'HTTP ' + response.status);
    }

    tree.replaceChildren();
    await loadForgeFolder('ECHOBOUND', tree);

    if (isFile) {
      await openForgeFile(targetPath);
    }

    status.textContent = 'Created ' + label + ': ' + targetPath;
  } catch (error) {
    status.textContent = 'Create failed: ' + error.message;
  } finally {
    button.disabled = false;
  }
}

document.getElementById('forge-new-file')
  .addEventListener('click', () => forgeCreateItem('file'));

document.getElementById('forge-new-folder')
  .addEventListener('click', () => forgeCreateItem('folder'));

// PHASE 9D — PROJECT EXPLORER REFRESH
const forgeRefreshButton = document.getElementById('forge-refresh');

if (forgeRefreshButton) {
  forgeRefreshButton.addEventListener('click', async () => {
    forgeRefreshButton.disabled = true;
    status.textContent = 'Refreshing project explorer...';

    try {
      const refreshedTree = document.createElement('div');
      await loadForgeFolder('ECHOBOUND', refreshedTree);

      if (refreshedTree.querySelector('p')) {
        throw new Error(refreshedTree.textContent);
      }

      tree.replaceChildren(...Array.from(refreshedTree.childNodes));
      status.textContent = 'Project explorer refreshed!';
    } catch (error) {
      status.textContent = 'Refresh failed: ' + error.message;
    } finally {
      forgeRefreshButton.disabled = false;
    }
  });
}


// PHASE 9E - RENAME UI
const forgeRenameButton = document.getElementById('forge-rename');

if (forgeRenameButton) {
  forgeRenameButton.addEventListener('click', async () => {
    if (!activeFile) {
      status.textContent = 'Open a file before renaming.';
      return;
    }

    const oldPath = activeFile;
    const tab = openTabs.get(oldPath);

    if (!tab) {
      status.textContent = 'Active tab not found.';
      return;
    }

    const currentContent = ownzEditor.state.doc.toString();

    if (currentContent !== tab.savedContent) {
      status.textContent = 'Save your changes before renaming.';
      return;
    }

    const oldName = oldPath.split('/').pop();
    const newName = window.prompt('Rename file:', oldName);

    if (newName === null || newName === oldName) return;

    if (!newName || newName.includes('/') || newName.includes('\\')) {
      status.textContent = 'Invalid filename.';
      return;
    }

    forgeRenameButton.disabled = true;

    try {
      const response = await ownerFetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: oldPath,
          newName
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Rename failed');
      }

      const newPath = result.newPath;

      openTabs.delete(oldPath);
      openTabs.set(newPath, tab);
      activeFile = newPath;

      filename.textContent = newName;
      renderTabs();

      status.textContent = 'Renamed successfully: ' + newName;

      if (forgeRefreshButton) forgeRefreshButton.click();

    } catch (error) {
      status.textContent = 'Rename failed: ' + error.message;
    } finally {
      forgeRenameButton.disabled = false;
    }
  });
}


// OWNZ_SAFE_DELETE_HANDLER_V1
const forgeDeleteButton = document.getElementById('forge-delete');

if (forgeDeleteButton) {
  forgeDeleteButton.addEventListener('click', async () => {
    captureActiveState();

    const file = activeFile;
    const tab = file ? openTabs.get(file) : null;

    if (!file || !tab) {
      status.textContent = 'Select a file to delete first.';
      return;
    }

    if (dirtyTab(tab)) {
      status.textContent = 'Save or discard unsaved changes before deleting.';
      window.alert(
        'This file has unsaved changes. Save or discard them before deleting.'
      );
      return;
    }

    const confirmed = window.confirm(
      'Move this file to Safe Trash?\n\n' + file +
      '\n\nYou can restore it later.'
    );

    if (!confirmed) return;

    forgeDeleteButton.disabled = true;
    status.textContent = 'Moving to Safe Trash: ' + file;

    try {
      const response = await ownerFetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Trash operation failed');
      }

      // File has been safely moved. Remove its tab without
      // invoking closeTab(), which could prompt after deletion.
      openTabs.delete(file);

      if (activeFile === file) {
        activeFile = null;

        const next = [...openTabs.keys()].at(-1);

        if (next) {
          activateTab(next);
        } else {
          switching = true;
          ownzEditor.setState(makeState(''));
          switching = false;
          filename.textContent = 'CODE EDITOR';
          renderTabs();
          updateSaveIndicator();
        }
      } else {
        renderTabs();
      }

      if (forgeRefreshButton) forgeRefreshButton.click();

      status.textContent = 'Moved to Safe Trash: ' + file;
    } catch (error) {
      status.textContent = 'Delete failed: ' + error.message;
    } finally {
      forgeDeleteButton.disabled = false;
    }
  });
}

const trashRefresh = document.getElementById('forge-trash-refresh');
const trashList = document.getElementById('forge-trash-list');

async function refreshForgeTrash() {
  if (!trashList) return;
  trashList.textContent = 'Loading deleted files...';
  try {
    const response = await ownerFetch('/api/trash');
    if (!response.ok) throw Error('HTTP ' + response.status);
    const items = await response.json();
    if (!Array.isArray(items)) throw Error('Invalid response');
    trashList.replaceChildren();
    if (!items.length) {
      trashList.textContent = 'Trash is empty.';
      return;
    }
    for (const item of items) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:10px;border-bottom:1px solid #532323';
      const name = document.createElement('div');
      name.textContent = item.originalPath;
      const button = document.createElement('button');
      button.textContent = 'RESTORE';
      button.type = 'button';
      button.addEventListener('click', () => restoreForgeTrash(item.id, item.originalPath));
      row.append(name, button);
      trashList.append(row);
    }
  } catch (error) {
    trashList.textContent = 'Trash error: ' + error.message;
  }
}

async function restoreForgeTrash(id, path) {
  if (!window.confirm('Restore ' + path + '?')) return;
  try {
    const response = await ownerFetch('/api/restore', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id})
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw Error(data.error || 'Restore failed');
    }
    status.textContent = 'Restored: ' + data.path;
    if (forgeRefreshButton) forgeRefreshButton.click();
    await refreshForgeTrash();
  } catch (error) {
    status.textContent = 'Restore failed: ' + error.message;
  }
}

if (trashRefresh) {
  trashRefresh.addEventListener('click', refreshForgeTrash);
}

// PHASE 10 — OWNZ FORGE AI ASSISTANT
const ownzAiPrompt = document.getElementById('ownz-ai-prompt');
const ownzAiButton = document.getElementById('ownz-ai-ask');
const ownzAiAnswer = document.getElementById('ownz-ai-answer');
const ownzAiIncludeCode = document.getElementById('ownz-ai-include-code');

// PHASE 36 — FATALACIDBURN PERSISTENT CONVERSATION
const fatalConversationKey = 'ownz-fatalacidburn-conversation-v1';
let fatalConversationId = null;

try {
  const storedId = localStorage.getItem(fatalConversationKey);
  if (storedId && /^[0-9a-f-]{36}$/i.test(storedId)) {
    fatalConversationId = storedId;
  }
} catch (error) {
  console.warn('FatalAcidBurn conversation storage unavailable:', error);
}

if (ownzAiButton && ownzAiPrompt && ownzAiAnswer) {
  ownzAiButton.addEventListener('click', async () => {
    const message = ownzAiPrompt.value.trim();

    if (!message) {
      ownzAiAnswer.textContent = 'Enter a question first.';
      return;
    }

    ownzAiButton.disabled = true;
    ownzAiButton.textContent = 'AI IS THINKING...';
    ownzAiAnswer.textContent = 'Contacting OwnZ Forge AI...';

    try {
      const code = ownzAiIncludeCode?.checked
        ? ownzEditor.state.doc.toString().slice(0, 30000)
        : '';

      const response = await ownerFetch('/api/ai/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message, code, ...(fatalConversationId ? {conversationId: fatalConversationId} : {})})
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'HTTP ' + response.status);
      }

      if (data.conversationId && /^[0-9a-f-]{36}$/i.test(data.conversationId)) {
        fatalConversationId = data.conversationId;
        try {
          localStorage.setItem(fatalConversationKey, fatalConversationId);
        } catch (error) {
          console.warn('Could not persist conversation ID:', error);
        }
      }

      ownzAiAnswer.textContent = data.reply || 'No response received.';
    } catch (error) {
      ownzAiAnswer.textContent = 'AI unavailable: ' + error.message;
    } finally {
      ownzAiButton.disabled = false;
      ownzAiButton.textContent = '⚡ ASK OWNZ AI';
    }
  });
}



// PHASE 37 — PROFESSIONAL ROLES MANAGER
const fatalRoleName = document.getElementById('fatal-role-name');
const fatalRoleInstructions = document.getElementById('fatal-role-instructions');
const fatalRoleSave = document.getElementById('fatal-role-save');
const fatalRolesRefresh = document.getElementById('fatal-role-refresh');
const fatalRoleStatus = document.getElementById('fatal-role-status');
const fatalRoleList = document.getElementById('fatal-role-list');

async function loadFatalRoles() {
  if (!fatalRoleList || !fatalRoleStatus) return;
  fatalRoleStatus.textContent = 'Loading professional roles...';

  try {
    const response = await ownerFetch('/api/ai/roles');
    if (!response.ok) throw Error('HTTP ' + response.status);
    const data = await response.json();

    fatalRoleList.replaceChildren();

    if (!Array.isArray(data.roles)) throw Error('Invalid roles response');

    for (const role of data.roles) {
      const card = document.createElement('div');
      card.style.cssText =
        'padding:12px;background:#201010;border:1px solid #743030;border-radius:9px;overflow-wrap:anywhere';

      const heading = document.createElement('strong');
      heading.textContent = role.name;
      heading.style.color = '#ff7777';

      const details = document.createElement('p');
      details.textContent = role.instructions;
      details.style.cssText =
        'font-size:12px;color:#ddd;white-space:pre-wrap;margin:8px 0';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = role.enabled ? '✓ ENABLED — TAP TO DISABLE' : '○ DISABLED — TAP TO ENABLE';
      toggle.style.cssText =
        'width:100%;min-height:44px;background:#382020;color:white;border:1px solid #a32222;border-radius:7px';

      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        try {
          const response = await ownerFetch(
            '/api/ai/roles/' + encodeURIComponent(role.name),
            {
              method: 'PATCH',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({enabled: !Boolean(role.enabled)})
            }
          );
          if (!response.ok) throw Error('HTTP ' + response.status);
          await loadFatalRoles();
        } catch (error) {
          fatalRoleStatus.textContent = 'Role update failed: ' + error.message;
          toggle.disabled = false;
        }
      });

      card.append(heading, details, toggle);
      fatalRoleList.append(card);
    }

    fatalRoleStatus.textContent = data.roles.length
      ? data.roles.length + ' professional role(s) loaded.'
      : 'No roles assigned yet. Create your first role above.';
  } catch (error) {
    fatalRoleStatus.textContent = 'Unable to load roles: ' + error.message;
  }
}

if (fatalRoleSave && fatalRoleName && fatalRoleInstructions) {
  fatalRoleSave.addEventListener('click', async () => {
    const name = fatalRoleName.value.trim();
    const instructions = fatalRoleInstructions.value.trim();

    if (!name || !instructions) {
      fatalRoleStatus.textContent = 'Enter a role name and instructions.';
      return;
    }

    fatalRoleSave.disabled = true;
    fatalRoleStatus.textContent = 'Saving professional role...';

    try {
      const response = await ownerFetch('/api/ai/roles', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({name, instructions})
      });

      if (!response.ok) {
        const data = await response.json();
        throw Error(data.error || 'HTTP ' + response.status);
      }

      fatalRoleStatus.textContent = 'Role saved: ' + name;
      await loadFatalRoles();
    } catch (error) {
      fatalRoleStatus.textContent = 'Role save failed: ' + error.message;
    } finally {
      fatalRoleSave.disabled = false;
    }
  });
}

if (fatalRolesRefresh) {
  fatalRolesRefresh.addEventListener('click', loadFatalRoles);
  loadFatalRoles();
}

// PHASE 11 — ANALYZE CURRENT FILE
const ownzAnalyzeButton = document.getElementById('ownz-ai-analyze');

if (ownzAnalyzeButton && ownzAiAnswer) {
  ownzAnalyzeButton.addEventListener('click', async () => {
    if (!activeFile) {
      ownzAiAnswer.textContent = 'Open a project file first.';
      return;
    }

    const file = activeFile;
    const code = ownzEditor.state.doc.toString();

    if (code.length > 30000) {
      ownzAiAnswer.textContent = 'File exceeds the 30,000-character AI review limit.';
      return;
    }

    ownzAnalyzeButton.disabled = true;
    ownzAnalyzeButton.textContent = '🔍 ANALYZING...';
    ownzAiAnswer.textContent = 'Analyzing ' + file + '...';

    try {
      const response = await ownerFetch('/api/ai/chat', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          message: 'Perform a professional, read-only code review of file: ' +
            file +
            '. Identify syntax errors, logic bugs, Godot compatibility issues, performance problems, and recommended improvements. Prioritize findings by severity. Do not claim to have edited the file.',
          code
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'HTTP ' + response.status);
      }

      ownzAiAnswer.textContent =
        'ANALYSIS: ' + file + '\n\n' +
        (data.reply || 'No analysis received.');
    } catch (error) {
      ownzAiAnswer.textContent = 'Analysis failed: ' + error.message;
    } finally {
      ownzAnalyzeButton.disabled = false;
      ownzAnalyzeButton.textContent = '🔍 ANALYZE CURRENT FILE';
    }
  });
}



// PHASE 13 — DIFF INTEGRATION
const ownzDiffPanel = document.getElementById('ownz-ai-diff');
const ownzDiffSummary = document.getElementById('ownz-ai-diff-summary');
const ownzDiffLines = document.getElementById('ownz-ai-diff-lines');

let ownzDiffGeneration = 0;

function ownzShowDiff(original, proposed) {
  if (!ownzDiffPanel || !ownzDiffSummary || !ownzDiffLines) return;

  const generation = ++ownzDiffGeneration;

  ownzDiffSummary.textContent = 'Preparing diff preview...';
  ownzDiffLines.replaceChildren();
  ownzDiffPanel.hidden = false;

  import('./ownz-diff.js')
    .then(({ ownzRenderDiff }) => {
      if (generation !== ownzDiffGeneration) return;
      if (ownzDiffPanel.hidden) return;

      ownzRenderDiff(
        original,
        proposed,
        ownzDiffSummary,
        ownzDiffLines
      );
    })
    .catch(error => {
      if (generation !== ownzDiffGeneration) return;
      if (ownzDiffPanel.hidden) return;

      ownzDiffSummary.textContent =
        'Diff preview unavailable: ' + error.message;
    });
}

// PHASE 11 — SAFE FIX GENERATION
let ownzPendingFix = null;
let ownzFixRequestBusy = false;


const ownzFixButton = document.getElementById('ownz-ai-fix');
const ownzFixPreview = document.getElementById('ownz-ai-fix-preview');
const ownzFixCode = document.getElementById('ownz-ai-fix-code');
const ownzApproveButton = document.getElementById('ownz-ai-approve');
const ownzRejectButton = document.getElementById('ownz-ai-reject');

function ownzClearPendingFix() {
  ++ownzDiffGeneration;
  ownzPendingFix = null;
  if (ownzFixPreview) ownzFixPreview.hidden = true;
  if (ownzDiffPanel) ownzDiffPanel.hidden = true;
  if (ownzFixCode) ownzFixCode.textContent = '';
  if (ownzApproveButton) ownzApproveButton.disabled = true;
  if (ownzRejectButton) ownzRejectButton.disabled = true;
}

if (ownzFixButton && ownzFixPreview && ownzFixCode) {
  ownzFixButton.addEventListener('click', async () => {
    if (ownzFixRequestBusy) return;
    ownzFixRequestBusy = true;
    ownzFixButton.disabled = true;

    if (!activeFile) {
      ownzAiAnswer.textContent = 'Open a file first.';
      ownzFixRequestBusy = false;
      ownzFixButton.disabled = false;
      return;
    }

    ownzClearPendingFix();

    const file = activeFile;
    const original = ownzEditor.state.doc.toString();

    if (original.length > 30000) {
      ownzAiAnswer.textContent = 'File exceeds AI limit.';
      ownzFixRequestBusy = false;
      ownzFixButton.disabled = false;
      return;
    }

    // OWNZ FORGE — DIAGNOSTICS-AWARE AI FIX V1
    // Analyze the unsaved editor snapshot locally before requesting AI.
    let ownzAiFixDiagnostics = 'No diagnostic results available.';

    if (file.endsWith('.gd')) {
      try {
        const check = await ownerFetch('/api/intelligence/check-code', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({code: original})
        });

        if (check.ok) {
          const result = await check.json();

          if (Array.isArray(result.warnings)) {
            ownzAiFixDiagnostics = result.warnings.length
              ? result.warnings.slice(0, 20).map(w =>
                  'Line ' + w.line + ': ' + w.message
                ).join(String.fromCharCode(10))
              : 'No heuristic warnings found.';
          }
        }
      } catch {
        // Diagnostics failure must not silently modify the editor.
      }
    }

    // Never send a stale snapshot to the AI provider.
    if (activeFile !== file ||
        ownzEditor.state.doc.toString() !== original) {
      ownzAiAnswer.textContent =
        'SAFETY STOP: File changed during diagnostics. Try again.';
      ownzFixRequestBusy = false;
      ownzFixButton.disabled = false;
      return;
    }

    ownzFixButton.disabled = true;
    ownzFixButton.textContent = 'GENERATING FIX...';
    ownzAiAnswer.textContent = 'Generating proposed fix for ' + file;

    try {
      const response = await ownerFetch('/api/ai/chat', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          message:
            'You are repairing the existing source file ' + file + '. ' +
            'Make the SMALLEST changes necessary to correct genuine errors. ' +
            'Preserve existing classes, functions, variables, comments, game logic, ' +
            'formatting, and behavior wherever possible. ' +
            'Do not add example code, new features, or unnecessary extends declarations. ' +
            'Diagnostic warnings are heuristic clues, not confirmed compiler errors. ' +
            'Verify each warning against the supplied source before changing anything. ' +
            'Relevant local diagnostics:\n' + ownzAiFixDiagnostics + '\n' +
            'Return ONLY the complete corrected source code. ' +
            'Do not include Markdown fences, explanations, or commentary.',
          code: original
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'HTTP ' + response.status);
      }

      let proposed = (data.reply || '').trim();

      proposed = proposed.replace(/^\x60{3}[a-zA-Z0-9_-]*\s*\n/, '');
      proposed = proposed.replace(/\n\x60{3}\s*$/, '');

      if (!proposed) throw new Error('AI returned empty code');


      // Reject AI results if the editor changed during generation.
      if (activeFile !== file ||
          ownzEditor.state.doc.toString() !== original) {
        throw new Error(
          'SAFETY STOP: AI response is outdated. ' +
          'Your current code was not modified. Generate a new fix.'
        );
      }

      ownzPendingFix = {file, original, proposed};

      ownzFixCode.textContent = proposed;
      ownzShowDiff(original, proposed);
      ownzFixPreview.hidden = false;
      ownzRejectButton.disabled = false;
      ownzApproveButton.disabled = false;

      ownzAiAnswer.textContent =
        'Fix generated for ' + file +
        '. Review the highlighted changes, then Approve or Reject. Approved fixes stay in the editor until you press Save.';
    } catch (error) {
      ownzClearPendingFix();
      ownzAiAnswer.textContent = 'Fix generation failed: ' + error.message;
    } finally {
      ownzFixRequestBusy = false;
      ownzFixButton.disabled = false;
      ownzFixButton.textContent = '⚡ GENERATE CODE FIX';
    }
  });
}

if (ownzRejectButton) {
  ownzRejectButton.addEventListener('click', () => {
    ownzClearPendingFix();
    ownzAiAnswer.textContent = 'Proposed fix rejected. Original code unchanged.';
  });
}


// PHASE 11 — SAFE FIX APPROVAL
if (ownzApproveButton) {
  ownzApproveButton.disabled = true;

  ownzApproveButton.addEventListener('click', () => {
    const fix = ownzPendingFix;

    if (!fix) {
      ownzAiAnswer.textContent = 'No pending fix to approve.';
      return;
    }

    if (activeFile !== fix.file) {
      ownzAiAnswer.textContent =
        'SAFETY STOP: You switched files. Generate a new fix.';
      ownzClearPendingFix();
      return;
    }

    const current = ownzEditor.state.doc.toString();

    if (current !== fix.original) {
      ownzAiAnswer.textContent =
        'SAFETY STOP: File changed since AI analysis. Generate a new fix.';
      ownzClearPendingFix();
      return;
    }

    if (fix.proposed === fix.original) {
      ownzAiAnswer.textContent =
        'AI proposal contains no changes.';
      ownzClearPendingFix();
      return;
    }

    const tab = openTabs.get(activeFile);

    if (!tab) {
      ownzAiAnswer.textContent = 'SAFETY STOP: File tab missing.';
      ownzClearPendingFix();
      return;
    }

    try {
      captureActiveState();

      const original = current;
      const proposed = fix.proposed;

      // Save original into browser draft recovery storage.
      const backupKey =
        'ownz-forge-ai-backup:' +
        fix.file + ':' + Date.now();

      localStorage.setItem(backupKey, original);

      // Replace editor contents, not the disk file.
      ownzEditor.dispatch({
        changes: {
          from: 0,
          to: ownzEditor.state.doc.length,
          insert: proposed
        }
      });

      captureActiveState();
      renderTabs();
      updateSaveIndicator();

      ownzClearPendingFix();

      ownzAiAnswer.textContent =
        'AI FIX APPLIED TO EDITOR: ' + fix.file +
        '\nOriginal code backed up in browser storage.' +
        '\nReview the changes, then press Save when ready.';

      status.textContent =
        'AI fix applied to editor — NOT SAVED: ' + fix.file;
    } catch (error) {
      ownzAiAnswer.textContent =
        'Approval failed: ' + error.message;
    }
  });
}



// PHASE 12 — RECOVERY CENTER CONTROLLER
const ownzHistoryPanel = document.getElementById('ownz-recovery-center');
const ownzHistoryList = document.getElementById('ownz-history-list');
const ownzHistoryPreview = document.getElementById('ownz-history-preview');
const ownzHistoryCode = document.getElementById('ownz-history-code');
const ownzHistoryRestore = document.getElementById('ownz-history-restore');

let ownzSelectedVersion = null;

document.getElementById('ownz-version-history')
  ?.addEventListener('click', async () => {
    if (!activeFile) {
      window.alert('Open a file first.');
      return;
    }

    const file = activeFile;
    ownzSelectedVersion = null;
    ownzHistoryPreview.hidden = true;
    ownzHistoryRestore.disabled = true;
    ownzHistoryList.textContent = 'Loading saved versions...';
    document.getElementById('ownz-history-file').textContent = file;
    ownzHistoryPanel.hidden = false;

    try {
      const response = await ownerFetch(
        '/api/history?path=' + encodeURIComponent(file)
      );
      const versions = await response.json();

      if (!response.ok || !Array.isArray(versions)) {
        throw new Error(versions.error || 'History request failed');
      }

      if (activeFile !== file || ownzHistoryPanel.hidden) return;

      ownzHistoryList.replaceChildren();

      if (!versions.length) {
        ownzHistoryList.textContent = 'No saved versions found.';
        return;
      }

      for (const version of versions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent =
          new Date(version.createdAt).toLocaleString() +
          ' — ' + version.size + ' bytes';

        button.style.cssText =
          'width:100%;min-height:48px;text-align:left;padding:12px;' +
          'background:#291515;color:white;border:1px solid #a32222;' +
          'border-radius:8px;overflow-wrap:anywhere';

        button.addEventListener('click', async () => {
          ownzSelectedVersion = null;
          ownzHistoryRestore.disabled = true;
          ownzHistoryPreview.hidden = false;
          ownzHistoryCode.textContent = 'Loading preview...';

          try {
            const result = await ownerFetch(
              '/api/history/version?path=' +
              encodeURIComponent(file) +
              '&id=' + encodeURIComponent(version.id)
            );
            const preview = await result.json();

            if (!result.ok) {
              throw new Error(preview.error || 'Preview failed');
            }

            if (activeFile !== file ||
                ownzHistoryPanel.hidden ||
                preview.path !== file ||
                preview.id !== version.id ||
                typeof preview.content !== 'string') {
              throw new Error('Version validation failed');
            }

            ownzSelectedVersion = {
              file,
              content: preview.content,
              expected: ownzEditor.state.doc.toString()
            };

            ownzHistoryCode.textContent = preview.content;
            ownzHistoryRestore.disabled = false;
          } catch (error) {
            ownzHistoryCode.textContent =
              'Preview error: ' + error.message;
          }
        });

        ownzHistoryList.appendChild(button);
      }
    } catch (error) {
      ownzHistoryList.textContent =
        'History error: ' + error.message;
    }
  });

ownzHistoryRestore?.addEventListener('click', () => {
  if (!ownzSelectedVersion) return;

  const version = ownzSelectedVersion;
  const restored = ownzRestoreVersionToEditor(
    version.file,
    version.content,
    version.expected
  );

  if (restored) {
    ownzSelectedVersion = null;
    ownzHistoryRestore.disabled = true;
    ownzHistoryPanel.hidden = true;
  }
});

document.getElementById('ownz-history-close')
  ?.addEventListener('click', () => {
    ownzSelectedVersion = null;
    ownzHistoryRestore.disabled = true;
    ownzHistoryPreview.hidden = true;
    ownzHistoryPanel.hidden = true;
  });

// PHASE 11 — SAFE VERSION RESTORE
function ownzRestoreVersionToEditor(file, content, expected) {
  if (activeFile !== file) {
    window.alert('SAFETY STOP: You switched files.');
    return false;
  }

  const tab = openTabs.get(file);

  if (!tab) {
    window.alert('SAFETY STOP: File tab is missing.');
    return false;
  }

  const current = ownzEditor.state.doc.toString();

  if (current !== expected) {
    window.alert('SAFETY STOP: File changed during recovery.');
    return false;
  }

  if (current === content) {
    window.alert('This version already matches your editor.');
    return false;
  }

  if (dirtyTab(tab)) {
    if (!window.confirm(
      'UNSAVED CHANGES DETECTED.\n\n' +
      'Restoring this version will replace your current editor text. ' +
      'Cancel to keep your changes.'
    )) return false;
  }

  if (!window.confirm(
    'RESTORE VERSION?\n\n' +
    file +
    '\n\nThe restored code will appear in your editor. ' +
    'It will NOT be saved to disk automatically.'
  )) return false;

  try {
    const backupKey =
      'ownz-forge-history-restore:' + file + ':' + Date.now();

    localStorage.setItem(backupKey, current);

    ownzEditor.dispatch({
      changes: {
        from: 0,
        to: ownzEditor.state.doc.length,
        insert: content
      }
    });

    captureActiveState();
    renderTabs();
    updateSaveIndicator();

    status.textContent =
      'Version restored to editor — NOT SAVED: ' + file;

    window.alert(
      'VERSION RESTORED TO EDITOR.\n\n' +
      'Review your code before pressing Save.\n' +
      'Undo is also available.'
    );

    return true;
  } catch (error) {
    window.alert('Restore failed: ' + error.message);
    return false;
  }
}



// OWNZ FORGE — LIVE CODE DIAGNOSTICS V1
// Debounced, read-only analysis of the active CodeMirror document.
{
  const panel = document.getElementById('ownz-live-diagnostics-results');
  const count = document.getElementById('ownz-live-diagnostics-count');
  const aiShortcut = document.getElementById('ownz-live-ai-fix');
  const functionButton = document.getElementById('ownz-function-nav');
  const functionPanel = document.getElementById('ownz-function-panel');
  const functionSearch = document.getElementById('ownz-function-search');
  const functionResults = document.getElementById('ownz-function-results');
  let currentWarnings = 0;
  let indexedFunctions = [];
  functionButton?.addEventListener("click", () => { if (!functionPanel) return; functionPanel.hidden = !functionPanel.hidden; functionButton.setAttribute("aria-expanded", String(!functionPanel.hidden)); if (!functionPanel.hidden) functionSearch?.focus(); });

  function updateAiShortcut() {
    if (!aiShortcut) return;
    const available = currentWarnings > 0 &&
      !!activeFile &&
      activeFile.endsWith('.gd');

    aiShortcut.disabled = !available;
    aiShortcut.style.opacity = available ? '1' : '.6';
  }

  aiShortcut?.addEventListener('click', () => {
    if (aiShortcut.disabled || currentWarnings < 1) return;

    const fixButton = document.getElementById('ownz-ai-fix');

    if (!fixButton || fixButton.disabled) return;

    fixButton.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    fixButton.click();
  });


  let timer = null;
  let controller = null;
  let revision = 0;

  function resetWarningTimer() { clearTimeout(warningHighlightTimer); warningHighlightTimer = null; }
  function jumpToWarning(line) { resetWarningTimer(); const n = Math.max(1, Math.min(line, ownzEditor.state.doc.lines)); ownzEditor.dispatch({selection:{anchor:ownzEditor.state.doc.line(n).from},scrollIntoView:true}); ownzEditor.dispatch({effects:setWarningHighlight.of(Decoration.set([warningLineMark.range(ownzEditor.state.doc.line(n).from)]))}); warningHighlightTimer = setTimeout(() => ownzEditor.dispatch({effects:setWarningHighlight.of(Decoration.none)}), 3000); ownzEditor.focus(); }
  function refreshFunctionList() { renderFunctionList(functionResults, indexedFunctions, functionSearch?.value || "", jumpToWarning); }
  functionSearch?.addEventListener("input", refreshFunctionList);
  function renderWarnings(data, file) {
    if (!panel || !count) return;

    currentWarnings = data.warningCount;
    updateAiShortcut();
    count.textContent = String(data.warningCount);
    panel.replaceChildren();

    const heading = document.createElement('div');
    heading.textContent = data.warningCount
      ? '⚠ Live warnings — ' + file
      : '✓ No live heuristic warnings — ' + file;
    heading.style.color = data.warningCount
      ? '#ffbd73' : '#78df98';
    panel.appendChild(heading);

    for (const warning of data.warnings.slice(0, 30)) {
      const item = document.createElement('div');
      item.style.cssText =
        'padding:9px;background:#302020;border-radius:7px;' +
        'border-left:3px solid #ff6868;overflow-wrap:anywhere';

      const location = document.createElement('strong');
      location.textContent = file + ':' + warning.line;

      const message = document.createElement('div');
      message.textContent = warning.message;

      item.style.cursor = "pointer";
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); item.click(); } };
      item.addEventListener("click", () => { if (activeFile === file) jumpToWarning(warning.line); });
      item.append(location, message);
      panel.appendChild(item);
    }

    if (data.warnings.length > 30) {
      const extra = document.createElement('div');
      extra.textContent =
        (data.warnings.length - 30) + ' additional warnings';
      panel.appendChild(extra);
    }
  }

  function scheduleDiagnostics() {
    clearTimeout(timer);
    if (controller) controller.abort();

    currentWarnings = 0;
    indexedFunctions = [];
    refreshFunctionList();
    updateAiShortcut();

    const token = ++revision;
    const file = activeFile;

    if (!panel || !count) return;

    if (!file || !file.endsWith('.gd')) {
      count.textContent = '—';
      panel.textContent = 'Open a GDScript file for live diagnostics.';
      return;
    }

    const code = ownzEditor.state.doc.toString();

    if (new TextEncoder().encode(code).length > 262144) {
      count.textContent = '—';
      panel.textContent = 'File exceeds live diagnostics size limit.';
      return;
    }

    panel.textContent = 'Checking unsaved GDScript...';

    timer = setTimeout(async () => {
      const requestController = new AbortController();
      controller = requestController;

      try {
        const response = await ownerFetch('/api/intelligence/check-code', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({code}),
          signal: requestController.signal
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();

        if (token !== revision || activeFile !== file) return;

        if (!Array.isArray(data.warnings) ||
            !Number.isInteger(data.warningCount) ||
            data.engine !== 'offline-heuristic-v1') {
          throw new Error('Invalid diagnostics response');
        }

        indexedFunctions = Array.isArray(data.functions) ? data.functions : [];
        renderWarnings(data, file);
        refreshFunctionList();
      } catch (error) {
        if (error.name === 'AbortError' || token !== revision) return;
        panel.textContent = 'Live diagnostics unavailable: ' + error.message;
        if (functionResults) functionResults.textContent = 'Function indexing unavailable.';
      } finally {
        if (controller === requestController) controller = null;
      }
    }, 600);
  }

  ownzScheduleLiveDiagnostics = scheduleDiagnostics;

  const tabs = document.getElementById('forge-tabs');
  tabs?.addEventListener('click', () => {
    setTimeout(scheduleDiagnostics, 0);
  });

  scheduleDiagnostics();
}

// OWNZ FORGE — PROJECT INTELLIGENCE UI V1
// Local, read-only analysis. No AI provider calls.
{
  const refresh = document.getElementById('ownz-intelligence-refresh');
  const indicator = document.getElementById('ownz-intelligence-status');
  const files = document.getElementById('ownz-intelligence-files');
  const deps = document.getElementById('ownz-intelligence-deps');
  const missing = document.getElementById('ownz-intelligence-missing');
  const details = document.getElementById('ownz-intelligence-details');
  // OWNZ DIAGNOSTICS UI V1
  const diagnosticCount = document.getElementById('ownz-diagnostics-count');
  const diagnosticResults = document.getElementById('ownz-diagnostics-results');

  if (refresh && indicator && files && deps && missing && details) {
    refresh.addEventListener('click', async () => {
      if (refresh.disabled) return;

      refresh.disabled = true;
      indicator.textContent = 'Scanning ECHOBOUND...';
      details.replaceChildren();
      if (diagnosticCount) diagnosticCount.textContent = '—';
      if (diagnosticResults) {
        diagnosticResults.textContent = 'Checking GDScript...';
      }

      try {
        const project = encodeURIComponent('ECHOBOUND');
        const [scan, analysis, diagnostics] = await Promise.all([
          getJSON('/api/intelligence/scan?project=' + project),
          getJSON('/api/intelligence/dependencies?project=' + project),
          getJSON('/api/intelligence/diagnostics?project=' + project)
        ]);

        if (!Array.isArray(scan.files) ||
            !Array.isArray(analysis.dependencies) ||
            !Array.isArray(analysis.missing)) {
          throw new Error('Invalid intelligence response');
        }

        if (!diagnostics ||
            !Array.isArray(diagnostics.warnings) ||
            !Number.isInteger(diagnostics.warningCount) ||
            diagnostics.engine !== 'offline-heuristic-v1') {
          throw new Error('Invalid diagnostics response');
        }

        files.textContent = String(scan.fileCount);
        deps.textContent = String(analysis.dependencies.length);
        missing.textContent = String(analysis.missing.length);

        const heading = document.createElement('strong');
        heading.textContent = analysis.missing.length
          ? '⚠ Missing Godot references'
          : '✓ No missing references detected';
        heading.style.color = analysis.missing.length
          ? '#ffbd73' : '#78df98';

        details.appendChild(heading);

        for (const item of analysis.missing.slice(0, 30)) {
          const entry = document.createElement('div');
          entry.style.cssText =
            'padding:8px;margin-top:6px;background:#302020;border-radius:6px';
          entry.textContent = item.from + ' → ' + item.to;
          details.appendChild(entry);
        }

        if (analysis.missing.length > 30) {
          const extra = document.createElement('p');
          extra.textContent =
            (analysis.missing.length - 30) + ' additional missing references';
          details.appendChild(extra);
        }

        if (diagnosticCount && diagnosticResults) {
          diagnosticCount.textContent = String(diagnostics.warningCount);
          diagnosticResults.replaceChildren();

          const summary = document.createElement('div');
          summary.textContent = diagnostics.warningCount
            ? '⚠ Potential GDScript issues found'
            : '✓ No heuristic warnings detected';
          summary.style.color = diagnostics.warningCount
            ? '#ffbd73' : '#78df98';
          diagnosticResults.appendChild(summary);

          for (const warning of diagnostics.warnings.slice(0, 30)) {
            const item = document.createElement('div');
            item.style.cssText =
              'padding:9px;background:#302020;border-radius:7px;' +
              'border-left:3px solid #ff6868;overflow-wrap:anywhere';

            const location = document.createElement('strong');
            location.textContent =
              String(warning.file) + ':' + String(warning.line);

            const message = document.createElement('div');
            message.textContent = String(warning.message);

            item.append(location, message);
            diagnosticResults.appendChild(item);
          }

          if (diagnostics.warnings.length > 30) {
            const extra = document.createElement('div');
            extra.textContent =
              (diagnostics.warnings.length - 30) +
              ' additional warnings not displayed';
            diagnosticResults.appendChild(extra);
          }
        }

        indicator.textContent = scan.truncated || analysis.truncated
          ? 'Analysis completed with scan limits reached.'
          : 'Analysis complete — ECHOBOUND';
      } catch (error) {
        indicator.textContent = 'Analysis failed: ' + error.message;
        if (diagnosticResults) {
          diagnosticResults.textContent = 'Diagnostics unavailable.';
        }
      } finally {
        refresh.disabled = false;
      }
    });
  }
}


// OWNZ_PROJECT_BRAIN_V1 — read-only UI, no provider calls.
{
  const button = document.getElementById('ownz-brain-refresh');
  const status = document.getElementById('ownz-brain-status');
  const list = document.getElementById('ownz-brain-files');
  if (button && status && list) button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = 'Checking verified source evidence…';
    list.replaceChildren();
    try {
      // Same-origin path intentionally used. Vite proxy/public-server routing must be verified.
      const response = await ownerFetch('/api/project-brain/status', {credentials:'same-origin', cache:'no-store'});
      if (response.status === 401) throw new Error('Administrator login required on this editor origin.');
      if (response.status === 403) throw new Error('Administrator privileges required.');
      if (response.status === 404) throw new Error('Project Brain API is not routed through this editor origin. Configure a secure same-origin proxy before activation.');
      if (!response.ok) throw new Error('Project Brain returned HTTP '+response.status);
      const data = await response.json();
      if (!data || !Array.isArray(data.files)) throw new Error('Unexpected Project Brain response.');
      status.textContent = String(data.engine || 'Project Brain')+' · '+String(data.mode || 'READ_ONLY')+' · '+data.files.length+' files';
      for (const file of data.files) {
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;gap:5px;padding:9px;background:#302020;border-radius:7px;min-width:0;overflow-wrap:anywhere';
        const title = document.createElement('strong'); title.textContent = String(file.file || 'Unknown file');
        const state = document.createElement('span'); state.textContent = 'Status: '+String(file.status || 'unavailable');
        const hash = document.createElement('code'); hash.style.cssText = 'font-size:10px;word-break:break-all;color:#bbb';
        hash.textContent = file.sha256 ? 'SHA-256: '+String(file.sha256) : 'No fingerprint';
        row.append(title,state,hash); list.appendChild(row);
      }
    } catch (error) { status.textContent = String(error.message || error); }
    finally { button.disabled = false; }
  });
}
