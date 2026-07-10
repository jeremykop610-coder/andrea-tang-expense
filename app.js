const state = {
  currentUser: null,
  users: [],
  claims: [],
  categories: [],
  loginUsers: [],
  currentView: "dashboard",
  reviewId: null,
  importRows: [],
  importErrors: [],
  importSummary: null,
  editingClaimId: null,
  previewLineIndex: 0,
  isSubmitting: false,
  highlightClaimId: null,
};

const els = {
  loginScreen: document.querySelector("#loginScreen"),
  appShell: document.querySelector("#appShell"),
  loginForm: document.querySelector("#loginForm"),
  loginDepartment: document.querySelector("#loginDepartment"),
  loginName: document.querySelector("#loginName"),
  passwordField: document.querySelector("#passwordField"),
  loginPassword: document.querySelector("#loginPassword"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  logoutButton: document.querySelector("#logoutButton"),
  pageTitle: document.querySelector("#pageTitle"),
  roleEyebrow: document.querySelector("#roleEyebrow"),
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  metrics: document.querySelector("#metrics"),
  priorityTitle: document.querySelector("#priorityTitle"),
  priorityHelp: document.querySelector("#priorityHelp"),
  primaryActionButton: document.querySelector("#primaryActionButton"),
  priorityList: document.querySelector("#priorityList"),
  secondaryTitle: document.querySelector("#secondaryTitle"),
  secondaryHelp: document.querySelector("#secondaryHelp"),
  categoryBars: document.querySelector("#categoryBars"),
  employeeProfile: document.querySelector("#employeeProfile"),
  expenseForm: document.querySelector("#expenseForm"),
  submitButton: document.querySelector("#submitButton"),
  lineItems: document.querySelector("#lineItems"),
  lineTemplate: document.querySelector("#lineTemplate"),
  addLineButton: document.querySelector("#addLineButton"),
  myClaimRows: document.querySelector("#myClaimRows"),
  financeRows: document.querySelector("#financeRows"),
  financeStatusFilter: document.querySelector("#financeStatusFilter"),
  paymentRows: document.querySelector("#paymentRows"),
  exportButton: document.querySelector("#exportButton"),
  markPaidButton: document.querySelector("#markPaidButton"),
  selectAllPayables: document.querySelector("#selectAllPayables"),
  ledgerRows: document.querySelector("#ledgerRows"),
  ledgerSearch: document.querySelector("#ledgerSearch"),
  ledgerMonth: document.querySelector("#ledgerMonth"),
  ledgerTypeFilter: document.querySelector("#ledgerTypeFilter"),
  ledgerStatusFilter: document.querySelector("#ledgerStatusFilter"),
  exportLedgerButton: document.querySelector("#exportLedgerButton"),
  peopleRows: document.querySelector("#peopleRows"),
  staffFile: document.querySelector("#staffFile"),
  confirmImportButton: document.querySelector("#confirmImportButton"),
  manualPersonForm: document.querySelector("#manualPersonForm"),
  importErrors: document.querySelector("#importErrors"),
  reviewDialog: document.querySelector("#reviewDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogBody: document.querySelector("#dialogBody"),
  claimDetailDialog: document.querySelector("#claimDetailDialog"),
  claimDetailTitle: document.querySelector("#claimDetailTitle"),
  claimDetailBody: document.querySelector("#claimDetailBody"),
  reviewNote: document.querySelector("#reviewNote"),
  approveButton: document.querySelector("#approveButton"),
  rejectButton: document.querySelector("#rejectButton"),
  seedButton: document.querySelector("#seedButton"),
  toast: document.querySelector("#toast"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function fullDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function roleName(role) {
  if (role === "__invalid__") return "角色错误";
  return role === "finance" ? "财务" : "员工";
}

function statusClass(status) {
  if (status === "待财务审核") return "warning";
  if (status === "已驳回") return "danger";
  return "";
}

function apiHeaders(extra = {}) {
  return { ...extra };
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...apiHeaders(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(payload?.error || payload?.errors?.join("；") || "请求失败");
  return payload;
}

function claimInvoiceTotal(claim) {
  const digitalLines = claim.lines.filter((line) => line.receipt_type === "数电发票");
  const values = digitalLines.map((line) => line.invoice_amount).filter((value) => value !== null && value !== undefined);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + Number(value || 0), 0);
}

function claimInvoiceLabel(claim) {
  const hasDigitalInvoice = claim.lines.some((line) => line.receipt_type === "数电发票");
  const total = claimInvoiceTotal(claim);
  if (!hasDigitalInvoice) return "手工填写";
  return total == null ? "未识别" : formatMoney(total);
}

function lineInvoiceLabel(line) {
  if (line.receipt_type !== "数电发票") return "手工填写";
  return line.invoice_amount === null || line.invoice_amount === undefined ? "未识别" : formatMoney(line.invoice_amount);
}

function lineDifference(line) {
  if (line.receipt_type !== "数电发票" || line.invoice_amount === null || line.invoice_amount === undefined) return null;
  return Number(line.invoice_amount || 0) - Number(line.amount || 0);
}

function fileKind(name = "") {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if ([".jpg", ".jpeg", ".png", ".webp"].some((suffix) => lower.endsWith(suffix))) return "image";
  return "other";
}

function claimLinesWithAttachments(claim) {
  return claim.lines.filter((line) => line.attachment_url);
}

function ownClaims() {
  if (!state.currentUser) return [];
  return state.claims.filter((claim) => claim.employee.id === state.currentUser.id);
}

function visibleClaims() {
  if (!state.currentUser) return [];
  return state.currentUser.role === "finance" ? state.claims : ownClaims();
}

function canAccess(view) {
  if (!state.currentUser) return false;
  const nav = [...els.navItems].find((item) => item.dataset.view === view);
  if (!nav) return true;
  return nav.dataset.roles.split(",").includes(state.currentUser.role);
}

function setLoggedIn(data) {
  state.currentUser = data.current_user;
  state.users = data.users;
  state.claims = data.claims;
  state.categories = data.categories;
  state.currentView = "dashboard";
  els.loginScreen.hidden = true;
  els.appShell.hidden = false;
  renderLedgerFilters();
  if (!els.lineItems.children.length) addLine();
  setView("dashboard");
}

async function loadLoginOptions() {
  const data = await apiJson("/api/login-options", { headers: {} });
  state.loginUsers = data.users;
  const departments = [...new Set(state.loginUsers.map((user) => user.department))];
  els.loginDepartment.innerHTML = departments.map((department) => `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`).join("");
  renderLoginNames();
}

function renderLoginNames() {
  const department = els.loginDepartment.value;
  const users = state.loginUsers.filter((user) => user.department === department);
  els.loginName.innerHTML = users.map((user) => `<option value="${escapeHtml(user.name)}">${escapeHtml(user.name)}</option>`).join("");
  renderPasswordField();
}

function selectedLoginUser() {
  return state.loginUsers.find((user) => user.department === els.loginDepartment.value && user.name === els.loginName.value);
}

function renderPasswordField() {
  const user = selectedLoginUser();
  const needsPassword = Boolean(user?.requires_password);
  els.passwordField.hidden = !needsPassword;
  els.loginPassword.required = needsPassword;
  if (!needsPassword) els.loginPassword.value = "";
}

async function handleLogin(event) {
  event.preventDefault();
  try {
    const data = await apiJson("/api/login", {
      method: "POST",
      body: JSON.stringify({
        department: els.loginDepartment.value,
        name: els.loginName.value,
        password: els.loginPassword.value,
      }),
    });
    setLoggedIn(data);
    showToast(`已登录：${data.current_user.name}`);
  } catch (error) {
    showToast(error.message);
  }
}

async function logout() {
  try {
    await apiJson("/api/logout", { method: "POST", body: JSON.stringify({}) });
  } catch {
    // Local state is still cleared if the session is already gone.
  }
  state.currentUser = null;
  state.claims = [];
  state.users = [];
  state.editingClaimId = null;
  state.currentView = "dashboard";
  els.appShell.hidden = true;
  els.loginScreen.hidden = false;
  els.loginPassword.value = "";
}

function setView(view) {
  const target = canAccess(view) ? view : "dashboard";
  state.currentView = target;
  const titleMap = {
    dashboard: "工作台",
    submit: "提交报销",
    myClaims: "我的进度",
    finance: "财务审核",
    payment: "付款批次",
    ledger: "全量台账",
    people: "人员管理",
  };
  els.pageTitle.textContent = titleMap[target];
  render();
}

function renderAccess() {
  els.roleEyebrow.textContent = state.currentUser.role === "finance" ? "Finance desk" : "Employee desk";
  els.currentUserLabel.innerHTML = `<strong>${escapeHtml(state.currentUser.name)}</strong><span>${escapeHtml(state.currentUser.department)} · ${roleName(state.currentUser.role)}</span>`;
  els.navItems.forEach((item) => {
    item.hidden = !item.dataset.roles.split(",").includes(state.currentUser.role);
    item.classList.toggle("active", item.dataset.view === state.currentView);
  });
  els.views.forEach((item) => item.classList.toggle("active", item.id === `${state.currentView}View`));
}

function renderMetrics() {
  if (state.currentUser.role === "finance") {
    const claims = state.claims;
    const pendingReview = claims.filter((claim) => claim.status === "待财务审核").length;
    const payable = claims.filter((claim) => claim.status === "待付款");
    const issueCount = claims.filter((claim) => claim.issues.length > 0).length;
    const payableAmount = payable.reduce((sum, claim) => sum + Number(claim.total_amount || 0), 0);
    paintMetrics([
      ["待审核", pendingReview, "员工提交后直接进入审核", "#b08a45"],
      ["待付款金额", formatMoney(payableAmount), "可导出银行卡清单", "#245548"],
      ["异常报销", issueCount, "缺附件、金额不一致等", "#315d86"],
    ]);
    return;
  }

  const claims = ownClaims();
  const pendingReview = claims.filter((claim) => claim.status === "待财务审核").length;
  const payable = claims.filter((claim) => claim.status === "待付款").length;
  const rejected = claims.filter((claim) => claim.status === "已驳回").length;
  const paid = claims.filter((claim) => claim.status === "已付款").length;
  paintMetrics([
    ["待财务审核", pendingReview, "已提交，等待财务处理", "#b08a45"],
    ["待付款", payable, "财务已通过，等待付款", "#245548"],
    ["已驳回", rejected, "可修改后重新提交", "#74312f"],
    ["已付款", paid, "财务已完成付款标记", "#315d86"],
  ]);
}

function paintMetrics(metrics) {
  els.metrics.innerHTML = metrics
    .map(
      ([label, value, note, color]) => `
        <div class="metric" style="--accent:${color}">
          <div class="metric-label">${escapeHtml(label)}</div>
          <div class="metric-value">${escapeHtml(value)}</div>
          <div class="metric-note">${escapeHtml(note)}</div>
        </div>
      `,
    )
    .join("");
}

function renderPriorityList() {
  const isFinance = state.currentUser.role === "finance";
  const claims = isFinance ? state.claims : ownClaims();
  els.priorityTitle.textContent = isFinance ? "待处理" : "最近报销进度";
  els.priorityHelp.textContent = isFinance ? "优先处理带异常标签的报销单。" : "查看最近提交、审核和付款状态。";
  els.primaryActionButton.textContent = isFinance ? "进入审核" : "提交报销";
  els.primaryActionButton.onclick = () => setView(isFinance ? "finance" : "submit");

  const records = claims
    .filter((claim) => (isFinance ? claim.status === "待财务审核" : true))
    .sort((a, b) => (isFinance ? b.issues.length - a.issues.length : new Date(b.created_at) - new Date(a.created_at)))
    .slice(0, 5);

  if (!records.length) {
    els.priorityList.innerHTML = `<div class="empty">${isFinance ? "暂无待处理报销单。" : "暂无报销记录。"}</div>`;
    return;
  }

  els.priorityList.innerHTML = records
    .map(
      (claim) => `
        <div class="compact-card">
          <div>
            <div class="compact-title">${isFinance ? `${escapeHtml(claim.employee.name)} · ${escapeHtml(claim.employee.department)}` : `${escapeHtml(claim.id)} · ${escapeHtml(claim.status)}`}</div>
            <div class="compact-meta">${claim.id} / ${formatDate(claim.created_at)} / ${claim.status}</div>
            <div class="compact-meta">${claim.issues.length ? renderTags(claim.issues) : escapeHtml(claim.review_note || "无异常")}</div>
          </div>
          <div class="amount">${formatMoney(claim.total_amount)}</div>
        </div>
      `,
    )
    .join("");
}

function renderTags(tags) {
  return tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
}

function renderCategoryBars() {
  if (state.currentUser.role !== "finance") {
    els.secondaryTitle.textContent = "最近进度";
    els.secondaryHelp.textContent = "只显示当前账号的最近报销。";
    const recent = ownClaims().slice(0, 5);
    els.categoryBars.innerHTML = recent.length
      ? recent
          .map(
            (claim) => `
              <div class="compact-card">
                <div>
                  <div class="compact-title">${claim.id}</div>
                  <div class="compact-meta">${fullDate(claim.created_at)} / ${escapeHtml(claim.review_note || claim.status)}</div>
                </div>
                <div class="amount">${formatMoney(claim.total_amount)}</div>
              </div>
            `,
          )
          .join("")
      : `<div class="empty">暂无报销记录。</div>`;
    return;
  }
  els.secondaryTitle.textContent = "费用分布";
  els.secondaryHelp.textContent = "按费用类型汇总，便于月底复盘。";
  const totals = new Map(state.categories.map((category) => [category, 0]));
  visibleClaims().forEach((claim) => {
    claim.lines.forEach((line) => totals.set(line.category, (totals.get(line.category) || 0) + Number(line.amount || 0)));
  });
  const rows = [...totals.entries()].filter(([, total]) => total > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map(([, total]) => total), 1);
  els.categoryBars.innerHTML = rows.length
    ? rows
        .map(
          ([category, total]) => `
            <div class="bar-row">
              <strong>${escapeHtml(category)}</strong>
              <div class="bar-track"><div class="bar-fill" style="width:${(total / max) * 100}%"></div></div>
              <span>${formatMoney(total)}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="empty">暂无费用数据。</div>`;
}

function renderEmployeeProfile() {
  const missingBank = !state.currentUser.bank_masked || !state.currentUser.bank_name;
  els.submitButton.disabled = missingBank || state.isSubmitting;
  els.submitButton.textContent = state.isSubmitting ? "正在提交..." : state.editingClaimId ? "修改后重新提交" : "提交";
  els.employeeProfile.innerHTML = `
    <div>
      <span class="summary-label">报销人</span>
      <strong>${escapeHtml(state.currentUser.name)}</strong>
    </div>
    <div>
      <span class="summary-label">部门</span>
      <strong>${escapeHtml(state.currentUser.department)}</strong>
    </div>
    <div>
      <span class="summary-label">收款银行卡</span>
      <strong>${missingBank ? "未维护" : `${escapeHtml(state.currentUser.bank_name)} · ${escapeHtml(state.currentUser.bank_masked)}`}</strong>
    </div>
    ${state.editingClaimId ? `<div class="profile-warning neutral">正在编辑 ${escapeHtml(state.editingClaimId)}，提交后会回到待财务审核。</div>` : ""}
    ${missingBank ? '<div class="profile-warning">银行卡信息缺失，请联系财务维护后再提交。</div>' : ""}
  `;
}

function fillCategorySelect(select) {
  select.innerHTML = state.categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
}

function uploadHint(receiptType) {
  if (receiptType === "数电发票") return "仅支持 PDF";
  if (receiptType === "无票据") return "请填写无票据说明";
  return "支持 PDF/JPG/PNG/WEBP";
}

function addLine(defaults = {}) {
  const node = els.lineTemplate.content.firstElementChild.cloneNode(true);
  fillCategorySelect(node.querySelector(".line-type"));
  node.querySelector(".line-date").value = defaults.date || new Date().toISOString().slice(0, 10);
  node.querySelector(".line-type").value = defaults.category || state.categories[0] || "差旅交通";
  node.querySelector(".line-amount").value = defaults.amount || "";
  node.querySelector(".line-purpose").value = defaults.purpose || "";
  const receiptSelect = node.querySelector(".line-receipt");
  const attachmentInput = node.querySelector(".line-attachment");
  const noReceiptField = node.querySelector(".no-receipt-field");
  const noReceiptInput = node.querySelector(".line-no-receipt-note");
  receiptSelect.value = defaults.receipt_type || "数电发票";
  noReceiptInput.value = defaults.no_receipt_note || "";
  node.dataset.invoiceAmount = defaults.invoice_amount ?? "";
  node.dataset.attachmentName = defaults.attachment_name || "";
  node.dataset.attachmentPath = defaults.attachment_path || "";
  const syncAttachmentAccept = () => {
    const digital = receiptSelect.value === "数电发票";
    const noReceipt = receiptSelect.value === "无票据";
    attachmentInput.required = !noReceipt && !node.dataset.attachmentPath;
    attachmentInput.disabled = noReceipt;
    attachmentInput.accept = digital ? "application/pdf,.pdf" : "application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
    noReceiptField.hidden = !noReceipt;
    noReceiptInput.required = noReceipt;
    if (noReceipt) {
      node.querySelector(".invoice-status").textContent = "请填写无票据说明";
    } else if (node.dataset.attachmentName) {
      node.querySelector(".invoice-status").textContent = `已保留：${node.dataset.attachmentName}`;
    } else {
      node.querySelector(".invoice-status").textContent = uploadHint(receiptSelect.value);
    }
  };
  receiptSelect.addEventListener("change", syncAttachmentAccept);
  syncAttachmentAccept();
  node.querySelector(".remove-line").addEventListener("click", () => {
    if (els.lineItems.children.length === 1) {
      showToast("至少保留一条费用明细");
      return;
    }
    node.remove();
  });
  attachmentInput.addEventListener("change", () => {
    const status = node.querySelector(".invoice-status");
    const file = attachmentInput.files[0];
    node.dataset.invoiceAmount = "";
    node.dataset.attachmentName = "";
    node.dataset.attachmentPath = "";
    status.textContent = file ? file.name : uploadHint(receiptSelect.value);
  });
  node.querySelector(".line-amount").addEventListener("input", () => {
    if (receiptSelect.value === "数电发票" && node.dataset.invoiceAmount !== "") {
      const amount = Number(node.querySelector(".line-amount").value || 0);
      const diff = Number(node.dataset.invoiceAmount) - amount;
      node.querySelector(".invoice-status").textContent = `含税金额 ${formatMoney(node.dataset.invoiceAmount)}；差额 ${formatMoney(diff)}`;
    }
  });
  els.lineItems.appendChild(node);
}

async function inspectLineInvoice(node) {
  const input = node.querySelector(".line-attachment");
  const file = input.files[0];
  const receiptType = node.querySelector(".line-receipt").value;
  if (receiptType === "无票据") {
    return { attachment_name: "", attachment_path: "", invoice_amount: null };
  }
  if (!file && node.dataset.attachmentPath) {
    return {
      attachment_name: node.dataset.attachmentName,
      attachment_path: node.dataset.attachmentPath,
      invoice_amount: node.dataset.invoiceAmount === "" ? null : Number(node.dataset.invoiceAmount),
    };
  }
  if (!file) throw new Error("每条非无票据明细都必须上传附件");
  if (receiptType === "数电发票" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("数电发票请上传 PDF 原件");
  }
  const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp"].some((suffix) => file.name.toLowerCase().endsWith(suffix));
  if (!allowed) throw new Error("附件仅支持 PDF、JPG、PNG、WEBP");
  if (file.size > 10 * 1024 * 1024) throw new Error("单个附件不能超过 10MB");

  const form = new FormData();
  form.append("file", file);
  form.append("receipt_type", receiptType);
  const status = node.querySelector(".invoice-status");
  status.textContent = receiptType === "数电发票" ? "正在识别含税金额..." : "正在上传原件...";
  const data = await apiJson("/api/invoices/inspect", { method: "POST", body: form });
  node.dataset.invoiceAmount = data.invoice_amount ?? "";
  node.dataset.attachmentName = data.attachment_name;
  node.dataset.attachmentPath = data.attachment_path;
  if (receiptType === "数电发票") {
    status.textContent = data.invoice_amount == null ? "未识别，请人工核对" : `含税金额 ${formatMoney(data.invoice_amount)}`;
  } else {
    status.textContent = `已上传：${data.attachment_name}`;
  }
  return data;
}

async function readLineItemsWithInvoices() {
  const nodes = [...els.lineItems.querySelectorAll(".line-item")];
  const lines = [];
  const mismatches = [];

  for (const [index, node] of nodes.entries()) {
    const invoice = await inspectLineInvoice(node);
    const amount = Number(node.querySelector(".line-amount").value);
    const purpose = node.querySelector(".line-purpose").value.trim();
    const receiptType = node.querySelector(".line-receipt").value;
    const noReceiptNote = node.querySelector(".line-no-receipt-note").value.trim();
    const line = {
      date: node.querySelector(".line-date").value,
      category: node.querySelector(".line-type").value,
      amount,
      receipt_type: receiptType,
      purpose,
      attachment_name: invoice.attachment_name,
      attachment_path: invoice.attachment_path,
      invoice_amount: invoice.invoice_amount,
      no_receipt_note: noReceiptNote,
    };
    if (!line.date || !line.amount || !line.purpose) throw new Error("请补齐明细日期、报销金额和用途");
    if (line.receipt_type === "无票据" && !line.no_receipt_note) throw new Error(`第 ${index + 1} 条无票据明细需要填写说明`);
    if (line.receipt_type === "数电发票" && invoice.invoice_amount !== null && invoice.invoice_amount !== undefined && Math.abs(Number(invoice.invoice_amount) - amount) > 0.01) {
      mismatches.push(`第 ${index + 1} 条报销明细发票金额与报销金额不一致`);
    }
    lines.push(line);
  }
  return { lines, mismatches };
}

async function handleSubmit(event) {
  event.preventDefault();
  state.isSubmitting = true;
  renderEmployeeProfile();
  try {
    const { lines, mismatches } = await readLineItemsWithInvoices();
    if (mismatches.length) {
      const ok = window.confirm(`${mismatches.join("\n")}\n\n是否继续提交？`);
      if (!ok) return;
    }
    const formData = new FormData(els.expenseForm);
    const path = state.editingClaimId ? `/api/claims/${state.editingClaimId}/supplement` : "/api/claims";
    const data = await apiJson(path, {
      method: state.editingClaimId ? "PATCH" : "POST",
      body: JSON.stringify({ summary: formData.get("summary"), lines }),
    });
    if (state.editingClaimId) {
      state.claims = state.claims.map((claim) => (claim.id === data.claim.id ? data.claim : claim));
    } else {
      state.claims.unshift(data.claim);
    }
    state.editingClaimId = null;
    els.expenseForm.reset();
    els.lineItems.innerHTML = "";
    addLine();
    state.highlightClaimId = data.claim.id;
    showToast(`已提交 ${data.claim.id}，等待财务审核`);
    await refreshClaims();
    setView("myClaims");
    window.setTimeout(() => {
      if (state.highlightClaimId === data.claim.id) {
        state.highlightClaimId = null;
        renderMyClaimRows();
      }
    }, 3600);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.isSubmitting = false;
    renderEmployeeProfile();
  }
}

function renderMyClaimRows() {
  const claims = ownClaims();
  if (!claims.length) {
    els.myClaimRows.innerHTML = `<tr><td colspan="8" class="empty">暂无报销记录。</td></tr>`;
    return;
  }
  els.myClaimRows.innerHTML = claims
    .map(
      (claim) => {
        const actions =
          claim.status === "已驳回"
            ? `<div class="row-actions">
                  <button class="button secondary compact-button" data-view-claim="${claim.id}" type="button">查看</button>
                  <button class="button secondary compact-button" data-edit-claim="${claim.id}" type="button">继续编辑</button>
                  <button class="button danger compact-button" data-delete-claim="${claim.id}" type="button">删除</button>
                </div>`
            : `<button class="button secondary compact-button" data-view-claim="${claim.id}" type="button">查看</button>`;
        return `
        <tr class="${claim.id === state.highlightClaimId ? "highlight-row" : ""}">
          <td><strong>${claim.id}</strong><br><span class="compact-meta">${fullDate(claim.created_at)}</span></td>
          <td class="amount">${formatMoney(claim.total_amount)}</td>
          <td class="amount">${claimInvoiceLabel(claim)}</td>
          <td><span class="status ${statusClass(claim.status)}">${claim.status}</span></td>
          <td>${claim.issues.length ? renderTags(claim.issues) : "无"}</td>
          <td>${escapeHtml(claim.review_note || "-")}</td>
          <td>${claim.paid_at ? fullDate(claim.paid_at) : "-"}</td>
          <td>${actions}</td>
        </tr>
      `;
      },
    )
    .join("");
  els.myClaimRows.querySelectorAll("[data-view-claim]").forEach((button) => {
    button.addEventListener("click", () => openClaimDetail(button.dataset.viewClaim));
  });
  els.myClaimRows.querySelectorAll("[data-edit-claim]").forEach((button) => {
    button.addEventListener("click", () => startClaimEdit(button.dataset.editClaim));
  });
  els.myClaimRows.querySelectorAll("[data-delete-claim]").forEach((button) => {
    button.addEventListener("click", () => deleteRejectedClaim(button.dataset.deleteClaim));
  });
}

function startClaimEdit(id) {
  const claim = state.claims.find((item) => item.id === id);
  if (!claim) return;
  state.editingClaimId = id;
  els.expenseForm.reset();
  els.expenseForm.elements.summary.value = claim.summary || "";
  els.lineItems.innerHTML = "";
  claim.lines.forEach((line) => addLine(line));
  setView("submit");
  showToast(`正在编辑 ${id}`);
}

async function deleteRejectedClaim(id) {
  const ok = window.confirm(`确认删除 ${id}？删除后不可恢复。`);
  if (!ok) return;
  try {
    await apiJson(`/api/claims/${id}`, { method: "DELETE" });
    state.claims = state.claims.filter((claim) => claim.id !== id);
    render();
    showToast("已删除报销单");
  } catch (error) {
    showToast(error.message);
  }
}

function filteredFinanceClaims() {
  const filter = els.financeStatusFilter.value;
  return state.claims.filter((claim) => filter === "all" || claim.status === filter);
}

function renderFinanceRows() {
  const claims = filteredFinanceClaims();
  if (!claims.length) {
    els.financeRows.innerHTML = `<tr><td colspan="8" class="empty">没有符合条件的报销单。</td></tr>`;
    return;
  }
  els.financeRows.innerHTML = claims
    .map(
      (claim) => `
        <tr>
          <td><strong>${claim.id}</strong><br><span class="compact-meta">${formatDate(claim.created_at)}</span></td>
          <td>${escapeHtml(claim.employee.name)}</td>
          <td>${escapeHtml(claim.employee.department)}</td>
          <td class="amount">${formatMoney(claim.total_amount)}</td>
          <td class="amount">${claimInvoiceLabel(claim)}</td>
          <td><span class="status ${statusClass(claim.status)}">${claim.status}</span></td>
          <td>${claim.issues.length ? renderTags(claim.issues) : "无"}</td>
          <td><button class="button secondary" data-review="${claim.id}" type="button">查看</button></td>
        </tr>
      `,
    )
    .join("");
  els.financeRows.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", () => openReview(button.dataset.review));
  });
}

function renderPaymentRows() {
  const claims = state.claims.filter((claim) => claim.status === "待付款");
  if (!claims.length) {
    els.paymentRows.innerHTML = `<tr><td colspan="8" class="empty">暂无待付款报销单。</td></tr>`;
    return;
  }
  els.paymentRows.innerHTML = claims
    .map(
      (claim) => `
        <tr>
          <td><input class="payable-check" data-id="${claim.id}" type="checkbox" /></td>
          <td><strong>${claim.id}</strong></td>
          <td>${escapeHtml(claim.employee.name)}</td>
          <td>${escapeHtml(claim.employee.bank_name || "-")}</td>
          <td>${escapeHtml(claim.employee.bank_masked || "-")}</td>
          <td class="amount">${formatMoney(claim.total_amount)}</td>
          <td>${claim.payment_batch_id ? `<span class="status">已导出</span><br><span class="compact-meta">${escapeHtml(claim.payment_batch_id)}</span>` : '<span class="status warning">未导出</span>'}</td>
          <td>${escapeHtml(claim.summary || claim.employee.department)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderLedgerRows() {
  const query = els.ledgerSearch.value.trim().toLowerCase();
  const type = els.ledgerTypeFilter.value;
  const status = els.ledgerStatusFilter.value;
  const month = els.ledgerMonth.value;
  const rows = [];

  state.claims.forEach((claim) => {
    if (status !== "all" && claim.status !== status) return;
    if (month && claim.created_at.slice(0, 7) !== month) return;
    claim.lines.forEach((line) => {
      const searchable = `${claim.employee.name} ${claim.employee.department} ${line.purpose} ${claim.id}`.toLowerCase();
      if (query && !searchable.includes(query)) return;
      if (type !== "all" && line.category !== type) return;
      rows.push({ claim, line });
    });
  });

  if (!rows.length) {
    els.ledgerRows.innerHTML = `<tr><td colspan="8" class="empty">暂无匹配记录。</td></tr>`;
    return;
  }
  els.ledgerRows.innerHTML = rows
    .map(
      ({ claim, line }) => `
        <tr>
          <td>${formatDate(claim.created_at)}</td>
          <td>${claim.id}</td>
          <td>${escapeHtml(claim.employee.name)}</td>
          <td>${escapeHtml(claim.employee.department)}</td>
          <td>${escapeHtml(line.category)}<br><span class="compact-meta">${escapeHtml(line.purpose)}</span></td>
          <td class="amount">${formatMoney(line.amount)}</td>
          <td><span class="status ${statusClass(claim.status)}">${claim.status}</span></td>
          <td>${claim.paid_at ? formatDate(claim.paid_at) : "-"}</td>
        </tr>
      `,
    )
    .join("");
}

function renderLedgerFilters() {
  els.ledgerTypeFilter.innerHTML = `<option value="all">全部类型</option>${state.categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("")}`;
}

function renderPeopleRows(rows = state.users, preview = false) {
  if (!rows.length) {
    els.peopleRows.innerHTML = `<tr><td colspan="8" class="empty">暂无人员记录。</td></tr>`;
    return;
  }
  els.peopleRows.innerHTML = rows
    .map(
      (user) => {
        const canDelete = !preview && user.active && user.name !== "唐磊" && user.id !== state.currentUser.id;
        return `
        <tr>
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.department)}</td>
          <td><span class="status">${roleName(user.role)}</span></td>
          <td>${escapeHtml(user.bank_name || "-")}</td>
          <td>${escapeHtml(user.bank_account || user.bank_masked || "-")}</td>
          <td>${escapeHtml(user.contact || "-")}</td>
          <td>${preview ? "待导入" : user.active ? "启用" : "停用"}</td>
          <td>${canDelete ? `<button class="button danger compact-button" data-delete-user="${user.id}" data-user-name="${escapeHtml(user.name)}" type="button">删除</button>` : "-"}</td>
        </tr>
      `;
      },
    )
    .join("");
  els.peopleRows.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () => deleteUser(button.dataset.deleteUser, button.dataset.userName));
  });
}

function renderAttachmentPreview(line) {
  if (!line) {
    return `<div class="attachment-preview empty-preview">选择一条有附件的明细后预览原件。</div>`;
  }
  const name = escapeHtml(line.attachment_name || "附件");
  if (fileKind(line.attachment_name) === "image") {
    return `<div class="attachment-preview"><img src="${escapeHtml(line.attachment_url)}" alt="${name}" /></div>`;
  }
  if (fileKind(line.attachment_name) === "pdf") {
    return `<div class="attachment-preview"><iframe src="${escapeHtml(line.attachment_url)}" title="${name}"></iframe></div>`;
  }
  return `<div class="attachment-preview empty-preview"><strong>${name}</strong></div>`;
}

function openClaimDetail(id) {
  const claim = state.claims.find((item) => item.id === id);
  if (!claim) return;
  const previewLine = claim.lines.find((line) => line.attachment_url) || null;
  els.claimDetailTitle.textContent = `${claim.id} · ${claim.status}`;
  els.claimDetailBody.innerHTML = `
    <div class="review-layout">
      <div class="review-left">
        <div class="review-summary dense">
          <div class="summary-cell"><div class="summary-label">报销金额</div><div class="summary-value">${formatMoney(claim.total_amount)}</div></div>
          <div class="summary-cell"><div class="summary-label">发票金额</div><div class="summary-value">${claimInvoiceLabel(claim)}</div></div>
          <div class="summary-cell"><div class="summary-label">状态</div><div class="summary-value">${escapeHtml(claim.status)}</div></div>
          <div class="summary-cell"><div class="summary-label">提交时间</div><div class="summary-value">${fullDate(claim.created_at)}</div></div>
          <div class="summary-cell"><div class="summary-label">付款时间</div><div class="summary-value">${claim.paid_at ? fullDate(claim.paid_at) : "-"}</div></div>
          <div class="summary-cell"><div class="summary-label">财务备注</div><div class="summary-value">${escapeHtml(claim.review_note || "-")}</div></div>
        </div>
        <p>${escapeHtml(claim.summary || "无额外说明")}</p>
        <div>${claim.issues.length ? renderTags(claim.issues) : '<span class="tag">无异常</span>'}</div>
        <div class="table-wrap review-lines">
          <table>
            <thead>
              <tr><th>#</th><th>日期/类型</th><th>用途</th><th>报销金额</th><th>发票金额</th><th>差额</th><th>原件</th></tr>
            </thead>
            <tbody>
              ${claim.lines
                .map((line, index) => {
                  const diff = lineDifference(line);
                  return `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${escapeHtml(line.date)}<br><span class="compact-meta">${escapeHtml(line.category)} · ${escapeHtml(line.receipt_type)}</span></td>
                      <td>${escapeHtml(line.purpose)}${line.no_receipt_note ? `<br><span class="compact-meta">无票据说明：${escapeHtml(line.no_receipt_note)}</span>` : ""}</td>
                      <td>${formatMoney(line.amount)}</td>
                      <td>${lineInvoiceLabel(line)}</td>
                      <td>${diff == null ? "-" : formatMoney(diff)}</td>
                      <td>${
                        line.attachment_url
                          ? `<button class="link-button" data-detail-attachment="${index}" type="button">${escapeHtml(line.attachment_name || "打开原件")}</button>`
                          : "-"
                      }</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      <aside class="review-right">
        <div class="preview-head">
          <strong>原件预览</strong>
          <span>${previewLine ? escapeHtml(previewLine.attachment_name) : "暂无附件"}</span>
        </div>
        <div>${renderAttachmentPreview(previewLine)}</div>
      </aside>
    </div>
  `;
  els.claimDetailBody.querySelectorAll("[data-detail-attachment]").forEach((button) => {
    button.addEventListener("click", () => {
      const line = claim.lines[Number(button.dataset.detailAttachment)];
      if (line?.attachment_url) window.open(line.attachment_url, "_blank", "noopener");
    });
  });
  if (!els.claimDetailDialog.open) els.claimDetailDialog.showModal();
}

function openReview(id) {
  const claim = state.claims.find((item) => item.id === id);
  if (!claim) return;
  state.reviewId = id;
  state.previewLineIndex = Math.max(0, claim.lines.findIndex((line) => line.attachment_url));
  const previewLine = claim.lines[state.previewLineIndex]?.attachment_url ? claim.lines[state.previewLineIndex] : null;
  els.dialogTitle.textContent = `${claim.id} · ${claim.employee.name}`;
  els.reviewNote.value = claim.review_note || "";
  els.reviewNote.placeholder = "驳回时请说明原因；通过审核可选填";
  els.dialogBody.innerHTML = `
    <div class="review-layout">
      <div class="review-left">
        <div class="review-summary dense">
          <div class="summary-cell"><div class="summary-label">报销人</div><div class="summary-value">${escapeHtml(claim.employee.name)}</div></div>
          <div class="summary-cell"><div class="summary-label">部门</div><div class="summary-value">${escapeHtml(claim.employee.department)}</div></div>
          <div class="summary-cell"><div class="summary-label">报销金额</div><div class="summary-value">${formatMoney(claim.total_amount)}</div></div>
          <div class="summary-cell"><div class="summary-label">发票金额</div><div class="summary-value">${claimInvoiceLabel(claim)}</div></div>
          <div class="summary-cell"><div class="summary-label">状态</div><div class="summary-value">${claim.status}</div></div>
          <div class="summary-cell"><div class="summary-label">银行卡</div><div class="summary-value">${escapeHtml(claim.employee.bank_masked || "-")}</div></div>
        </div>
        <p>${escapeHtml(claim.summary || "无额外说明")}</p>
        <div>${claim.issues.length ? renderTags(claim.issues) : '<span class="tag">无异常</span>'}</div>
        <div class="table-wrap review-lines">
          <table>
            <thead>
              <tr><th>#</th><th>日期/类型</th><th>用途</th><th>报销金额</th><th>发票金额</th><th>差额</th><th>异常</th><th>原件</th></tr>
            </thead>
            <tbody>
              ${claim.lines
                .map((line, index) => {
                  const diff = lineDifference(line);
                  return `
                    <tr class="${index === state.previewLineIndex ? "selected-line" : ""}">
                      <td>${index + 1}</td>
                      <td>${escapeHtml(line.date)}<br><span class="compact-meta">${escapeHtml(line.category)} · ${escapeHtml(line.receipt_type)}</span></td>
                      <td>${escapeHtml(line.purpose)}${line.no_receipt_note ? `<br><span class="compact-meta">无票据说明：${escapeHtml(line.no_receipt_note)}</span>` : ""}</td>
                      <td>${formatMoney(line.amount)}</td>
                      <td>${lineInvoiceLabel(line)}</td>
                      <td>${diff == null ? "-" : formatMoney(diff)}</td>
                      <td>${line.issues?.length ? renderTags(line.issues) : "无"}</td>
                      <td>${
                        line.attachment_url
                          ? `<button class="link-button" data-open-attachment="${index}" type="button">${escapeHtml(line.attachment_name || "打开原件")}</button>`
                          : "-"
                      }</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      <aside class="review-right">
        <div class="preview-head">
          <strong>原件预览</strong>
          <span>${previewLine ? escapeHtml(previewLine.attachment_name) : "暂无附件"}</span>
        </div>
        <div id="attachmentPreview">${renderAttachmentPreview(previewLine)}</div>
      </aside>
    </div>
  `;
  els.dialogBody.querySelectorAll("[data-open-attachment]").forEach((button) => {
    button.addEventListener("click", () => {
      const line = claim.lines[Number(button.dataset.openAttachment)];
      if (line?.attachment_url) window.open(line.attachment_url, "_blank", "noopener");
    });
  });
  if (!els.reviewDialog.open) els.reviewDialog.showModal();
}

async function updateReviewStatus(status) {
  const claim = state.claims.find((item) => item.id === state.reviewId);
  if (!claim) return;
  const note = els.reviewNote.value.trim();
  if (status === "已驳回" && !note) {
    showToast("请先填写审核备注");
    els.reviewNote.focus();
    return;
  }
  try {
    await apiJson(`/api/claims/${claim.id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ status, review_note: note }),
    });
    els.reviewDialog.close();
    showToast(`${claim.id} 已更新为：${status}`);
    await refreshClaims();
  } catch (error) {
    showToast(error.message);
  }
}

function selectedPayableIds() {
  return [...document.querySelectorAll(".payable-check:checked")].map((input) => input.dataset.id);
}

async function exportPayments() {
  const ids = selectedPayableIds().filter((id) => {
    const claim = state.claims.find((item) => item.id === id);
    return claim && !claim.payment_batch_id;
  });
  if (!ids.length) {
    showToast("请选择未导出的待付款记录");
    return;
  }
  try {
    const response = await fetch("/api/payments/export", {
      method: "POST",
      credentials: "same-origin",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "导出失败");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `付款清单-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${ids.length} 条付款记录`);
    await refreshClaims();
  } catch (error) {
    showToast(error.message);
  }
}

async function markSelectedPaid() {
  const ids = selectedPayableIds();
  if (!ids.length) {
    showToast("请先选择已付款记录");
    return;
  }
  try {
    const data = await apiJson("/api/payments/mark-paid", { method: "POST", body: JSON.stringify({ ids }) });
    state.claims = data.claims;
    showToast(`已标记 ${data.paid} 条为已付款`);
    render();
  } catch (error) {
    showToast(error.message);
  }
}

async function exportLedger() {
  try {
    const response = await fetch("/api/ledger/export", { credentials: "same-origin" });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "导出台账失败");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `报销台账-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("台账已导出");
  } catch (error) {
    showToast(error.message);
  }
}

async function previewStaffImport() {
  const file = els.staffFile.files[0];
  if (!file) return;
  const form = new FormData();
  form.append("file", file);
  try {
    const data = await apiJson("/api/users/import/preview", { method: "POST", body: form });
    state.importRows = data.rows;
    state.importErrors = data.errors || [];
    state.importSummary = data.summary || null;
    renderImportPreview();
  } catch (error) {
    state.importRows = [];
    state.importErrors = [error.message];
    state.importSummary = null;
    renderImportPreview();
  }
}

function renderImportPreview() {
  els.confirmImportButton.disabled = !state.importRows.length || state.importErrors.length > 0;
  const summary = state.importSummary;
  const summaryHtml = summary
    ? `<div class="import-summary">
        <span>总人数 ${summary.total}</span>
        <span>新增 ${summary.new_count}</span>
        <span>停用 ${summary.disabled_count}</span>
        <span>缺银行卡 ${summary.missing_bank_count}</span>
        <span>${summary.finance_ok ? "财务角色正确" : "财务角色异常"}</span>
      </div>`
    : "";
  els.importErrors.innerHTML = state.importErrors.length
    ? state.importErrors.map((error) => `<div>${escapeHtml(error)}</div>`).join("")
    : state.importRows.length
      ? `<div class="ok">预览通过。确认后会替换当前启用名单。</div>${summaryHtml}`
      : "";
  renderPeopleRows(state.importRows.length ? state.importRows : state.users, state.importRows.length > 0);
}

async function confirmStaffImport() {
  if (!state.importRows.length || state.importErrors.length) return;
  const summary = state.importSummary;
  const ok = window.confirm(`确认导入全员名单？\n新增：${summary?.new_count ?? 0} 人\n停用：${summary?.disabled_count ?? 0} 人\n缺银行卡：${summary?.missing_bank_count ?? 0} 人`);
  if (!ok) return;
  try {
    const data = await apiJson("/api/users/import/confirm", {
      method: "POST",
      body: JSON.stringify({ rows: state.importRows }),
    });
    state.users = data.users;
    state.importRows = [];
    state.importErrors = [];
    state.importSummary = null;
    showToast(`已导入 ${data.imported} 名员工`);
    await loadLoginOptions();
    renderPeopleRows();
  } catch (error) {
    state.importErrors = [error.message];
    renderImportPreview();
  }
}

async function addManualPerson(event) {
  event.preventDefault();
  const form = new FormData(els.manualPersonForm);
  const payload = Object.fromEntries(form.entries());
  try {
    const data = await apiJson("/api/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.users = data.users;
    state.importRows = [];
    state.importErrors = [];
    state.importSummary = null;
    els.manualPersonForm.reset();
    await loadLoginOptions();
    renderImportPreview();
    showToast("人员已保存");
  } catch (error) {
    state.importErrors = [error.message];
    renderImportPreview();
  }
}

async function deleteUser(id, name) {
  const ok = window.confirm(`确认删除 ${name}？删除后该员工将不能再登录。`);
  if (!ok) return;
  try {
    const data = await apiJson(`/api/users/${id}`, { method: "DELETE" });
    state.users = data.users;
    state.importRows = [];
    state.importErrors = [];
    state.importSummary = null;
    await loadLoginOptions();
    renderImportPreview();
    showToast("人员已删除");
  } catch (error) {
    state.importErrors = [error.message];
    renderImportPreview();
  }
}

async function refreshClaims() {
  const data = await apiJson("/api/claims");
  state.claims = data.claims;
  render();
}

async function resetDemo() {
  const ok = window.prompt("恢复演示数据会替换人员和报销记录。请输入 RESET 确认。");
  if (ok !== "RESET") return;
  try {
    const data = await apiJson("/api/reset-demo", { method: "POST", body: JSON.stringify({ confirm: "RESET" }) });
    state.currentUser = data.current_user;
    state.users = data.users;
    state.claims = data.claims;
    state.importRows = [];
    state.importErrors = [];
    state.importSummary = null;
    await loadLoginOptions();
    setView("dashboard");
    showToast("演示数据已恢复");
  } catch (error) {
    showToast(error.message);
  }
}

function render() {
  if (!state.currentUser) return;
  renderAccess();
  renderMetrics();
  renderPriorityList();
  renderCategoryBars();
  renderEmployeeProfile();
  renderMyClaimRows();
  if (state.currentUser.role === "finance") {
    renderFinanceRows();
    renderPaymentRows();
    renderLedgerRows();
    if (!state.importRows.length) renderPeopleRows();
  }
}

function bindEvents() {
  els.loginDepartment.addEventListener("change", renderLoginNames);
  els.loginName.addEventListener("change", renderPasswordField);
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", logout);
  els.navItems.forEach((item) => item.addEventListener("click", () => setView(item.dataset.view)));
  els.addLineButton.addEventListener("click", () => addLine());
  els.expenseForm.addEventListener("submit", handleSubmit);
  els.financeStatusFilter.addEventListener("change", renderFinanceRows);
  [els.ledgerSearch, els.ledgerMonth, els.ledgerTypeFilter, els.ledgerStatusFilter].forEach((el) => el.addEventListener("input", renderLedgerRows));
  els.approveButton.addEventListener("click", () => updateReviewStatus("待付款"));
  els.rejectButton.addEventListener("click", () => updateReviewStatus("已驳回"));
  els.exportButton.addEventListener("click", exportPayments);
  els.markPaidButton.addEventListener("click", markSelectedPaid);
  els.exportLedgerButton.addEventListener("click", exportLedger);
  if (els.seedButton) els.seedButton.addEventListener("click", resetDemo);
  els.staffFile.addEventListener("change", previewStaffImport);
  els.confirmImportButton.addEventListener("click", confirmStaffImport);
  els.manualPersonForm.addEventListener("submit", addManualPerson);
  els.selectAllPayables.addEventListener("change", () => {
    document.querySelectorAll(".payable-check").forEach((input) => {
      input.checked = els.selectAllPayables.checked;
    });
  });
}

async function init() {
  bindEvents();
  try {
    await loadLoginOptions();
  } catch (error) {
    showToast(error.message);
  }
}

init();
