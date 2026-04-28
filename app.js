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
  wrongPassword: "كلمة المرور خاطئة لهذا الحساب.",
  accountExistsUseLogin: "الحساب موجود بالفعل. استعمل زر دخول."
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
  logoutBtnApp: document.getElementById("logoutBtnApp"),
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
  }
};

const state = {
  db: null,
  currentUser: null,
  records: [],
  ideas: [],
  authBusy: false
};

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
  const emailRegex = /^[^\s@]+@gmail\.com$/i;
  if (!emailRegex.test(email)) return { ok: false, message: AUTH_MESSAGES.invalidGmail };
  if (password.length < 6) return { ok: false, message: AUTH_MESSAGES.shortPassword };
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

function isUserAlreadyRegisteredError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("user already registered");
}

function isInvalidCredentialsError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("invalid login credentials") || msg.includes("invalid_credentials");
}

async function signUpWithEmailPassword(email, password) {
  return state.db.auth.signUp({ email, password, options: { data: { email } } });
}


function setPageMode(isLoggedIn) {
  dom.appPage.classList.toggle("hidden", !isLoggedIn);
  dom.authPage.classList.toggle("hidden", isLoggedIn);
  if (dom.appPage.classList.contains("hidden") && dom.authPage.classList.contains("hidden")) {
    dom.authPage.classList.remove("hidden");
  }
}

function setAppEnabled(enabled) {
  for (const el of dom.form.querySelectorAll("input, textarea, button")) el.disabled = !enabled;
  for (const btn of dom.rowsContainer.querySelectorAll("button[data-debt-paid]")) btn.disabled = !enabled;
  dom.resetBtn.disabled = !enabled;
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
    if (!state.currentUser) return [];
    const raw = localStorage.getItem(userStorageKey());
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
  if (!state.currentUser) return;
  localStorage.setItem(userStorageKey(), JSON.stringify(state.records));
  log("info", "local_save", { key: userStorageKey(), count: state.records.length });
}

function loadIdeas() {
  try {
    if (!state.currentUser) return [];
    const raw = localStorage.getItem(userIdeasStorageKey());
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
  if (!state.currentUser) return;
  localStorage.setItem(userIdeasStorageKey(), JSON.stringify(state.ideas));
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
}

// =========================
// Auth flow
// =========================
async function refreshSessionState() {
  log("info", "session_refresh_start", {
    protocol: globalThis.location?.protocol,
    href: globalThis.location?.href,
    hasDb: !!state.db
  });
  if (!state.db) {
    const cfgError = validateSupabaseConfig();
    log("warn", "supabase_client_missing", { cfgError: cfgError || null });
    setAuthStatus(cfgError || "تعذر تهيئة Supabase Auth.", false);
    setPageMode(false);
    setAppEnabled(false);
    return;
  }

  log("info", "auth_get_session_start", {});
  const { data, error } = await state.db.auth.getSession();
  if (error) {
    log("warn", "auth_get_session_error", { message: error.message, status: error.status, code: error.code });
    await state.db.auth.signOut();
    setAuthStatus(`تمت إعادة ضبط الجلسة تلقائيًا: ${error.message}`, false);
  }
  state.currentUser = data.session?.user ?? null;
  log("info", "auth_get_session_result", { userId: state.currentUser?.id || null, hasSession: !!data.session });

  if (!state.currentUser) {
    setAuthStatus("", false);
    state.records = [];
    state.ideas = [];
    render();
    renderIdeas();
    setPageMode(false);
    setAppEnabled(false);
    return;
  }

  const local = loadRecords();
  state.ideas = loadIdeas();
  const remote = await loadRecordsFromRemote();
  log("info", "merge_records", { localCount: local.length, remoteCount: remote.length });
  if (remote.length === 0 && local.length > 0) {
    await upsertManyRemote(local);
    state.records = local;
    setAuthStatus(`تم تسجيل الدخول: ${state.currentUser.phone || state.currentUser.id} (تم رفع البيانات المحلية).`, true);
  } else {
    state.records = remote;
    setAuthStatus(`تم تسجيل الدخول: ${state.currentUser.phone || state.currentUser.id}`, true);
  }
  saveRecords();
  render();
  renderIdeas();
  renderIdeasPreview();
  setPageMode(true);
  setAppEnabled(true);
  log("info", "session_refresh_done", { records: state.records.length });
}

async function handleLogin() {
  if (!state.db || state.authBusy) return;
  const validation = validateAuthInputs();
  if (!validation.ok) return setAuthStatus(validation.message, false);
  const { email, password } = getAuthCredentials();
  log("info", "login_attempt", { email: safeEmailForLog(email) });
  setAuthBusy(true);
  try {
    let { error } = await state.db.auth.signInWithPassword({ email, password });
    if (error) {
      if (isInvalidCredentialsError(error)) {
        log("warn", "login_invalid_try_signup", { email: safeEmailForLog(email) });
        const signupRes = await signUpWithEmailPassword(email, password);
        const signupErr = signupRes.error;
        if (!signupErr) {
          log("info", "login_created_new_user", { email: safeEmailForLog(email) });
          ({ error } = await state.db.auth.signInWithPassword({ email, password }));
        } else {
          const signupMsg = String(signupErr.message || "").toLowerCase();
          if (signupMsg.includes("user already registered")) {
            setAuthStatus(AUTH_MESSAGES.wrongPassword, false);
            return;
          }
          setAuthStatus(formatAuthError(signupErr, "إنشاء الحساب"), false);
          return;
        }
      }
    }
    if (error) {
      log("warn", "login_failed", { message: error.message, status: error.status, code: error.code });
      setAuthStatus(formatAuthError(error, "تسجيل الدخول"), false);
      return;
    }
    await refreshSessionState();
  } catch (err) {
    setAuthStatus(`تعذر تسجيل الدخول: ${err?.message || "خطأ غير معروف"}`, false);
  } finally {
    setAuthBusy(false);
  }
}

async function handleSignup() {
  if (!state.db || state.authBusy) return;
  const validation = validateAuthInputs();
  if (!validation.ok) return setAuthStatus(validation.message, false);
  const { email, password } = getAuthCredentials();
  log("info", "signup_attempt", { email: safeEmailForLog(email) });
  setAuthBusy(true);
  try {
    const { error } = await signUpWithEmailPassword(email, password);
    if (error) {
      if (isUserAlreadyRegisteredError(error)) {
        // If account already exists, try login immediately with typed password.
        const loginExisting = await state.db.auth.signInWithPassword({ email, password });
        if (loginExisting.error) {
          if (isInvalidCredentialsError(loginExisting.error)) {
            setAuthStatus(AUTH_MESSAGES.wrongPassword, false);
            return;
          }
          setAuthStatus(formatAuthError(loginExisting.error, "تسجيل الدخول"), false);
          return;
        }
        await refreshSessionState();
        return;
      }
      setAuthStatus(formatAuthError(error, "إنشاء الحساب"), false);
      return;
    }
    // Auto-login right after signup to avoid forcing extra manual step.
    const loginAfterSignup = await state.db.auth.signInWithPassword({ email, password });
    if (loginAfterSignup.error) {
      setAuthStatus(formatAuthError(loginAfterSignup.error, "تسجيل الدخول بعد إنشاء الحساب"), false);
      return;
    }
    await refreshSessionState();
  } catch (err) {
    setAuthStatus(`تعذر إنشاء الحساب: ${err?.message || "خطأ غير معروف"}`, false);
  } finally {
    setAuthBusy(false);
  }
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
  const cfgError = validateSupabaseConfig();
  if (globalThis.supabase?.createClient && !cfgError) {
    state.db = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    log("info", "supabase_client_created", { projectId: SUPABASE_PROJECT_ID });
  } else {
    log("warn", "supabase_client_not_created", { cfgError: cfgError || null, hasCreateClient: !!globalThis.supabase?.createClient });
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
    if (!state.currentUser) return alert("سجّل الدخول بـ Gmail أولًا.");
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
    if (!base.date || !base.product || !base.description || base.totalSale < 0 || Number.isNaN(base.totalSale) || base.unpaidAmount < 0 || Number.isNaN(base.unpaidAmount) || base.cost < 0 || Number.isNaN(base.cost)) return;
    if (base.unpaidAmount > base.totalSale) return alert("مبلغ «غير المدفوع» لا يمكن أن يتجاوز إجمالي البيع.");

    log("info", "sale_submit", {
      date: base.date,
      product: base.product,
      totalSale: base.totalSale,
      unpaidAmount: base.unpaidAmount,
      cost: base.cost,
      debtFullyPaid: dom.debtFullyPaid.checked
    });
    state.records.unshift(computeRecord(base));
    saveRecords();
    await upsertRecordRemote(state.records[0]);
    render();
    dom.form.reset();
    dom.debtFullyPaid.checked = true;
    dom.debtFullyPaid.dispatchEvent(new Event("change"));
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

  dom.authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleLogin();
  });
  dom.signupBtn?.addEventListener("click", async () => {
    await handleSignup();
  });
  dom.logoutBtnApp.addEventListener("click", async () => {
    if (!state.db) return;
    log("info", "logout_click", {});
    await state.db.auth.signOut();
    log("info", "logout_done", {});
    await refreshSessionState();
  });

  if (state.db) {
    state.db.auth.onAuthStateChange(async () => {
      log("info", "auth_state_change", {});
      await refreshSessionState();
    });
  }

  refreshAuthButtons();
  refreshSessionState();
  renderIdeasPreview();
  log("info", "init_done", {});
}

function bootstrap() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
    return;
  }
  init();
}

bootstrap();
