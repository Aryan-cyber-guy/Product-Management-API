(() => {
  "use strict";

  /* =========================================================
     State
  ========================================================= */
  let items = [];
  let editingId = null;   // null = creating, otherwise editing existing id
  let pendingDeleteId = null;
  let searchTerm = "";
  let sortMode = "id";

  /* =========================================================
     DOM refs
  ========================================================= */
  const ledger = document.getElementById("ledger");
  const ledgerHead = document.getElementById("ledgerHead");
  const emptyState = document.getElementById("emptyState");
  const loadingState = document.getElementById("loadingState");
  const errorBanner = document.getElementById("errorBanner");
  const errorBannerText = document.getElementById("errorBannerText");

  const statCount = document.getElementById("statCount");
  const statUnits = document.getElementById("statUnits");
  const statValue = document.getElementById("statValue");

  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  const overlay = document.getElementById("overlay");
  const panel = document.getElementById("panel");
  const panelTitle = document.getElementById("panelTitle");
  const entryForm = document.getElementById("entryForm");
  const fieldName = document.getElementById("fieldName");
  const fieldDescription = document.getElementById("fieldDescription");
  const fieldPrice = document.getElementById("fieldPrice");
  const fieldQuantity = document.getElementById("fieldQuantity");
  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");

  const confirmOverlay = document.getElementById("confirmOverlay");
  const confirmDialog = document.getElementById("confirmDialog");
  const confirmBody = document.getElementById("confirmBody");

  const toast = document.getElementById("toast");

  /* =========================================================
     Helpers
  ========================================================= */
  function money(n) {
    return "$" + Number(n).toFixed(2);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  async function api(path, options = {}) {
    let res;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
    } catch (networkErr) {
      throw new Error("NETWORK");
    }
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch (_) {}
      throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  /* =========================================================
     Data loading
  ========================================================= */
  let loadRequestToken = 0;

  async function loadItems() {
    const token = ++loadRequestToken; // marks this as the latest request

    loadingState.hidden = false;
    errorBanner.hidden = true;

    // Only clear the visible list on the very first load, so a retry
    // while data is already on screen doesn't blank the page.
    if (items.length === 0) {
      ledger.innerHTML = "";
      emptyState.hidden = true;
      ledgerHead.style.visibility = "hidden";
    }

    try {
      const data = await api("/products");
      if (token !== loadRequestToken) return; // a newer request already resolved, ignore this one
      items = Array.isArray(data) ? data : [];
      errorBanner.hidden = true;
      render();
    } catch (err) {
      if (token !== loadRequestToken) return; // a newer request superseded this failure
      const msg = err.message === "NETWORK"
        ? "Could not reach the server. Check that the API is running."
        : `Could not load the ledger: ${err.message}`;
      errorBannerText.textContent = msg;
      errorBanner.hidden = false;
    } finally {
      if (token === loadRequestToken) loadingState.hidden = true;
    }
  }

  /* =========================================================
     Rendering
  ========================================================= */
  function getFilteredSorted() {
    let list = items.slice();

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    switch (sortMode) {
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "quantity":
        list.sort((a, b) => a.quantity - b.quantity);
        break;
      default:
        list.sort((a, b) => a.id - b.id);
    }
    return list;
  }

  function qtyBarClass(qty) {
    if (qty <= 0) return "is-empty";
    if (qty <= 5) return "is-low";
    return "";
  }

  function qtyBarWidth(qty) {
    const pct = Math.min(100, (qty / 50) * 100);
    return Math.max(qty > 0 ? 4 : 0, pct);
  }

  function rowTemplate(p) {
    const total = p.price * p.quantity;
    const fillClass = qtyBarClass(p.quantity);
    const width = qtyBarWidth(p.quantity);

    const row = document.createElement("div");
    row.className = "row";
    row.dataset.id = p.id;

    row.innerHTML = `
      <span class="row__id">#${String(p.id).padStart(3, "0")}</span>
      <div class="row__name">
        <p class="row__name-text"></p>
        <p class="row__desc"></p>
      </div>
      <div class="row__qty">
        <span class="qty-value">${p.quantity}</span>
        <div class="qty-bar"><div class="qty-bar__fill ${fillClass}" style="width:${width}%"></div></div>
      </div>
      <span class="row__price">${money(p.price)}</span>
      <span class="row__total">${money(total)}</span>
      <div class="row__actions">
        <button class="icon-btn" data-action="edit" aria-label="Edit ${p.name}">✎</button>
        <button class="icon-btn" data-action="delete" aria-label="Delete ${p.name}">🗑</button>
      </div>
    `;

    row.querySelector(".row__name-text").textContent = p.name;
    row.querySelector(".row__desc").textContent = p.description;
    row.querySelector(".row__desc").title = p.description;

    row.querySelector('[data-action="edit"]').addEventListener("click", () => openEdit(p));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => openConfirmDelete(p));

    return row;
  }

  function render() {
    errorBanner.hidden = true;

    const list = getFilteredSorted();

    ledger.innerHTML = "";
    if (items.length === 0) {
      emptyState.hidden = false;
      ledgerHead.style.visibility = "hidden";
    } else {
      emptyState.hidden = true;
      ledgerHead.style.visibility = "visible";
      if (list.length === 0) {
        const noMatch = document.createElement("div");
        noMatch.className = "empty";
        noMatch.innerHTML = `<p class="empty__title">No matches</p><p class="empty__body">No items match “${escapeHtml(searchTerm)}”.</p>`;
        ledger.appendChild(noMatch);
      } else {
        list.forEach((p) => ledger.appendChild(rowTemplate(p)));
      }
    }

    renderStats();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderStats() {
    const count = items.length;
    const units = items.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
    const value = items.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.quantity || 0), 0);

    statCount.textContent = count;
    statUnits.textContent = units;
    statValue.textContent = money(value);
  }

  /* =========================================================
     Panel (create / edit)
  ========================================================= */
  function openCreate() {
    editingId = null;
    panelTitle.textContent = "New entry";
    submitBtn.textContent = "Save entry";
    entryForm.reset();
    formError.hidden = true;
    openPanel();
  }

  function openEdit(p) {
    editingId = p.id;
    panelTitle.textContent = "Edit entry";
    submitBtn.textContent = "Save changes";
    fieldName.value = p.name;
    fieldDescription.value = p.description;
    fieldPrice.value = p.price;
    fieldQuantity.value = p.quantity;
    formError.hidden = true;
    openPanel();
  }

  function openPanel() {
    overlay.hidden = false;
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    setTimeout(() => fieldName.focus(), 50);
  }

  function closePanel() {
    overlay.hidden = true;
    panel.hidden = true;
    panel.setAttribute("aria-hidden", "true");
    editingId = null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    formError.hidden = true;

    const name = fieldName.value.trim();
    const description = fieldDescription.value.trim();
    const price = parseFloat(fieldPrice.value);
    const quantity = parseInt(fieldQuantity.value, 10);

    if (!name || !description) {
      return showFormError("Name and description can't be empty.");
    }
    if (Number.isNaN(price) || price < 0) {
      return showFormError("Enter a valid unit price.");
    }
    if (Number.isNaN(quantity) || quantity < 0) {
      return showFormError("Enter a valid quantity.");
    }

    const payload = { name, description, price, quantity };
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Saving…";

    try {
      if (editingId === null) {
        const created = await api("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        items.push(created);
        showToast("Entry added to the ledger.");
      } else {
        const updated = await api(`/products/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        items = items.map((it) => (it.id === editingId ? updated : it));
        showToast("Entry updated.");
      }
      closePanel();
      render();
    } catch (err) {
      showFormError(err.message === "NETWORK" ? "Could not reach the server." : err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  }

  function showFormError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
  }

  /* =========================================================
     Delete confirmation
  ========================================================= */
  function openConfirmDelete(p) {
    pendingDeleteId = p.id;
    confirmBody.textContent = `“${p.name}” will be permanently removed from the ledger.`;
    confirmOverlay.hidden = false;
    confirmDialog.hidden = false;
  }

  function closeConfirm() {
    confirmOverlay.hidden = true;
    confirmDialog.hidden = true;
    pendingDeleteId = null;
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId === null) return;
    const id = pendingDeleteId;
    const rowEl = ledger.querySelector(`.row[data-id="${id}"]`);

    closeConfirm();

    try {
      await api(`/products/${id}`, { method: "DELETE" });
      if (rowEl) {
        rowEl.classList.add("row--removing");
        await new Promise((r) => setTimeout(r, 190));
      }
      items = items.filter((it) => it.id !== id);
      render();
      showToast("Entry removed.");
    } catch (err) {
      showToast(err.message === "NETWORK" ? "Could not reach the server." : `Delete failed: ${err.message}`);
    }
  }

  /* =========================================================
     Wiring
  ========================================================= */
  document.getElementById("openCreateBtn").addEventListener("click", openCreate);
  document.getElementById("emptyCreateBtn").addEventListener("click", openCreate);
  document.getElementById("closePanelBtn").addEventListener("click", closePanel);
  document.getElementById("cancelBtn").addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);
  entryForm.addEventListener("submit", handleSubmit);

  document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);
  confirmOverlay.addEventListener("click", closeConfirm);
  document.getElementById("confirmDeleteBtn").addEventListener("click", handleConfirmDelete);

  document.getElementById("retryBtn").addEventListener("click", loadItems);

  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    render();
  });

  sortSelect.addEventListener("change", (e) => {
    sortMode = e.target.value;
    render();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!confirmDialog.hidden) closeConfirm();
      else if (!panel.hidden) closePanel();
    }
  });

  /* =========================================================
     Init
  ========================================================= */
  loadItems();
})();
