const treeList = document.getElementById("tree-list");
const stateJson = document.getElementById("state-json");
const refreshBtn = document.getElementById("refresh-btn");

function refreshTree() {
  chrome.devtools.inspectedWindow.eval(
    `window.__PINE_DEVTOOLS_GLOBAL_HOOK__ ? window.__PINE_DEVTOOLS_GLOBAL_HOOK__.getComponentTree() : []`,
    (result, isException) => {
      if (isException || !result) {
        treeList.innerHTML = `<p style="color:#ef4444">No PineJS components found on this page.</p>`;
        return;
      }
      renderNodes(result);
    }
  );
}

function renderNodes(nodes) {
  treeList.innerHTML = "";
  if (!nodes || nodes.length === 0) {
    treeList.innerHTML = `<p style="color:#9ca3af">No active components detected.</p>`;
    return;
  }

  function createNodeEl(node, depth = 0) {
    const item = document.createElement("div");
    item.className = "node-item";
    item.style.paddingLeft = `${depth * 14 + 8}px`;
    const tag = `&lt;${node.tag}${node.id ? '#' + node.id : ''}&gt;`;
    item.innerHTML = `${tag} ${node.hasScope ? '<span style="color:#10b981">● scope</span>' : ''}`;

    item.addEventListener("click", () => {
      document.querySelectorAll(".node-item").forEach(el => el.classList.remove("selected"));
      item.classList.add("selected");
      stateJson.textContent = JSON.stringify(node.data, null, 2) || '// Empty scope';
    });

    treeList.appendChild(item);
    if (node.children) {
      node.children.forEach(child => createNodeEl(child, depth + 1));
    }
  }

  nodes.forEach(n => createNodeEl(n, 0));
}

refreshBtn.addEventListener("click", refreshTree);
refreshTree();
