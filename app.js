"use strict";

// =========================
// Config
// =========================
const STORAGE_KEY = "daily-sales-log-v1";
const IDEAS_STORAGE_KEY = "project-ideas-v1";
const SUPABASE_PROJECT_ID = "navqvljmipzheqjmlzgt";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hdnF2bGptaXB6aGVxam1semd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTAzNzQsImV4cCI6MjA5MjM2NjM3NH0.xDeyeaAhcyjuLEWUOfDRQKdjDUDiQNfw6UMlcdm5n2k";
const SUPABASE_TABLE = "sales_records";

const LOG_PREFIX = "[daily-sales]";
const AUTH_MESSAGES = {
  invalidGmail: "أدخل Gmail صحيح.",
  shortPassword: "كلمة المرور لازم تكون 6 أحرف على الأقل.",
  wrongPassword: "كلمة المرور خاطئة لهذا الحساب."
};

// =========================
// Logging helpers
// =========================
function log(level, event, data) {
  const line = `${LOG_PREFIX} ${event}`;
  const payload = data === undefined ? "" : data;
  if (level === "error") console.error(line, payload);
  else if (level === "warn") console.warn(line, payload);
  else console.info(line, payload);
}

function authTrace(step, data) {
  const payload = data === undefined ? "" : data;
  console.info(`[auth-trace] ${step}`, payload);
}

function safeEmailForLog(email) {
  const e = String(email || "");
  const at = e.indexOf("@");
  if (at <= 1) return e ? `${e[0]}***` : "";
  return `${e[0]}***@${e.slice(at + 1)}`;
}

const dom = {
  form: document.getElementById("saleForm"),
  ideaForm: document.getElementById("ideaForm"),
  rowsContainer: document.getElementById("rows"),
  ideaRowsContainer: document.getElementById("ideaRows"),
  emptyState: document.getElementById("emptyState"),
  ideasEmptyState: document.getElementById("ideasEmptyState"),
  resetBtn: document.getElementById("resetData"),
  resetIdeasBtn: document.getElementById("resetIdeas"),
  appPage: document.getElementById("appPage"),
  authPage: document.getElementById("authPage"),
  authForm: document.getElementById("authForm"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  loginBtn: document.getElementById("loginBtn"),
  signupBtn: document.getElementById("signupBtn"),
  resetPasswordBtn: document.getElementById("resetPasswordBtn"),
  logoutBtnApp: document.getElementById("logoutBtnApp"),
  showSalesSectionBtn: document.getElementById("showSalesSectionBtn"),
  showIdeasSectionBtn: document.getElementById("showIdeasSectionBtn"),
  salesSectionCard: document.getElementById("salesSectionCard"),
  ideasSectionCard: document.getElementById("ideasSectionCard"),
  authStatus: document.getElementById("authStatus"),
  syncStatus: document.getElementById("syncStatus"),
  debtFullyPaid: document.getElementById("debtFullyPaid"),
  ideaAdvice: document.getElementById("ideaAdvice"),
  fields: {
    date: document.getElementById("date"),
    product: document.getElementById("product"),
    description: document.getElementById("description"),
    totalSale: document.getElementById("totalSale"),
    unpaidAmount: document.getElementById("unpaidAmount"),
    cost: document.getElementById("cost")
  },
  ideaFields: {
    name: document.getElementById("ideaName"),
    description: document.getElementById("ideaDescription"),
    capital: document.getElementById("ideaCapital"),
    price: document.getElementById("ideaPrice"),
    qty: document.getElementById("ideaQty")
  },
  ideaTotals: {
    expectedSalesEl: document.getElementById("ideaExpectedSales"),
    expectedProfitEl: document.getElementById("ideaExpectedProfit")
  },
  totals: {
    totalSalesEl: document.getElementById("totalSales"),
    totalProfitEl: document.getElementById("totalProfit"),
    totalReinvestEl: document.getElementById("totalReinvest"),
    totalNetProfitEl: document.getElementById("totalNetProfit"),
    currentCapitalEl: document.getElementById("currentCapital"),
    totalUnpaidEl: document.getElementById("totalUnpaid"),
    totalPaidEl: document.getElementById("totalPaid")
  },
  insights: {
    donutEl: document.getElementById("insightDonut"),
    donutHintEl: document.getElementById("insightDonutHint"),
    lineEl: document.getElementById("insightLine"),
    lineHintEl: document.getElementById("insightLineHint"),
    bestIdeasListEl: document.getElementById("bestIdeasList")
  }
};

const state = {
  db: null,
  currentUser: null,
  records: [],
  ideas: [],
  authBusy: false,
  authEventsBound: false
};

function showFatalUiError(message) {
  if (!dom.authStatus) return;
  dom.authStatus.textContent = `عطل JavaScript: ${message}`;
  dom.authStatus.classList.remove("ok");
}

if (!globalThis.__dailySalesGlobalErrorBound) {
  globalThis.__dailySalesGlobalErrorBound = true;
  globalThis.addEventListener("error", (event) => {
    const message = event?.error?.message || event?.message || "خطأ غير معروف";
    showFatalUiError(message);
  });
}

// =========================
// Supabase config validation
// =========================
function parseJwtPayload(token) {
  try {
    const part = String(token || "").split(".")[1] || "";
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function validateSupabaseConfig() {
  const hostProjectId = (() => {
    try {
      return new URL(SUPABASE_URL).hostname.split(".")[0];
    } catch {
      return "";
    }
  })();

  if (hostProjectId !== SUPABASE_PROJECT_ID) {
    return `رابط Supabase لا يطابق Project ID. المتوقع: ${SUPABASE_PROJECT_ID}`;
  }
  const payload = parseJwtPayload(SUPABASE_ANON_KEY);
  if (!payload?.ref) return "مفتاح anon غير صالح (JWT payload/ref مفقود).";
  if (payload.ref !== SUPABASE_PROJECT_ID) {
    return `مفتاح anon لا يخص المشروع الحالي. المتوقع ref=${SUPABASE_PROJECT_ID}، الحالي ref=${payload.ref}`;
  }
  return "";
}

// =========================
// UI state helpers
// =========================
function setAuthStatus(text, ok = false) {
  dom.authStatus.textContent = text;
  dom.authStatus.classList.toggle("ok", ok);
  log("info", "auth_status", { text, ok });
}

function setSyncStatus(text, ok = false) {
  if (!dom.syncStatus) return;
  dom.syncStatus.textContent = text;
  dom.syncStatus.classList.toggle("ok", ok);
  log("info", "sync_status", { text, ok });
}

function setAuthBusy(isBusy) {
  state.authBusy = isBusy;
  log("info", "auth_busy", { busy: isBusy });
  refreshAuthButtons();
}

function refreshAuthButtons() {
  if (dom.loginBtn) dom.loginBtn.disabled = state.authBusy;
  if (dom.signupBtn) dom.signupBtn.disabled = state.authBusy;
  if (dom.resetPasswordBtn) dom.resetPasswordBtn.disabled = state.authBusy;
}

function ensureSupabaseClient() {
  authTrace("ensure_client:start", { hasExistingDb: !!state.db });
  if (state.db) return true;
  const cfgError = validateSupabaseConfig();
  if (!globalThis.supabase?.createClient || cfgError) {
    authTrace("ensure_client:failed", { cfgError: cfgError || null, hasCreateClient: !!globalThis.supabase?.createClient });
    log("warn", "supabase_client_unavailable", { cfgError: cfgError || null, hasCreateClient: !!globalThis.supabase?.createClient });
    return false;
  }
  state.db = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  authTrace("ensure_client:ok", { projectId: SUPABASE_PROJECT_ID });
  return true;
}

// =========================
// Auth helpers
// =========================
function getAuthEmail() {
  return String(dom.emailInput?.value || "").trim().toLowerCase();
}

function getAuthPassword() {
  return String(dom.passwordInput?.value || "");
}

function getAuthCredentials() {
  return { email: getAuthEmail(), password: getAuthPassword() };
}

function validateAuthInputs() {
  const { email, password } = getAuthCredentials();
  authTrace("validate_auth_inputs", { emailMasked: safeEmailForLog(email), passwordLength: password.length });
  const emailRegex = /^[^\s@]+@gmail\.com$/i;
  if (!emailRegex.test(email)) {
    authTrace("validate_auth_inputs:invalid_email", { emailMasked: safeEmailForLog(email) });
    return { ok: false, message: AUTH_MESSAGES.invalidGmail };
  }
  if (password.length < 6) {
    authTrace("validate_auth_inputs:short_password", { passwordLength: password.length });
    return { ok: false, message: AUTH_MESSAGES.shortPassword };
  }
  authTrace("validate_auth_inputs:ok", {});
  return { ok: true, message: "" };
}

function validateEmailOnly() {
  const email = getAuthEmail();
  authTrace("validate_email_only", { emailMasked: safeEmailForLog(email) });
  const emailRegex = /^[^\s@]+@gmail\.com$/i;
  if (!emailRegex.test(email)) {
    authTrace("validate_email_only:invalid_email", { emailMasked: safeEmailForLog(email) });
    return { ok: false, message: AUTH_MESSAGES.invalidGmail };
  }
  authTrace("validate_email_only:ok", {});
  return { ok: true, message: "" };
}

function formatAuthError(error, actionLabel) {
  if (!error) return `${actionLabel} فشل لسبب غير معروف.`;
  const details = [error.message].filter(Boolean).join(" | ");
  const msg = String(error.message || "").toLowerCase();
  if (error.status === 429) return `تم تجاوز عدد المحاولات. انتظر قليلًا ثم حاول مجددًا. (${details})`;
  if (msg.includes("invalid login credentials")) return "بيانات الدخول غير صحيحة.";
  if (msg.includes("email not confirmed")) return "الحساب يحتاج تأكيد البريد من إعدادات Supabase.";
  if (error.status === 400) return `${actionLabel} فشل: تحقق من Gmail/كلمة المرور. (${details})`;
  return `${actionLabel} فشل: ${details}`;
}

function parseRetryAfterSeconds(error) {
  const msg = String(error?.message || "");
  const m = msg.match(/after\s+(\d+)\s+seconds?/i);
  return m ? Number(m[1]) : 0;
}

function formatRateLimitMessage(error) {
  const sec = parseRetryAfterSeconds(error);
  if (sec > 0) return `تم تجاوز عدد المحاولات. انتظر ${sec} ثانية ثم حاول مجددًا.`;
  return "تم تجاوز عدد المحاولات. انتظر قليلًا ثم حاول مجددًا.";
}

function isUserAlreadyRegisteredError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("user already registered");
}

async function signUpWithEmailPassword(email, password) {
  authTrace("sign_up_api:start", { emailMasked: safeEmailForLog(email), passwordLength: String(password || "").length });
  return state.db.auth.signUp({ email, password, options: { data: { email } } });
}

function getPasswordResetOptions() {
  // When running from file://, redirect URL is invalid for Supabase and blocks reset emails.
  if (globalThis.location?.protocol === "file:") return {};
  return { redirectTo: `${globalThis.location.origin}${globalThis.location.pathname}` };
}

function getSupabaseStorageKey() {
  return `sb-${SUPABASE_PROJECT_ID}-auth-token`;
}

function readStoredSessionTokens() {
  try {
    const raw = localStorage.getItem(getSupabaseStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession || parsed?.session || parsed;
    if (!session?.access_token || !session?.refresh_token) return null;
    return { access_token: session.access_token, refresh_token: session.refresh_token };
  } catch {
    return null;
  }
}


function setPageMode(isLoggedIn) {
  // Reset any inline display overrides first.
  if (dom.appPage) dom.appPage.style.display = "";
  if (dom.authPage) dom.authPage.style.display = "";

  dom.appPage.classList.toggle("hidden", !isLoggedIn);
  dom.authPage.classList.toggle("hidden", isLoggedIn);
  if (dom.appPage.classList.contains("hidden") && dom.authPage.classList.contains("hidden")) {
    dom.authPage.classList.remove("hidden");
  }
}

function forceShowApp() {
  // Hard fallback to avoid being stuck on auth screen.
  if (dom.appPage) {
    dom.appPage.classList.remove("hidden");
    dom.appPage.style.display = "";
  }
  if (dom.authPage) {
    dom.authPage.classList.add("hidden");
    dom.authPage.style.display = "none";
  }
}

function setAppEnabled(enabled) {
  for (const el of dom.form.querySelectorAll("input, textarea, button")) el.disabled = !enabled;
  for (const btn of dom.rowsContainer.querySelectorAll("button[data-debt-paid]")) btn.disabled = !enabled;
  dom.resetBtn.disabled = !enabled;
}

function setActiveSection(section) {
  const showSales = section !== "ideas";
  dom.salesSectionCard?.classList.toggle("hidden", !showSales);
  dom.ideasSectionCard?.classList.toggle("hidden", showSales);
  dom.showSalesSectionBtn?.classList.toggle("active", showSales);
  dom.showIdeasSectionBtn?.classList.toggle("active", !showSales);
}

async function activateAppForUser(user, statusSuffix = "") {
  authTrace("activate_app:start", { userId: user?.id || null, statusSuffix });
  if (!user) return;
  state.currentUser = user;

  // Open app UI immediately after successful auth.
  setPageMode(true);
  forceShowApp();
  setAppEnabled(true);
  setAuthStatus(`تم تسجيل الدخول: ${state.currentUser.phone || state.currentUser.id}${statusSuffix}`, true);

  try {
    const local = loadRecords();
    state.ideas = loadIdeas();
    const remote = await loadRecordsFromRemote();
    authTrace("activate_app:data_loaded", { localCount: local.length, remoteCount: remote.length, ideasCount: state.ideas.length });
    if (remote.length === 0 && local.length > 0) {
      await upsertManyRemote(local);
      state.records = local;
      authTrace("activate_app:using_local_and_uploaded", { count: local.length });
    } else {
      state.records = remote;
      authTrace("activate_app:using_remote", { count: remote.length });
    }
    saveRecords();
    render();
    renderIdeas();
    renderIdeasPreview();
    authTrace("activate_app:ui_synced", { records: state.records.length });
  } catch (err) {
    authTrace("activate_app:sync_error", { message: err?.message || "unknown" });
    // Keep user inside app even if sync fails.
    render();
    renderIdeas();
    renderIdeasPreview();
    setSyncStatus(`تعذر مزامنة بعض البيانات: ${err?.message || "خطأ غير معروف"}`, false);
  }
}

// =========================
// Records and calculations
// =========================
function newRecordId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currency(value) {
  return `${Number(value).toFixed(2)} د`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function userStorageKey() {
  return state.currentUser ? `${STORAGE_KEY}:${state.currentUser.id}` : STORAGE_KEY;
}

function userIdeasStorageKey() {
  return state.currentUser ? `${IDEAS_STORAGE_KEY}:${state.currentUser.id}` : IDEAS_STORAGE_KEY;
}

function backupStorageKey() {
  return `${STORAGE_KEY}:backup`;
}

function backupIdeasStorageKey() {
  return `${IDEAS_STORAGE_KEY}:backup`;
}

function clampUnpaid(totalSale, unpaidRaw) {
  const t = Number(totalSale) || 0;
  let u = Number(unpaidRaw);
  if (!Number.isFinite(u) || u < 0) u = 0;
  if (u > t) u = t;
  return u;
}

function originalUnpaid(record) {
  return clampUnpaid(record.totalSale, record.unpaidAmount ?? record.unpaid ?? 0);
}

function remainingUnpaid(record) {
  return record.debtCleared ? 0 : originalUnpaid(record);
}

function collectedFromCustomer(record) {
  return (Number(record.totalSale) || 0) - remainingUnpaid(record);
}

function normalizeRecordsStep1(list) {
  return list.map((r) => {
    if (typeof r.description === "string" && r.totalSale != null) return r;
    const totalSale = r.totalSale != null ? Number(r.totalSale) : Number(r.qty || 0) * Number(r.unitPrice || 0);
    const description = typeof r.description === "string" ? r.description : r.qty != null ? `عدد الوحدات: ${r.qty}` : "";
    const { qty, unitPrice, ...rest } = r;
    return { ...rest, description, totalSale };
  });
}

function normalizeRecordsStep2(list) {
  return list.map((r) => ({
    ...r,
    unpaidAmount: clampUnpaid(r.totalSale, r.unpaidAmount ?? r.unpaid),
    debtCleared: !!r.debtCleared,
    debtClearedAt: r.debtClearedAt || null
  }));
}

function loadRecords() {
  try {
    let raw = localStorage.getItem(userStorageKey());
    if (!raw) raw = localStorage.getItem(backupStorageKey());
    if (!raw) raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = normalizeRecordsStep2(normalizeRecordsStep1(Array.isArray(parsed) ? parsed : []));
    log("info", "local_load", { key: userStorageKey(), count: list.length });
    return list;
  } catch {
    log("warn", "local_load_failed", { key: userStorageKey() });
    return [];
  }
}

function saveRecords() {
  const payload = JSON.stringify(state.records);
  localStorage.setItem(userStorageKey(), payload);
  localStorage.setItem(backupStorageKey(), payload);
  log("info", "local_save", { key: userStorageKey(), count: state.records.length });
}

function loadIdeas() {
  try {
    let raw = localStorage.getItem(userIdeasStorageKey());
    if (!raw) raw = localStorage.getItem(backupIdeasStorageKey());
    if (!raw) raw = localStorage.getItem(IDEAS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    log("info", "ideas_local_load", { key: userIdeasStorageKey(), count: list.length });
    return list;
  } catch {
    log("warn", "ideas_local_load_failed", { key: userIdeasStorageKey() });
    return [];
  }
}

function saveIdeas() {
  const payload = JSON.stringify(state.ideas);
  localStorage.setItem(userIdeasStorageKey(), payload);
  localStorage.setItem(backupIdeasStorageKey(), payload);
  log("info", "ideas_local_save", { key: userIdeasStorageKey(), count: state.ideas.length });
}

async function loadRecordsFromRemote() {
  if (!state.db || !state.currentUser) return [];
  log("info", "remote_select_start", { table: SUPABASE_TABLE, ownerId: state.currentUser.id });
  const { data, error } = await state.db
    .from(SUPABASE_TABLE)
    .select("payload, created_at")
    .eq("owner_id", state.currentUser.id)
    .order("created_at", { ascending: false });
  if (error) {
    log("error", "remote_select_error", { message: error.message, status: error.status, code: error.code });
    setAuthStatus(`فشل قراءة البيانات من Supabase: ${error.message}`, false);
    setSyncStatus(`فشل القراءة من Supabase: ${error.message}`, false);
    return [];
  }
  const rows = (data || []).length;
  log("info", "remote_select_ok", { rows });
  setSyncStatus("تم تحميل البيانات من Supabase.", true);
  return normalizeRecordsStep2(normalizeRecordsStep1((data || []).map((row) => row.payload).filter(Boolean)));
}

async function upsertRecordRemote(record) {
  if (!state.db || !state.currentUser) return false;
  log("info", "remote_upsert_one_start", { recordId: record?.recordId, ownerId: state.currentUser.id });
  const { error } = await state.db
    .from(SUPABASE_TABLE)
    .upsert({ record_id: record.recordId, owner_id: state.currentUser.id, payload: record }, { onConflict: "record_id" });
  if (error) {
    log("error", "remote_upsert_one_error", { message: error.message, status: error.status, code: error.code, recordId: record?.recordId });
    setAuthStatus(`فشل حفظ سجل في Supabase: ${error.message}`, false);
    setSyncStatus(`فشل الحفظ: ${error.message}`, false);
    return false;
  }
  log("info", "remote_upsert_one_ok", { recordId: record?.recordId });
  setSyncStatus("تم حفظ السجل على Supabase.", true);
  return true;
}

async function upsertManyRemote(list) {
  if (!state.db || !state.currentUser || list.length === 0) return true;
  log("info", "remote_upsert_many_start", { count: list.length, ownerId: state.currentUser.id });
  const rows = list.map((record) => ({ record_id: record.recordId, owner_id: state.currentUser.id, payload: record }));
  const { error } = await state.db.from(SUPABASE_TABLE).upsert(rows, { onConflict: "record_id" });
  if (error) {
    log("error", "remote_upsert_many_error", { message: error.message, status: error.status, code: error.code, count: list.length });
    setAuthStatus(`فشل مزامنة البيانات مع Supabase: ${error.message}`, false);
    setSyncStatus(`فشل المزامنة: ${error.message}`, false);
    return false;
  }
  log("info", "remote_upsert_many_ok", { count: list.length });
  setSyncStatus("تمت مزامنة البيانات المحلية مع Supabase.", true);
  return true;
}

async function deleteAllRemote() {
  if (!state.db || !state.currentUser) return false;
  log("warn", "remote_delete_all_start", { ownerId: state.currentUser.id });
  const { error } = await state.db.from(SUPABASE_TABLE).delete().eq("owner_id", state.currentUser.id);
  if (error) {
    log("error", "remote_delete_all_error", { message: error.message, status: error.status, code: error.code });
    setAuthStatus(`فشل حذف البيانات من Supabase: ${error.message}`, false);
    setSyncStatus(`فشل الحذف: ${error.message}`, false);
    return false;
  }
  log("warn", "remote_delete_all_ok", { ownerId: state.currentUser.id });
  setSyncStatus("تم حذف بياناتك من Supabase.", true);
  return true;
}

function computeRecord(base) {
  const totalSale = Number(base.totalSale);
  const unpaidAmount = clampUnpaid(totalSale, base.unpaidAmount);
  const profit = totalSale - base.cost;
  const reinvest = profit * 0.1;
  const netProfit = profit - reinvest;
  const newCapital = base.cost + reinvest;
  return {
    date: base.date,
    product: base.product,
    description: base.description,
    totalSale,
    unpaidAmount,
    debtCleared: false,
    debtClearedAt: null,
    cost: base.cost,
    recordId: newRecordId(),
    profit,
    reinvest,
    netProfit,
    newCapital
  };
}

function computeIdea(base) {
  const capital = Number(base.capital) || 0;
  const price = Number(base.price) || 0;
  const qty = Number(base.qty) || 0;
  const expectedSales = price * qty;
  const expectedProfit = expectedSales - capital;
  return {
    ideaId: newRecordId(),
    name: base.name,
    description: base.description,
    capital,
    price,
    qty,
    expectedSales,
    expectedProfit
  };
}

function renderDebtCell(record) {
  const u = originalUnpaid(record);
  if (u <= 0) return "—";
  if (record.debtCleared) {
    const when = record.debtClearedAt ? escapeHtml(String(record.debtClearedAt)) : "";
    return `<span class="tag-ok">تم دفع الدين</span>${when ? `<br><span style="font-size:12px;color:var(--muted)">${when}</span>` : ""}`;
  }
  return `<button type="button" class="ghost btn-small" data-debt-paid="${escapeHtml(String(record.recordId || ""))}">تسجيل دفع الدين</button>`;
}

function render() {
  log("info", "render_start", { records: state.records.length, loggedIn: !!state.currentUser });
  dom.rowsContainer.innerHTML = "";
  let totalSales = 0;
  let totalProfit = 0;
  let totalReinvest = 0;
  let totalNetProfit = 0;
  let currentCapital = 0;
  let sumRemaining = 0;
  let sumCollected = 0;

  for (const record of state.records) {
    totalSales += record.totalSale;
    totalProfit += record.profit;
    totalReinvest += record.reinvest;
    totalNetProfit += record.netProfit;
    currentCapital += record.newCapital;
    const orig = originalUnpaid(record);
    const rem = remainingUnpaid(record);
    const col = collectedFromCustomer(record);
    sumRemaining += rem;
    sumCollected += col;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(String(record.date))}</td>
      <td>${escapeHtml(String(record.product))}</td>
      <td>${escapeHtml(String(record.description || ""))}</td>
      <td>${currency(record.totalSale)}</td>
      <td>${orig > 0 ? currency(orig) : "—"}</td>
      <td>${orig > 0 ? currency(rem) : "—"}</td>
      <td>${currency(col)}</td>
      <td>${renderDebtCell(record)}</td>
      <td>${currency(record.cost)}</td>
      <td>${currency(record.profit)}</td>
      <td>${currency(record.reinvest)}</td>
      <td>${currency(record.netProfit)}</td>
      <td>${currency(record.newCapital)}</td>
    `;
    dom.rowsContainer.appendChild(tr);
  }

  dom.totals.totalSalesEl.textContent = currency(totalSales);
  dom.totals.totalProfitEl.textContent = currency(totalProfit);
  dom.totals.totalReinvestEl.textContent = currency(totalReinvest);
  dom.totals.totalNetProfitEl.textContent = currency(totalNetProfit);
  dom.totals.currentCapitalEl.textContent = currency(currentCapital);
  dom.totals.totalUnpaidEl.textContent = currency(sumRemaining);
  dom.totals.totalPaidEl.textContent = currency(sumCollected);
  dom.emptyState.style.display = state.records.length === 0 ? "block" : "none";
  log("info", "render_done", { rowsRendered: state.records.length });
}

function renderIdeasPreview() {
  const capital = Number(dom.ideaFields.capital.value) || 0;
  const price = Number(dom.ideaFields.price.value) || 0;
  const qty = Number(dom.ideaFields.qty.value) || 0;
  const expectedSales = price * qty;
  const expectedProfit = expectedSales - capital;
  dom.ideaTotals.expectedSalesEl.textContent = currency(expectedSales);
  dom.ideaTotals.expectedProfitEl.textContent = currency(expectedProfit);

  if (!dom.ideaAdvice) return;
  if (expectedProfit <= 0) {
    dom.ideaAdvice.innerHTML =
      "<strong>💡 نصيحة قوية</strong><span class='idea-profit-weak'>الربح المتوقع ضعيف ❌</span> — ما تبدأش فيها وركّز على فكرة أقوى.";
    return;
  }
  dom.ideaAdvice.innerHTML =
    "<strong>💡 نصيحة قوية</strong><span class='idea-profit-good'>فكرة فيها ربح واضح ✅</span> — تنجم تركز عليها بعد مقارنة باقي الأفكار.";
}

function renderIdeas() {
  dom.ideaRowsContainer.innerHTML = "";
  for (const idea of state.ideas) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(String(idea.name || ""))}</td>
      <td>${escapeHtml(String(idea.description || ""))}</td>
      <td>${currency(Number(idea.capital) || 0)}</td>
      <td>${currency(Number(idea.price) || 0)}</td>
      <td>${Number(idea.qty) || 0}</td>
      <td>${currency(Number(idea.expectedSales) || 0)}</td>
      <td>${currency(Number(idea.expectedProfit) || 0)}</td>
    `;
    dom.ideaRowsContainer.appendChild(tr);
  }
  dom.ideasEmptyState.style.display = state.ideas.length === 0 ? "block" : "none";
  renderInsights();
}

function renderInsights() {
  if (!dom.insights.donutEl || !dom.insights.lineEl || !dom.insights.bestIdeasListEl) return;

  // 1) Donut: paid / unpaid / reinvest distribution from actual records.
  const totalSales = state.records.reduce((acc, r) => acc + (Number(r.totalSale) || 0), 0);
  const totalUnpaid = state.records.reduce((acc, r) => acc + remainingUnpaid(r), 0);
  const totalPaid = Math.max(0, totalSales - totalUnpaid);
  const totalReinvest = state.records.reduce((acc, r) => acc + (Number(r.reinvest) || 0), 0);
  const donutBase = totalPaid + totalUnpaid + totalReinvest;
  if (donutBase > 0) {
    const pPaid = (totalPaid / donutBase) * 100;
    const pUnpaid = (totalUnpaid / donutBase) * 100;
    const pReinvest = Math.max(0, 100 - pPaid - pUnpaid);
    dom.insights.donutEl.style.background = `conic-gradient(#2ed69a 0 ${pPaid}%, #ff6f8f ${pPaid}% ${pPaid + pUnpaid}%, #f0c45e ${pPaid + pUnpaid}% 100%)`;
    dom.insights.donutHintEl.textContent = `محصّل: ${currency(totalPaid)} | غير مدفوع: ${currency(totalUnpaid)} | استثمار: ${currency(totalReinvest)}`;
  } else {
    dom.insights.donutEl.style.background = "conic-gradient(#2e3f66 0 100%)";
    dom.insights.donutHintEl.textContent = "لا توجد بيانات مبيعات بعد.";
  }

  // 2) Line: last 7 days sales trend (real records).
  const salesByDay = new Map();
  for (const r of state.records) {
    const key = String(r.date || "").trim();
    if (!key) continue;
    salesByDay.set(key, (salesByDay.get(key) || 0) + (Number(r.totalSale) || 0));
  }
  const dayEntries = [...salesByDay.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).slice(-7);
  if (dayEntries.length >= 2) {
    const values = dayEntries.map(([, v]) => v);
    const maxV = Math.max(...values, 1);
    const points = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * 100;
        const y = 100 - (v / maxV) * 100;
        return `${x},${y}`;
      })
      .join(" ");
    dom.insights.lineEl.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%"><polyline points="${points}" fill="none" stroke="#68b9ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const latest = dayEntries[dayEntries.length - 1][1];
    dom.insights.lineHintEl.textContent = `آخر يوم: ${currency(latest)} | أعلى يوم: ${currency(maxV)}`;
  } else {
    dom.insights.lineEl.innerHTML = "";
    dom.insights.lineHintEl.textContent = "أضف مبيعات لأيام متعددة لعرض التطور.";
  }

  // 3) Top ideas: actual top 3 by expected profit.
  const topIdeas = [...state.ideas]
    .sort((a, b) => (Number(b.expectedProfit) || 0) - (Number(a.expectedProfit) || 0))
    .slice(0, 3);
  if (topIdeas.length === 0) {
    dom.insights.bestIdeasListEl.innerHTML = `<div class="rank-item"><span>لا توجد أفكار كافية بعد</span><strong>—</strong></div>`;
  } else {
    const medals = ["🏅", "🥈", "🥉"];
    dom.insights.bestIdeasListEl.innerHTML = topIdeas
      .map((idea, idx) => `<div class="rank-item"><span>${escapeHtml(String(idea.name || `فكرة #${idx + 1}`))}</span><strong>${medals[idx]} ${currency(Number(idea.expectedProfit) || 0)}</strong></div>`)
      .join("");
  }
}

// =========================
// Auth flow
// =========================
async function refreshSessionState() {
  authTrace("refresh_session:start", { hasDb: !!state.db });
  if (!state.db) {
    const cfgError = validateSupabaseConfig();
    setAuthStatus(cfgError || "تعذر تهيئة Supabase Auth.", false);
    setPageMode(false);
    setAppEnabled(false);
    return;
  }

  let { data, error } = await state.db.auth.getSession();
  if (error) {
    authTrace("refresh_session:get_session_error", { message: error.message, status: error.status || null, code: error.code || null });
    setAuthStatus(`فشل قراءة الجلسة: ${error.message}`, false);
    setPageMode(false);
    setAppEnabled(false);
    return;
  }

  if (!data?.session) {
    const storedTokens = readStoredSessionTokens();
    if (storedTokens) {
      authTrace("refresh_session:try_restore_from_storage", {});
      const restored = await state.db.auth.setSession(storedTokens);
      if (!restored.error && restored.data?.session) {
        data = restored.data;
        authTrace("refresh_session:restored_from_storage", { userId: restored.data.session.user?.id || null });
      } else if (restored.error) {
        authTrace("refresh_session:restore_failed", { message: restored.error.message, status: restored.error.status || null, code: restored.error.code || null });
      }
    }
  }

  state.currentUser = data.session?.user ?? null;
  if (!state.currentUser) {
    authTrace("refresh_session:no_user", {});
    state.records = [];
    state.ideas = [];
    render();
    renderIdeas();
    setPageMode(false);
    setAppEnabled(false);
    setAuthStatus("أدخل Gmail وكلمة المرور ثم اضغط دخول.", false);
    return;
  }

  await activateAppForUser(state.currentUser);
}

async function runAuthAction(actionName, action) {
  if (!ensureSupabaseClient()) {
    setAuthStatus("تعذر الاتصال بـ Supabase. تأكد من الإعدادات والإنترنت.", false);
    return;
  }
  if (state.authBusy) {
    setAuthStatus("الرجاء الانتظار... جاري تنفيذ العملية السابقة.", false);
    return;
  }
  setAuthBusy(true);
  try {
    await action();
  } catch (err) {
    authTrace(`${actionName}:exception`, { message: err?.message || "unknown" });
    setAuthStatus(`تعذر تنفيذ العملية: ${err?.message || "خطأ غير معروف"}`, false);
  } finally {
    setAuthBusy(false);
    authTrace(`${actionName}:done`, {});
  }
}

async function handleLogin() {
  setAuthStatus("جاري تسجيل الدخول...", false);
  const validation = validateAuthInputs();
  if (!validation.ok) return setAuthStatus(validation.message, false);
  const { email, password } = getAuthCredentials();
  await runAuthAction("login", async () => {
    authTrace("login:start", { emailMasked: safeEmailForLog(email) });
    authTrace("login:request_signInWithPassword", {});
    const { data, error } = await state.db.auth.signInWithPassword({ email, password });
    if (error) {
      authTrace("login:failed", { message: error.message, status: error.status || null, code: error.code || null });
      if (error.status === 429) return setAuthStatus(formatRateLimitMessage(error), false);
      setAuthStatus(formatAuthError(error, "تسجيل الدخول"), false);
      return;
    }
    if (!data?.user) return setAuthStatus("تمت المحاولة لكن لم تصل بيانات مستخدم. حاول مرة أخرى.", false);
    authTrace("login:success", { userId: data.user.id || null });
    forceShowApp();
    await activateAppForUser(data.user);
  });
}

async function handleSignup() {
  setAuthStatus("جاري إنشاء الحساب...", false);
  const validation = validateAuthInputs();
  if (!validation.ok) return setAuthStatus(validation.message, false);
  const { email, password } = getAuthCredentials();
  await runAuthAction("signup", async () => {
    authTrace("signup:start", { emailMasked: safeEmailForLog(email) });
    authTrace("signup:request_signUp", {});
    const { data, error } = await signUpWithEmailPassword(email, password);
    if (error) {
      authTrace("signup:failed", { message: error.message, status: error.status || null, code: error.code || null });
      if (error.status === 429) return setAuthStatus(formatRateLimitMessage(error), false);
      if (isUserAlreadyRegisteredError(error)) {
        return setAuthStatus("الحساب موجود. استعمل زر دخول بكلمة المرور الصحيحة.", false);
      }
      setAuthStatus(formatAuthError(error, "إنشاء الحساب"), false);
      return;
    }
    if (!data?.session) {
      setAuthStatus("تم إنشاء الحساب. إذا كان تأكيد البريد مفعّل، افحص Gmail ثم سجّل الدخول.", true);
      return;
    }
    authTrace("signup:success", { userId: data?.session?.user?.id || null });
    await activateAppForUser(data.session.user);
  });
}

async function handlePasswordReset() {
  setAuthStatus("جاري إرسال رابط استرجاع كلمة المرور...", false);
  const emailValidation = validateEmailOnly();
  if (!emailValidation.ok) return setAuthStatus(emailValidation.message, false);
  const email = getAuthEmail();
  await runAuthAction("reset", async () => {
    authTrace("reset:start", { emailMasked: safeEmailForLog(email) });
    authTrace("reset:request_resetPasswordForEmail", { hasRedirect: globalThis.location?.protocol !== "file:" });
    const { error } = await state.db.auth.resetPasswordForEmail(email, getPasswordResetOptions());
    if (error) {
      authTrace("reset:failed", { message: error.message, status: error.status || null, code: error.code || null });
      if (error.status === 429) return setAuthStatus(formatRateLimitMessage(error), false);
      setAuthStatus(formatAuthError(error, "استرجاع كلمة المرور"), false);
      return;
    }
    setAuthStatus("تم إرسال رابط إعادة التعيين إلى Gmail.", true);
  });
}

function bindAuthEvents() {
  if (state.authEventsBound) return;
  state.authEventsBound = true;
  globalThis.__dailySalesAuthReady = true;

  dom.authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    authTrace("event:submit_login", {});
    await handleLogin();
  });
  dom.loginBtn?.addEventListener("click", () => {
    if (!state.authBusy) setAuthStatus("تم الضغط على دخول... جاري التحقق.", false);
  });
  dom.signupBtn?.addEventListener("click", async () => {
    authTrace("event:click_signup", {});
    await handleSignup();
  });
  dom.resetPasswordBtn?.addEventListener("click", async () => {
    authTrace("event:click_reset", {});
    await handlePasswordReset();
  });
  dom.logoutBtnApp?.addEventListener("click", async () => {
    authTrace("event:click_logout", {});
    // Always logout locally first so the button never appears "stuck".
    state.currentUser = null;
    state.records = [];
    state.ideas = [];
    render();
    renderIdeas();
    setPageMode(false);
    setAppEnabled(false);
    setAuthStatus("تم تسجيل الخروج.", true);

    try {
      if (!state.db) ensureSupabaseClient();
      if (state.db) await state.db.auth.signOut();
    } catch (err) {
      authTrace("logout:signout_error", { message: err?.message || "unknown" });
    }
  });
}

// =========================
// App init and event wiring
// =========================
function init() {
  log("info", "init_start", {
    projectId: SUPABASE_PROJECT_ID,
    url: SUPABASE_URL,
    table: SUPABASE_TABLE
  });
  const hasDb = ensureSupabaseClient();
  if (hasDb) {
    log("info", "supabase_client_created", { projectId: SUPABASE_PROJECT_ID });
  } else {
    const cfgError = validateSupabaseConfig();
    log("warn", "supabase_client_not_created", { cfgError: cfgError || null, hasCreateClient: !!globalThis.supabase?.createClient });
  }

  // Bind auth actions early so login/signup buttons always work.
  bindAuthEvents();
  if (state.db) {
    state.db.auth.onAuthStateChange(async (event, session) => {
      log("info", "auth_state_change", { event, hasSession: !!session, userId: session?.user?.id || null });
      authTrace("auth_state_change", { event, hasSession: !!session, userId: session?.user?.id || null });

      // INITIAL_SESSION may be null momentarily in some environments; avoid overriding UI state.
      if (event === "INITIAL_SESSION") return;

      if (event === "SIGNED_IN" && session?.user) {
        await activateAppForUser(session.user);
        return;
      }

      if (event === "SIGNED_OUT") {
        state.currentUser = null;
        state.records = [];
        state.ideas = [];
        render();
        renderIdeas();
        setPageMode(false);
        setAppEnabled(false);
        setAuthStatus("تم تسجيل الخروج.", true);
        return;
      }

      await refreshSessionState();
    });
  }

  dom.debtFullyPaid.addEventListener("change", () => {
    log("info", "debt_fully_paid_toggle", { checked: dom.debtFullyPaid.checked });
    if (dom.debtFullyPaid.checked) {
      dom.fields.unpaidAmount.value = "";
      dom.fields.unpaidAmount.disabled = true;
    } else {
      dom.fields.unpaidAmount.disabled = false;
    }
  });
  dom.debtFullyPaid.dispatchEvent(new Event("change"));

  dom.showSalesSectionBtn?.addEventListener("click", () => setActiveSection("sales"));
  dom.showIdeasSectionBtn?.addEventListener("click", () => setActiveSection("ideas"));
  setActiveSection("sales");

  dom.fields.unpaidAmount.addEventListener("input", () => {
    const str = dom.fields.unpaidAmount.value.trim();
    if (str === "") return;
    const v = Number(str);
    if (!Number.isFinite(v) || v <= 0) return;
    if (dom.debtFullyPaid.checked) {
      dom.debtFullyPaid.checked = false;
      dom.debtFullyPaid.dispatchEvent(new Event("change"));
    }
  });

  dom.rowsContainer.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-debt-paid]");
    if (!btn || !state.currentUser) return;
    const rec = state.records.find((r) => String(r.recordId) === btn.getAttribute("data-debt-paid"));
    if (!rec || originalUnpaid(rec) <= 0 || rec.debtCleared) return;
    if (!confirm("تأكيد أن الزبون سدّى كامل الآجل المسجّل لهذا السطر؟")) return;
    log("info", "debt_mark_paid", { recordId: rec.recordId });
    rec.debtCleared = true;
    rec.debtClearedAt = new Date().toISOString().slice(0, 10);
    saveRecords();
    await upsertRecordRemote(rec);
    render();
  });

  dom.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const unpaidStr = dom.fields.unpaidAmount.value.trim();
    const unpaidRaw = unpaidStr === "" ? 0 : Number(unpaidStr);
    const unpaidEffective = dom.debtFullyPaid.checked ? 0 : unpaidRaw;
    if (!dom.debtFullyPaid.checked && Number.isNaN(unpaidRaw)) {
      return alert("أدخل رقما صحيحا في خانة «مبيعات غير مدفوعة»، أو اتركها فارغة (صفر).");
    }

    const base = {
      date: dom.fields.date.value,
      product: dom.fields.product.value.trim(),
      description: dom.fields.description.value.trim(),
      totalSale: Number(dom.fields.totalSale.value),
      unpaidAmount: unpaidEffective,
      cost: Number(dom.fields.cost.value)
    };
    if (!base.date) return alert("اختر تاريخ العملية.");
    if (!base.product) return alert("أدخل اسم المنتج.");
    if (!base.description) return alert("أدخل وصف البيع.");
    if (Number.isNaN(base.totalSale) || base.totalSale < 0) return alert("أدخل قيمة صحيحة في إجمالي البيع.");
    if (Number.isNaN(base.unpaidAmount) || base.unpaidAmount < 0) return alert("أدخل قيمة صحيحة في خانة غير المدفوع.");
    if (Number.isNaN(base.cost) || base.cost < 0) return alert("أدخل قيمة صحيحة في رأس المال.");
    if (base.unpaidAmount > base.totalSale) return alert("مبلغ «غير المدفوع» لا يمكن أن يتجاوز إجمالي البيع.");

    log("info", "sale_submit", {
      date: base.date,
      product: base.product,
      totalSale: base.totalSale,
      unpaidAmount: base.unpaidAmount,
      cost: base.cost,
      debtFullyPaid: dom.debtFullyPaid.checked
    });
    try {
      const newRecord = computeRecord(base);
      state.records.unshift(newRecord);
      saveRecords();
      render();
      setSyncStatus("تمت إضافة العملية محليًا بنجاح.", true);
      dom.form.reset();
      dom.debtFullyPaid.checked = true;
      dom.debtFullyPaid.dispatchEvent(new Event("change"));

      const remoteOk = await upsertRecordRemote(newRecord);
      if (!remoteOk) {
        setSyncStatus("تمت إضافة العملية محليًا، لكن فشلت مزامنتها مع Supabase.", false);
      } else {
        setSyncStatus("تمت إضافة العملية ومزامنتها مع Supabase.", true);
      }
    } catch (err) {
      setSyncStatus(`فشل إضافة العملية: ${err?.message || "خطأ غير معروف"}`, false);
    }
  });

  for (const field of [dom.ideaFields.capital, dom.ideaFields.price, dom.ideaFields.qty]) {
    field.addEventListener("input", renderIdeasPreview);
  }

  dom.ideaForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.currentUser) return alert("سجّل الدخول بـ Gmail أولًا.");
    const base = {
      name: dom.ideaFields.name.value.trim(),
      description: dom.ideaFields.description.value.trim(),
      capital: Number(dom.ideaFields.capital.value),
      price: Number(dom.ideaFields.price.value),
      qty: Number(dom.ideaFields.qty.value)
    };
    if (!base.name || !base.description || base.capital < 0 || Number.isNaN(base.capital) || base.price < 0 || Number.isNaN(base.price) || base.qty < 0 || Number.isNaN(base.qty)) {
      return;
    }
    state.ideas.unshift(computeIdea(base));
    saveIdeas();
    renderIdeas();
    dom.ideaForm.reset();
    renderIdeasPreview();
  });

  dom.resetIdeasBtn.addEventListener("click", () => {
    if (!state.currentUser) return;
    if (!confirm("هل أنت متأكد من حذف كل الأفكار؟")) return;
    state.ideas = [];
    saveIdeas();
    renderIdeas();
    renderIdeasPreview();
  });

  dom.resetBtn.addEventListener("click", async () => {
    if (!state.currentUser) return;
    if (!confirm("هل أنت متأكد من حذف كل السجلات؟")) return;
    log("warn", "reset_all_local", { previousCount: state.records.length });
    state.records = [];
    saveRecords();
    await deleteAllRemote();
    render();
  });

  refreshAuthButtons();
  setAuthStatus("النظام جاهز. يمكنك تسجيل الدخول أو إنشاء حساب.", true);
  refreshSessionState();
  renderIdeasPreview();
  log("info", "init_done", {});
}

function bootstrap() {
  // Always bind auth buttons first, even if init later hits an error.
  bindAuthEvents();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
    return;
  }
  init();
}

bootstrap();
