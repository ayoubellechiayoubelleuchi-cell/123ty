"use strict";

// =========================
// Config
// =========================
const STORAGE_KEY = "daily-sales-log-v1";
const IDEAS_STORAGE_KEY = "project-ideas-v1";
const EXPENSES_STORAGE_KEY = "project-expenses-v1";
const INVESTORS_STORAGE_KEY = "investors-ideas-v1";
const WASIYYAT_STORAGE_KEY = "wasiyyat-log-v1";
const DELETION_LOG_KEY = "deletion-log-v1";
const SUPABASE_PROJECT_ID = "navqvljmipzheqjmlzgt";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hdnF2bGptaXB6aGVxam1semd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTAzNzQsImV4cCI6MjA5MjM2NjM3NH0.xDeyeaAhcyjuLEWUOfDRQKdjDUDiQNfw6UMlcdm5n2k";
const SUPABASE_TABLE = "sales_records";

/**
 * تنظيم الملف (أين «النظام» في app.js):
 * 1) dom + state — عناصر الصفحة والحالة الحية.
 * 2) Auth + activateAppForUser — تسجيل الدخول وجلب/دمج المبيعات مع Supabase.
 * 3) سجلات المبيعات — load/saveRecords، merge، computeRecord، render.
 * 4) الإعدادات — recoverSalesMergeFromDeviceAndCloud (استعادة من الجهاز+السحابة) ومسح السجلات في init().
 */
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
  expenseCards: document.getElementById("expenseCards"),
  expensesEmptyState: document.getElementById("expensesEmptyState"),
  standaloneExpenseForm: document.getElementById("standaloneExpenseForm"),
  investorRowsContainer: document.getElementById("investorRows"),
  wasiyyatForm: document.getElementById("wasiyyatForm"),
  wasiyyatRowsContainer: document.getElementById("wasiyyatRows"),
  emptyState: document.getElementById("emptyState"),
  dailySalesSummary: document.getElementById("dailySalesSummary"),
  monthlyProfitSummary: document.getElementById("monthlyProfitSummary"),
  ideasEmptyState: document.getElementById("ideasEmptyState"),
  investorsEmptyState: document.getElementById("investorsEmptyState"),
  wasiyyatEmptyState: document.getElementById("wasiyyatEmptyState"),
  resetBtn: document.getElementById("resetData"),
  recoverSalesBtn: document.getElementById("recoverSalesBtn"),
  resetIdeasBtn: document.getElementById("resetIdeas"),
  addIdeaToInvestorsBtn: document.getElementById("addIdeaToInvestorsBtn"),
  resetInvestorsBtn: document.getElementById("resetInvestors"),
  deletionLogList: document.getElementById("deletionLogList"),
  appPage: document.getElementById("appPage"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  sidebarEdgeBtn: document.getElementById("sidebarEdgeBtn"),
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
  expenseSectionCard: document.getElementById("expenseSectionCard"),
  navSales: document.getElementById("navSales"),
  navProjectHome: document.getElementById("navProjectHome"),
  navDailyLog: document.getElementById("navDailyLog"),
  navIdeasForm: document.getElementById("navIdeasForm"),
  navExpenses: document.getElementById("navExpenses"),
  navInvestors: document.getElementById("navInvestors"),
  navWasiyyat: document.getElementById("navWasiyyat"),
  navSummary: document.getElementById("navSummary"),
  navReports: document.getElementById("navReports"),
  navSettings: document.getElementById("navSettings"),
  workspaceTop: document.getElementById("workspaceTop"),
  tablesGrid: document.getElementById("tablesGrid"),
  dailyLogSection: document.getElementById("dailyLogSection"),
  ideasLogSection: document.getElementById("ideasLogSection"),
  investorsSection: document.getElementById("investorsSection"),
  wasiyyatSection: document.getElementById("wasiyyatSection"),
  projectSummarySection: document.getElementById("projectSummarySection"),
  settingsPageSection: document.getElementById("settingsPageSection"),
  reportsSection: document.getElementById("reportsSection"),
  settingsSection: document.getElementById("settingsSection"),
  sidebarNetProfit: document.getElementById("sidebarNetProfit"),
  sidebarCapital: document.getElementById("sidebarCapital"),
  sidebarReceivables: document.getElementById("sidebarReceivables"),
  sidebarProfitTrend: document.getElementById("sidebarProfitTrend"),
  authStatus: document.getElementById("authStatus"),
  syncStatus: document.getElementById("syncStatus"),
  dashboardHeroProfit: document.getElementById("dashboardHeroProfit"),
  debtRepaidDate: document.getElementById("debtRepaidDate"),
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
    privateNotes: document.getElementById("ideaPrivateNotes"),
    capital: document.getElementById("ideaCapital"),
    price: document.getElementById("ideaPrice"),
    qty: document.getElementById("ideaQty")
  },
  expenseFields: {
    purchase: document.getElementById("expPurchase"),
    amount: document.getElementById("expAmount"),
    date: document.getElementById("expDate")
  },
  ideaTotals: {
    expectedSalesEl: document.getElementById("ideaExpectedSales"),
    expectedProfitEl: document.getElementById("ideaExpectedProfit"),
    profitMarginEl: document.getElementById("ideaProfitMargin")
  },
  ideaTypeProduct: document.getElementById("ideaTypeProduct"),
  ideaTypeService: document.getElementById("ideaTypeService"),
  sendToInvestors: document.getElementById("sendToInvestors"),
  ideaInvestorPhone: document.getElementById("ideaInvestorPhone"),
  wasiyyatFields: {
    capital: document.getElementById("wasiyyatCapital"),
    price: document.getElementById("wasiyyatPrice"),
    saleDate: document.getElementById("wasiyyatSaleDate"),
    completionDate: document.getElementById("wasiyyatCompletionDate"),
    personName: document.getElementById("wasiyyatPersonName"),
    phone: document.getElementById("wasiyyatPhone")
  },
  ideaTypeHint: document.getElementById("ideaTypeHint"),
  ideaPriceLabel: document.getElementById("ideaPriceLabel"),
  ideaQtyLabel: document.getElementById("ideaQtyLabel"),
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
  investors: [],
  wasiyyat: [],
  expenses: [],
  deletionLog: [],
  /** عند التعديل: معرّف السجل المفتوح في النموذج */
  editingSaleRecordId: null,
  authBusy: false,
  authEventsBound: false
};

/** يمنع تنشيطَيْن متزامنين (مثلاً SIGNED_IN + refreshSession) يخلطان أو يصفّران السجل */
let __salesActivateTail = Promise.resolve();

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
  if (dom.wasiyyatForm) {
    for (const el of dom.wasiyyatForm.querySelectorAll("input, textarea, button")) el.disabled = !enabled;
  }
  for (const btn of dom.rowsContainer.querySelectorAll("button[data-debt-paid]")) btn.disabled = !enabled;
  for (const btn of dom.rowsContainer.querySelectorAll("button[data-sale-edit], button[data-sale-delete]")) btn.disabled = !enabled;
  for (const btn of dom.wasiyyatRowsContainer?.querySelectorAll("button[data-wasiyyat-delete]") ?? []) btn.disabled = !enabled;
  dom.resetBtn.disabled = !enabled;
  if (dom.recoverSalesBtn) dom.recoverSalesBtn.disabled = !enabled;
}

const SIDEBAR_NAV_IDS = [
  "navProjectHome",
  "navSales",
  "navDailyLog",
  "navIdeasForm",
  "navExpenses",
  "navWasiyyat",
  "navInvestors",
  "navSummary",
  "navSettings"
];

function setSidebarNavActive(activeId) {
  for (const id of SIDEBAR_NAV_IDS) {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle("active", id === activeId);
  }
}

function scrollToPanel(el) {
  if (!el) return;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  } catch {
    try {
      el.scrollIntoView(true);
    } catch {
      const y = el.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo(0, Math.max(0, y));
    }
  }
}

function isMobileSidebarLayout() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1024px)").matches;
}

function setSidebarDrawerOpen(open) {
  if (!dom.appPage) return;
  dom.appPage.classList.toggle("sidebar-open", !!open);
  if (dom.sidebarEdgeBtn) dom.sidebarEdgeBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (dom.sidebarBackdrop) dom.sidebarBackdrop.setAttribute("aria-hidden", open ? "false" : "true");
}

function closeSidebarDrawerIfMobile() {
  if (isMobileSidebarLayout()) setSidebarDrawerOpen(false);
}

function handleDashboardQuick(q) {
  if (!q) return;
  if (q === "sales") setMainView("sales");
  else if (q === "daily") setMainView("daily");
  else if (q === "ideas") setMainView("ideas");
  else if (q === "expenses") setMainView("expenses");
  else if (q === "wasiyyat") setMainView("wasiyyat");
  else if (q === "investors") setMainView("investors");
  else return;
  scrollToPanel(dom.workspaceTop);
  closeSidebarDrawerIfMobile();
}

function updateBottomNavActive(view) {
  const dock = document.getElementById("bottomNav");
  if (!dock) return;
  for (const el of dock.querySelectorAll("[data-bottom-view]")) el.classList.remove("active");
  const fab = dock.querySelector("#bnFab");
  fab?.classList.remove("active");

  if (view === "sales") {
    fab?.classList.add("active");
    return;
  }
  if (view === "ideas") document.getElementById("bnIdeas")?.classList.add("active");
  else if (view === "investors") document.getElementById("bnInvestors")?.classList.add("active");
  else if (view === "daily") document.getElementById("bnDaily")?.classList.add("active");
  else if (view === "summary") document.getElementById("bnHome")?.classList.add("active");
}

function toggleSidebarDrawer() {
  if (!dom.appPage) return;
  setSidebarDrawerOpen(!dom.appPage.classList.contains("sidebar-open"));
}

function bindSidebarDrawerUi() {
  dom.sidebarEdgeBtn?.addEventListener("click", () => toggleSidebarDrawer());
  dom.sidebarBackdrop?.addEventListener("click", () => setSidebarDrawerOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!dom.appPage?.classList.contains("sidebar-open")) return;
    setSidebarDrawerOpen(false);
  });
  window.addEventListener("resize", () => {
    if (!isMobileSidebarLayout()) setSidebarDrawerOpen(false);
  });
}

function setActiveSection(section) {
  const view = section === "ideas" ? "ideas" : "sales";
  const isSales = view === "sales";
  const isIdeas = view === "ideas";

  dom.expenseSectionCard?.classList.add("hidden-section");

  dom.salesSectionCard?.classList.toggle("hidden-section", !isSales);
  dom.ideasSectionCard?.classList.toggle("hidden-section", !isIdeas);
  dom.showSalesSectionBtn?.classList.toggle("active", isSales);
  dom.showIdeasSectionBtn?.classList.toggle("active", isIdeas);

  // Keep each sidebar item in its own standalone page.
  dom.tablesGrid?.classList.toggle("hidden", !isIdeas);
  dom.tablesGrid?.classList.toggle("single-col", isIdeas);
  dom.ideasLogSection?.classList.toggle("hidden", !isIdeas);
  dom.dailyLogSection?.classList.add("hidden");
  dom.projectSummarySection?.classList.add("hidden");
  dom.settingsPageSection?.classList.add("hidden");
  dom.investorsSection?.classList.add("hidden");
  dom.wasiyyatSection?.classList.add("hidden");

  setSidebarNavActive(isSales ? "navSales" : "navIdeasForm");
}

function setMainView(view) {
  if (view === "sales" || view === "ideas") {
    setActiveSection(view);
    updateBottomNavActive(view);
    closeSidebarDrawerIfMobile();
    return;
  }

  dom.salesSectionCard?.classList.add("hidden-section");
  dom.ideasSectionCard?.classList.add("hidden-section");
  dom.tablesGrid?.classList.toggle("hidden", view !== "daily");
  dom.tablesGrid?.classList.toggle("single-col", view === "daily");
  dom.ideasLogSection?.classList.add("hidden");
  dom.dailyLogSection?.classList.toggle("hidden", view !== "daily");
  dom.projectSummarySection?.classList.toggle("hidden", view !== "summary");
  dom.settingsPageSection?.classList.toggle("hidden", view !== "settings");
  dom.investorsSection?.classList.toggle("hidden", view !== "investors");
  dom.wasiyyatSection?.classList.toggle("hidden", view !== "wasiyyat");
  dom.expenseSectionCard?.classList.toggle("hidden-section", view !== "expenses");

  if (view === "daily") setSidebarNavActive("navDailyLog");
  else if (view === "summary") setSidebarNavActive("navSummary");
  else if (view === "settings") setSidebarNavActive("navSettings");
  else if (view === "investors") setSidebarNavActive("navInvestors");
  else if (view === "wasiyyat") setSidebarNavActive("navWasiyyat");
  else if (view === "expenses") setSidebarNavActive("navExpenses");

  updateBottomNavActive(view);
}

function applySignedOutState(message = "تم تسجيل الخروج.") {
  state.currentUser = null;
  state.records = [];
  state.ideas = [];
  state.investors = [];
  state.wasiyyat = [];
  state.expenses = [];
  state.deletionLog = [];
  state.editingSaleRecordId = null;
  clearSaleEditMode();
  render();
  renderIdeas();
  renderExpenses();
  renderInvestors();
  renderWasiyyat();
  renderDeletionLog();
  setPageMode(false);
  setAppEnabled(false);
  setAuthStatus(message, true);
}

function renderSalesAppShell() {
  render();
  renderIdeas();
  renderExpenses();
  renderInvestors();
  renderWasiyyat();
  renderDeletionLog();
  renderIdeasPreview();
}

async function activateAppForUser(user, statusSuffix = "") {
  if (!user) return;
  const prev = __salesActivateTail;
  let unlock;
  __salesActivateTail = new Promise((r) => {
    unlock = r;
  });
  await prev.catch(() => {});
  try {
    await activateAppSerialized(user, statusSuffix);
  } finally {
    unlock();
  }
}

async function activateAppSerialized(user, statusSuffix = "") {
  authTrace("activate_app:start", { userId: user?.id || null, statusSuffix });
  state.currentUser = user;

  setPageMode(true);
  forceShowApp();
  setAppEnabled(true);
  setAuthStatus(`تم تسجيل الدخول: ${state.currentUser.phone || state.currentUser.id}${statusSuffix}`, true);

  try {
    const localLoad = loadSalesFromAllLocalSnapshots();
    const local = localLoad.list;
    state.ideas = loadIdeas();
    state.expenses = loadExpenses();
    state.investors = loadInvestors();
    state.wasiyyat = loadWasiyyat();
    state.deletionLog = loadDeletionLog();

    const remotePull0 = await loadRecordsFromRemote();
    let remote = remotePull0.records;
    let remoteOk = remotePull0.ok;

    authTrace("activate_app:data_loaded", {
      localCount: local.length,
      localSalvageSources: localLoad.sources,
      remoteCount: remote.length,
      remoteOk,
      ideasCount: state.ideas.length,
      investorsCount: state.investors.length,
      salesClearPending: isSalesClearPending()
    });

    /* مسح معلّق: لا نصفّر الواجهة في كل تحديث بينما لا يزال السحابة أو المحلي له بيانات */
    if (isSalesClearPending()) {
      if (remoteOk && remote.length > 0 && state.db) {
        await deleteAllRemote();
        const rp2 = await loadRecordsFromRemote();
        remote = rp2.records;
        remoteOk = rp2.ok;
      }
      const cloudEmptyConfirmed = remoteOk && remote.length === 0;

      authTrace("activate_app:honor_sales_clear_pending", {
        remoteCountAfter: remote.length,
        remoteOk,
        cloudEmptyConfirmed
      });

      if (cloudEmptyConfirmed) {
        state.records = [];
        saveRecords({ allowEmptyBackup: true, allowEmptyPersist: true });
        setSalesClearPending(false);
        setSyncStatus("اكتمل تأكيد المسح محليًا وعلى السحابة.", true);
      } else {
        state.records = local.length > 0 ? local.slice() : [];
        ensureAllSalesRecordsHaveIds();
        if (!remoteOk) {
          setSyncStatus(
            "مسح معلّق؛ تعذّر التحقق من السحابة — أُعيد عرض بيانات جهازك ولن يُفقد المحلي بعد التحديث. عُد إلى الإعدادات لمتابعة المحاولة.",
            false
          );
        } else if (remote.length > 0) {
          setSyncStatus(
            "كان هناك طلب مسح لم يكتمل على السحابة — عُرضت بياناتك من الجهاز. من الإعدادات يمكن المحاولة مرة أخرى.",
            false
          );
        } else {
          setSyncStatus("مسح معلّق — جاري التحقق من السحابة عند الاتصال.", false);
        }
      }
    } else if (!remoteOk) {
      state.records = local.slice();
      authTrace("activate_app:remote_fetch_failed_use_local_only", { count: state.records.length });
      setSyncStatus("تعذّر جلب السَحَابة الآن؛ وُضِعت بيانات جهازك (تحديث الصفحة لا يمسح المحلي).", false);
    } else if (remote.length === 0 && local.length > 0) {
      await upsertManyRemote(local);
      state.records = local;
      authTrace("activate_app:using_local_and_uploaded", { count: local.length });
    } else {
      state.records = mergeSalesListsLocalRemote(remote, local);
      authTrace("activate_app:merged_remote_local", {
        remote: remote.length,
        local: local.length,
        merged: state.records.length
      });
    }

    /** إذا بقي السجل فارغًا رغم وجود خام في مفتاح المستخدم — لا نترك الواجهة تُظهر ضياعًا */
    if (!isSalesClearPending() && state.records.length === 0 && local.length > 0) {
      state.records = local.slice();
      ensureAllSalesRecordsHaveIds();
      saveRecords();
      authTrace("activate_app:rehydrate_from_local_after_merge", { count: state.records.length });
      setSyncStatus("أُعيد تحميل المبيعات من التخزين المحلي بعد دمج السحابة.", true);
    }

    ensureAllSalesRecordsHaveIds();
    if (state.db && !isSalesClearPending() && state.records.length > 0) {
      await upsertManyRemote(state.records);
    }
    const skipSaveWhilePendingEmpty = isSalesClearPending() && state.records.length === 0;
    if (!skipSaveWhilePendingEmpty) {
      saveRecords();
    } else {
      authTrace("activate_app:skip_sales_local_persist_clear_stalemate", { remoteLeft: remote.length, remoteOk });
    }
    if (!isSalesClearPending() && remoteOk && localLoad.sources >= 2 && state.records.length > 0) {
      setSyncStatus(
        `تم ضم ${localLoad.sources} نسَخًا محليًا؛ عندك الآن ${state.records.length} عملية في سجل البيع — راجع الأرقام ثم أكمل استخدامًا عاديًا.`,
        true
      );
    }
    renderSalesAppShell();
    authTrace("activate_app:ui_synced", { records: state.records.length });
  } catch (err) {
    authTrace("activate_app:sync_error", { message: err?.message || "unknown" });
    if (state.currentUser && state.records.length === 0) {
      try {
        const salvage = loadSalesFromAllLocalSnapshots();
        if (salvage.list.length > 0) {
          state.records = salvage.list;
          ensureAllSalesRecordsHaveIds();
          saveRecords();
          setSyncStatus("تعذّرت المزامنة أثناء التفعيل؛ أُعيد تحميل المبيعات من التخزين المحلي.", true);
        }
      } catch (_) {}
    }
    renderSalesAppShell();
    if (state.records.length === 0) {
      setSyncStatus(`تعذر مزامنة بعض البيانات: ${err?.message || "خطأ غير معروف"}`, false);
    }
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

function salesClearPendingStorageKey(userIdOverride) {
  const uid = userIdOverride ?? state.currentUser?.id ?? "";
  return uid ? `${STORAGE_KEY}:pending-remote-clear:${uid}` : "";
}

function isSalesClearPending(userIdOverride) {
  const k = salesClearPendingStorageKey(userIdOverride);
  return k ? localStorage.getItem(k) === "1" : false;
}

function setSalesClearPending(on, userIdOverride) {
  const k = salesClearPendingStorageKey(userIdOverride ?? state.currentUser?.id ?? "");
  if (!k) return;
  if (on) localStorage.setItem(k, "1");
  else localStorage.removeItem(k);
}

function userStorageKey() {
  return state.currentUser ? `${STORAGE_KEY}:${state.currentUser.id}` : STORAGE_KEY;
}

function userIdeasStorageKey() {
  return state.currentUser ? `${IDEAS_STORAGE_KEY}:${state.currentUser.id}` : IDEAS_STORAGE_KEY;
}

function userExpensesStorageKey() {
  return state.currentUser ? `${EXPENSES_STORAGE_KEY}:${state.currentUser.id}` : EXPENSES_STORAGE_KEY;
}

function userInvestorsStorageKey() {
  return state.currentUser ? `${INVESTORS_STORAGE_KEY}:${state.currentUser.id}` : INVESTORS_STORAGE_KEY;
}

function userWasiyyatStorageKey() {
  return state.currentUser ? `${WASIYYAT_STORAGE_KEY}:${state.currentUser.id}` : WASIYYAT_STORAGE_KEY;
}

function backupStorageKey() {
  return `${STORAGE_KEY}:backup`;
}

function backupIdeasStorageKey() {
  return `${IDEAS_STORAGE_KEY}:backup`;
}

function backupExpensesStorageKey() {
  return `${EXPENSES_STORAGE_KEY}:backup`;
}

function backupInvestorsStorageKey() {
  return `${INVESTORS_STORAGE_KEY}:backup`;
}

function backupWasiyyatStorageKey() {
  return `${WASIYYAT_STORAGE_KEY}:backup`;
}

function emergencyRecordsKey() {
  return `${STORAGE_KEY}:emergency`;
}

function emergencyIdeasKey() {
  return `${IDEAS_STORAGE_KEY}:emergency`;
}

function emergencyExpensesKey() {
  return `${EXPENSES_STORAGE_KEY}:emergency`;
}

function emergencyInvestorsKey() {
  return `${INVESTORS_STORAGE_KEY}:emergency`;
}

function emergencyWasiyyatKey() {
  return `${WASIYYAT_STORAGE_KEY}:emergency`;
}

function userDeletionLogKey() {
  return state.currentUser ? `${DELETION_LOG_KEY}:${state.currentUser.id}` : DELETION_LOG_KEY;
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

/** أصل الآجل المسجَّل (لا يُصفَر عند الإسداد بتاريخ ليعرض في البطاقة) */
function displayOriginalReceivable(record) {
  const t = Number(record.totalSale) || 0;
  const snap = Number(record.originalDebtAtSale);
  if (Number.isFinite(snap) && snap > 0) return clampUnpaid(t, snap);
  const u = originalUnpaid(record);
  if (u > 0) return u;
  return 0;
}

function displayRemainingReceivable(record) {
  if (record.debtCleared) return 0;
  return originalUnpaid(record);
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
  return list.map((r) => {
    const ridRaw = r.recordId != null && String(r.recordId).trim() !== "" ? r.recordId : r.record_id;
    const out = {
      ...r,
      unpaidAmount: clampUnpaid(r.totalSale, r.unpaidAmount ?? r.unpaid),
      debtCleared: !!r.debtCleared,
      debtClearedAt: r.debtClearedAt || null
    };
    if (ridRaw != null && String(ridRaw).trim() !== "") out.recordId = String(ridRaw).trim();
    hydrateOriginalDebtSnap(out);
    return out;
  });
}

function hydrateOriginalDebtSnap(r) {
  const t = Number(r.totalSale) || 0;
  let snap = Number(r.originalDebtAtSale);
  if (!Number.isFinite(snap)) snap = 0;
  snap = clampUnpaid(t, snap);
  const u = clampUnpaid(t, r.unpaidAmount ?? r.unpaid ?? 0);
  if (snap <= 0 && u > 0) r.originalDebtAtSale = u;
  else r.originalDebtAtSale = snap;
}

function recordCanonicalId(r) {
  if (!r) return "";
  const a = r.recordId != null ? String(r.recordId).trim() : "";
  if (a) return a;
  const b = r.record_id != null ? String(r.record_id).trim() : "";
  return b;
}

function hasStableRecordId(r) {
  return recordCanonicalId(r) !== "";
}

/** بصمة تقليلية لتفادي تكرار نفس العملية عند دمج قوائم بلا recordId */
function businessFingerprint(record) {
  const d = String(record.date ?? "").trim();
  const p = String(record.product ?? "").trim();
  const t = (Number(record.totalSale) || 0).toFixed(4);
  const c = (Number(record.cost) || 0).toFixed(4);
  const u = (Number(clampUnpaid(record.totalSale, record.unpaidAmount ?? record.unpaid ?? 0)) || 0).toFixed(4);
  const debt = record.debtCleared ? `1|${String(record.debtClearedAt ?? "")}` : "0|";
  const desc = String(record.description ?? "").trim().slice(0, 80);
  return `${d}|${p}|${t}|${c}|${u}|${debt}|${desc}`;
}

function mergeKeyForRecord(record) {
  return hasStableRecordId(record) ? `id:${recordCanonicalId(record)}` : `fp:${businessFingerprint(record)}`;
}

/**
 * دمج سحابة + محلي بدون إسقاط صفوف: كل صف من «السحابة» يبقى، ويُضاف ما هو محلي فقط،
 * وعند تطابق المفتاح تُدمج الحقول (الطرف الثاني يغطّي الحقول المشتركة).
 */
function mergeSalesListsLocalRemote(remotes, locals) {
  if (!locals || locals.length === 0) return (remotes || []).slice();
  if (!remotes || remotes.length === 0) return locals.slice();
  const map = new Map();
  for (const r of remotes) map.set(mergeKeyForRecord(r), { ...r });
  for (const r of locals) {
    const k = mergeKeyForRecord(r);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { ...r });
      continue;
    }
    let rid =
      recordCanonicalId(r) ||
      recordCanonicalId(prev) ||
      String(prev.recordId ?? r.recordId ?? "")
        .trim();
    map.set(k, { ...prev, ...r, recordId: rid || prev.recordId || r.recordId });
  }
  return [...map.values()];
}

function userRecoverSalesKey() {
  return state.currentUser ? `${userStorageKey()}:recover-snapshot` : "";
}

/** نسخة المبيعات في sessionStorage لنفس التبويب — تبقى بعد F5 ولا تُستبدل بخطأ بـ [] */
function tabSessionMirrorSalesKey() {
  return state.currentUser ? `${STORAGE_KEY}:tab-mirror:${state.currentUser.id}` : "";
}

/** نسخة لكل مستخدم تُحدَّث عند كل حفظ؛ تُقرأ مبكرًا عند التحميل لتقليل ضياع F5 */
function persistentDeviceSalesKey() {
  return state.currentUser ? `${STORAGE_KEY}:persist:${state.currentUser.id}` : `${STORAGE_KEY}:persist:guest`;
}

/** صف وحيد يشتبه أنه عملية يومية (نسخ قديمة أو حقول مختلفة الاسم). */
function rowLooksLikeSaleRecord(row) {
  if (!row || typeof row !== "object") return false;
  if ("totalSale" in row || "qty" in row || "unitPrice" in row) return true;
  const dateOk = row.date != null && String(row.date).trim().length >= 8;
  const productOk = row.product != null && String(row.product).trim() !== "";
  if (dateOk && productOk) return true;
  if (productOk && ("cost" in row || "unpaid" in row || "unpaidAmount" in row || "profit" in row)) return true;
  return false;
}

/** يعتبر المحتوى قائمة عمليات يومية قابلة للدمج إن كان هيكلًا معروفًا */
function arrayLooksLikeDailySalesRecords(list) {
  if (!Array.isArray(list) || list.length === 0) return false;
  let hits = 0;
  const sample = list.slice(0, 40);
  for (const row of sample) {
    if (!row || typeof row !== "object") continue;
    if ("totalSale" in row || "qty" in row) hits++;
    if ("product" in row || "description" in row) hits++;
  }
  return hits >= Math.min(sample.length * 2, 4);
}

function arrayLooksLikeDailySalesRecordsRelaxed(list) {
  if (!Array.isArray(list) || list.length === 0) return false;
  const cap = Math.min(list.length, 40);
  for (let i = 0; i < cap; i++) {
    if (rowLooksLikeSaleRecord(list[i])) return true;
  }
  return false;
}

/** دمج جهازي + محتوى حساب محدِّث الآن؛ الحالي يغلب عند تعارض نفس المعرف */
async function recoverSalesMergeFromDeviceAndCloud() {
  if (!state.currentUser) {
    alert("سجّل الدخول أولًا لتربط النسَخ بحسابك.");
    return;
  }
  if (
    !confirm(
      "سنجمع كل نسَخ المبيعات المتاحة في هذا المتصفّح مع السجلّ الحالي ثم ما يمكن جلبُه من السحابة (Supabase). تُدار التكرارات تلقائيًا.\nهل تتابع؟"
    )
  ) {
    return;
  }

  const before = state.records.length;
  const salvagePack = loadSalesFromAllLocalSnapshots();
  let merged = mergeSalesListsLocalRemote(salvagePack.list, state.records);
  let remotePullHadRows = false;
  let remotePullFailed = false;

  if (ensureSupabaseClient() && state.db) {
    const remotePull = await loadRecordsFromRemote({ quiet: true });
    remotePullFailed = !remotePull.ok;
    remotePullHadRows = remotePull.records.length > 0;
    if (remotePull.ok && remotePull.records.length > 0) {
      merged = mergeSalesListsLocalRemote(remotePull.records, merged);
    }
  }

  merged.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.recordId || "").localeCompare(String(a.recordId || "")));
  state.records = merged;

  ensureAllSalesRecordsHaveIds();
  saveRecords();
  renderSalesAppShell();

  const n = state.records.length;

  if (state.db && n > 0) {
    await upsertManyRemote(state.records);
  }

  if (n === 0) {
    setSyncStatus(
      remotePullHadRows === false && salvagePack.sources === 0
        ? "لم توجد أي نسخة للاستعادة في هذا المتصفّح أو على هذا الحساب السحابي."
        : "لم يبق أي صف بعد الدمج (قد تكون كل النُّسَخ فارغة أو تالفة).",
      false
    );
    log("info", "recover_sales_merge_done", { salvageSources: salvagePack.sources, now: 0, before });
    return;
  }

  const gained = Math.max(0, n - before);
  if (gained > 0) addDeletionLog(`استعادة مبيعات: أصبح السجلّ ${n} عملية (${gained} كانت غير ظاهرة قبل الضم).`);

  let msg =
    gained > 0
      ? `تم الضم: عندك ${n} عملية (زاد ${gained} عن عدد المعروض سابقًا). راجع «سجل الأيام».`
      : `السجل الآن ${n} عملية؛ لم تُضاف صفوف جديدة (النُّسَخ أو السحابة مطابقة لما لديك أو لا يتوفر إلا هذا العدد).`;
  if (remotePullFailed) msg += " تعذّر جلب جزء السحابة لهذه المحاولة — أُكمِل الدمج المحلي فقط.";
  setSyncStatus(msg, gained > 0 || remotePullHadRows);

  log("info", "recover_sales_merge_done", {
    salvageSources: salvagePack.sources,
    now: n,
    before,
    gained,
    remotePullHadRows,
    remotePullFailed
  });
}

/**
 * تجمع نسَخ المبيعات تحت STORAGE_KEY وفروعه (مسح المرآة، المفضّلة، ثم بقية المفاتيح).
 */
function loadSalesFromAllLocalSnapshots() {
  const chunks = [];
  const scannedKeys = new Set();

  function addChunkFromRaw(raw, keyLabel) {
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const arr = Array.isArray(parsed) ? parsed : [];
    if (arr.length === 0) return;
    const safeObjs = arr.filter((r) => r && typeof r === "object");
    if (safeObjs.length === 0) return;

    const looksOk =
      arrayLooksLikeDailySalesRecords(arr) || arrayLooksLikeDailySalesRecordsRelaxed(arr);

    let list = normalizeRecordsStep2(normalizeRecordsStep1(safeObjs));
    if (!looksOk) {
      list = list.filter((r) => r && typeof r === "object" && rowLooksLikeSaleRecord(r));
    }
    if (list.length === 0) return;
    chunks.push({ list, key: keyLabel });
  }

  const mirrorK = tabSessionMirrorSalesKey();
  if (mirrorK) {
    try {
      addChunkFromRaw(sessionStorage.getItem(mirrorK), `${mirrorK}@session`);
    } catch (err) {
      log("warn", "session_mirror_read_failed", String(err?.message || err));
    }
  }

  const prioritized = [
    ...new Set(
      [persistentDeviceSalesKey(), userRecoverSalesKey(), userStorageKey(), backupStorageKey(), STORAGE_KEY, emergencyRecordsKey()].filter(Boolean)
    )
  ];
  for (const k of prioritized) {
    if (!k) continue;
    scannedKeys.add(k);
    addChunkFromRaw(localStorage.getItem(k), k);
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || scannedKeys.has(key)) continue;
      if (key !== STORAGE_KEY && !key.startsWith(`${STORAGE_KEY}:`)) continue;
      scannedKeys.add(key);
      addChunkFromRaw(localStorage.getItem(key), key);
    }
  } catch (err) {
    log("warn", "local_storage_scan_sales_keys_failed", String(err?.message || err));
  }

  function addUserKeyRawFallback() {
    const rk = userStorageKey();
    const raw = rk ? localStorage.getItem(rk) : null;
    if (!raw || raw.trim() === "" || raw.trim() === "[]") return;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const safeObjs = parsed.filter((r) => r && typeof r === "object");
      if (!safeObjs.length) return;
      let list = normalizeRecordsStep2(normalizeRecordsStep1(safeObjs));
      list = list.filter((r) => r && rowLooksLikeSaleRecord(r));
      if (!list.length) return;
      chunks.push({ list, key: `${rk}+fallback` });
      log("warn", "local_load_user_key_fallback_used", { count: list.length });
    } catch {
      //
    }
  }

  if (chunks.length === 0 && state.currentUser) addUserKeyRawFallback();

  if (chunks.length === 0) return { list: [], sources: 0 };

  chunks.sort((a, b) => b.list.length - a.list.length);
  let acc = [];
  const keyTrail = [];
  for (const { list, key } of chunks) {
    acc = mergeSalesListsLocalRemote(acc, list);
    keyTrail.push(key);
  }

  log("info", "local_load_merged", { sources: chunks.length, count: acc.length, keysSample: keyTrail.slice(0, 8) });
  return { list: acc, sources: chunks.length };
}

function saveRecords(options = {}) {
  const { allowEmptyBackup = false, allowEmptyPersist = false } = options;
  const payload = JSON.stringify(state.records);
  const isEmpty = state.records.length === 0;
  /**
   * لا تُستبدل نسخة المستخدم بـ [] إلا عند مسح متعمّد (إعدادات) أو حذف آخر سجل.
   * يمنع سيناريوهات يصبح فيها الذاكرة فارغة لخطأ مزامنة/تسلسل فيُحذف التخزين الجيد.
   */
  if (isEmpty && !allowEmptyBackup && !allowEmptyPersist) {
    log("warn", "save_records_skip_empty_unauthorized", {});
    return;
  }

  localStorage.setItem(userStorageKey(), payload);
  try {
    const mk = tabSessionMirrorSalesKey();
    if (mk) {
      if (state.records.length > 0) sessionStorage.setItem(mk, payload);
      else sessionStorage.removeItem(mk);
    }
  } catch (_) {}

  const recoverK = userRecoverSalesKey();

  if (state.records.length > 0) {
    /** القائمة غير فارغة: تحديث كل مخازن السلامة */
    localStorage.setItem(emergencyRecordsKey(), payload);
    localStorage.setItem(backupStorageKey(), payload);
    if (recoverK) localStorage.setItem(recoverK, payload);
    try {
      localStorage.setItem(persistentDeviceSalesKey(), payload);
    } catch (_) {}
  } else if (allowEmptyBackup) {
    /** مسح مقصود فقط عبر أزرار الإعدادات */
    localStorage.setItem(emergencyRecordsKey(), payload);
    localStorage.setItem(backupStorageKey(), payload);
    if (recoverK) localStorage.removeItem(recoverK);
    try {
      localStorage.removeItem(persistentDeviceSalesKey());
    } catch (_) {}
  } else if (allowEmptyPersist && isEmpty) {
    /** حذف آخر عملية؛ لا نترك persist بقائمة قديمة */
    try {
      localStorage.removeItem(persistentDeviceSalesKey());
    } catch (_) {}
  }
  /** إن كانت [] من غير allowEmptyBackup: لا نمسح الطوارئ/النسخ الاحتياطي — قد تبقي آخر قائمة جيّدة */

  log("info", "local_save", {
    key: userStorageKey(),
    count: state.records.length,
    touchedSafetyStores: state.records.length > 0 || allowEmptyBackup,
    intentionalEmpty: allowEmptyBackup && state.records.length === 0
  });
}

/** طبقتان أخريتان قبل إغلاق/تحديث الصفحة (أحيانًا لا يُستدعى saveRecords بوقت كافٍ) */
function bindSalesFlushOnPageHide() {
  if (globalThis.__dailySalesPageHideBound) return;
  globalThis.__dailySalesPageHideBound = true;
  const flush = () => {
    try {
      if (!state.currentUser || state.records.length === 0) return;
      const payload = JSON.stringify(state.records);
      localStorage.setItem(userStorageKey(), payload);
      localStorage.setItem(persistentDeviceSalesKey(), payload);
      localStorage.setItem(emergencyRecordsKey(), payload);
      localStorage.setItem(backupStorageKey(), payload);
      const rk = userRecoverSalesKey();
      if (rk) localStorage.setItem(rk, payload);
      const mk = tabSessionMirrorSalesKey();
      if (mk) sessionStorage.setItem(mk, payload);
    } catch (_) {}
  };
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
}

function loadIdeas() {
  try {
    let raw = localStorage.getItem(userIdeasStorageKey());
    if (!raw) raw = localStorage.getItem(backupIdeasStorageKey());
    if (!raw) raw = localStorage.getItem(IDEAS_STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(emergencyIdeasKey());
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    log("info", "ideas_local_load", { key: userIdeasStorageKey(), count: list.length });
    return list;
  } catch {
    log("warn", "ideas_local_load_failed", { key: userIdeasStorageKey() });
    return [];
  }
}

function normalizeExpensesList(list) {
  return (Array.isArray(list) ? list : [])
    .map((row) => {
      const amount = Math.max(0, Number(row.amount) || 0);
      return {
        expenseId: String(row.expenseId || "").trim() || newRecordId(),
        purchase: String(row.purchase || "").trim(),
        amount,
        date: String(row.date || "").trim()
      };
    })
    .filter((row) => row.purchase.length > 0 || row.amount > 0 || row.date.length > 0);
}

function loadExpenses() {
  try {
    let raw = localStorage.getItem(userExpensesStorageKey());
    if (!raw) raw = localStorage.getItem(backupExpensesStorageKey());
    if (!raw) raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(emergencyExpensesKey());
    const parsed = raw ? JSON.parse(raw) : [];
    const list = normalizeExpensesList(Array.isArray(parsed) ? parsed : []);
    log("info", "expenses_local_load", { key: userExpensesStorageKey(), count: list.length });
    return list;
  } catch {
    log("warn", "expenses_local_load_failed", { key: userExpensesStorageKey() });
    return [];
  }
}

function saveIdeas(options = {}) {
  const { allowEmptyBackup = false } = options;
  const payload = JSON.stringify(state.ideas);
  localStorage.setItem(userIdeasStorageKey(), payload);
  localStorage.setItem(emergencyIdeasKey(), payload);
  if (state.ideas.length > 0 || allowEmptyBackup) {
    localStorage.setItem(backupIdeasStorageKey(), payload);
  }
  log("info", "ideas_local_save", { key: userIdeasStorageKey(), count: state.ideas.length });
}

function saveExpenses(options = {}) {
  const { allowEmptyBackup = false } = options;
  const payload = JSON.stringify(state.expenses);
  localStorage.setItem(userExpensesStorageKey(), payload);
  localStorage.setItem(emergencyExpensesKey(), payload);
  if (state.expenses.length > 0 || allowEmptyBackup) {
    localStorage.setItem(backupExpensesStorageKey(), payload);
  }
  log("info", "expenses_local_save", { key: userExpensesStorageKey(), count: state.expenses.length });
}

function loadInvestors() {
  try {
    let raw = localStorage.getItem(userInvestorsStorageKey());
    if (!raw) raw = localStorage.getItem(backupInvestorsStorageKey());
    if (!raw) raw = localStorage.getItem(INVESTORS_STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(emergencyInvestorsKey());
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    log("info", "investors_local_load", { key: userInvestorsStorageKey(), count: list.length });
    return list;
  } catch {
    log("warn", "investors_local_load_failed", { key: userInvestorsStorageKey() });
    return [];
  }
}

function saveInvestors(options = {}) {
  const { allowEmptyBackup = false } = options;
  const payload = JSON.stringify(state.investors);
  localStorage.setItem(userInvestorsStorageKey(), payload);
  localStorage.setItem(emergencyInvestorsKey(), payload);
  if (state.investors.length > 0 || allowEmptyBackup) {
    localStorage.setItem(backupInvestorsStorageKey(), payload);
  }
  log("info", "investors_local_save", { key: userInvestorsStorageKey(), count: state.investors.length });
}

function loadWasiyyat() {
  try {
    let raw = localStorage.getItem(userWasiyyatStorageKey());
    if (!raw) raw = localStorage.getItem(backupWasiyyatStorageKey());
    if (!raw) raw = localStorage.getItem(WASIYYAT_STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(emergencyWasiyyatKey());
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    log("info", "wasiyyat_local_load", { key: userWasiyyatStorageKey(), count: list.length });
    return list;
  } catch {
    log("warn", "wasiyyat_local_load_failed", { key: userWasiyyatStorageKey() });
    return [];
  }
}

function saveWasiyyat(options = {}) {
  const { allowEmptyBackup = false } = options;
  const payload = JSON.stringify(state.wasiyyat);
  localStorage.setItem(userWasiyyatStorageKey(), payload);
  localStorage.setItem(emergencyWasiyyatKey(), payload);
  if (state.wasiyyat.length > 0 || allowEmptyBackup) {
    localStorage.setItem(backupWasiyyatStorageKey(), payload);
  }
  log("info", "wasiyyat_local_save", { key: userWasiyyatStorageKey(), count: state.wasiyyat.length });
}

function loadDeletionLog() {
  try {
    const raw = localStorage.getItem(userDeletionLogKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDeletionLog() {
  localStorage.setItem(userDeletionLogKey(), JSON.stringify(state.deletionLog));
}

/** @returns {{ ok: boolean, records: any[] }} — ok=false أي فشل الشبكة/المخدم، وليس «لا صفوف» */
async function loadRecordsFromRemote(options = {}) {
  const { quiet = false } = options;
  if (!state.db || !state.currentUser) return { ok: true, records: [] };
  log("info", "remote_select_start", { table: SUPABASE_TABLE, ownerId: state.currentUser.id });
  const { data, error } = await state.db
    .from(SUPABASE_TABLE)
    .select("payload, created_at")
    .eq("owner_id", state.currentUser.id)
    .order("created_at", { ascending: false });
  if (error) {
    log("error", "remote_select_error", { message: error.message, status: error.status, code: error.code });
    if (!quiet) {
      setAuthStatus(`فشل قراءة البيانات من Supabase: ${error.message}`, false);
      setSyncStatus(`فشل القراءة من Supabase: ${error.message}`, false);
    }
    return { ok: false, records: [] };
  }
  const rows = (data || []).length;
  log("info", "remote_select_ok", { rows });
  if (!quiet) setSyncStatus("تم تحميل البيانات من Supabase.", true);
  const records = normalizeRecordsStep2(
    normalizeRecordsStep1((data || []).map((row) => row.payload).filter(Boolean))
  );
  return { ok: true, records };
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

async function deleteRecordRemote(recordId) {
  if (!state.db || !state.currentUser || !recordId) return true;
  log("info", "remote_delete_one_start", { recordId, ownerId: state.currentUser.id });
  const { error } = await state.db
    .from(SUPABASE_TABLE)
    .delete()
    .eq("record_id", recordId)
    .eq("owner_id", state.currentUser.id);
  if (error) {
    log("error", "remote_delete_one_error", { message: error.message, recordId });
    return false;
  }
  log("info", "remote_delete_one_ok", { recordId });
  return true;
}

/** سجلات قديمة بلا recordId: نضيف معرّفًا محليًا فقط (لا نغيّر شكل الحقول الأخرى) */
function ensureAllSalesRecordsHaveIds() {
  let changed = false;
  for (const r of state.records) {
    const c = recordCanonicalId(r);
    if (c && r.recordId !== c) {
      r.recordId = c;
      changed = true;
    }
    if (!r.recordId || String(r.recordId).trim() === "") {
      r.recordId = newRecordId();
      changed = true;
    }
  }
  if (changed) saveRecords();
  return changed;
}

function computeRecord(base, existingRecordId) {
  const totalSale = Number(base.totalSale);
  const repaid = String(base.debtRepaidDate || "").trim();
  const unpaidSource = repaid ? 0 : base.unpaidAmount;
  const unpaidAmount = clampUnpaid(totalSale, unpaidSource);
  const rawForm = Number(base.unpaidRawFromForm);
  const enteredFromForm = clampUnpaid(totalSale, Number.isFinite(rawForm) ? rawForm : unpaidAmount);

  let prev = null;
  if (existingRecordId != null && String(existingRecordId).trim() !== "") {
    prev = state.records.find((r) => recordCanonicalId(r) === String(existingRecordId).trim());
  }
  const prevSnap = prev != null ? clampUnpaid(totalSale, Number(prev.originalDebtAtSale) || 0) : 0;
  const prevOpenUnpaid = prev != null ? clampUnpaid(totalSale, prev.unpaidAmount ?? prev.unpaid ?? 0) : 0;

  let originalDebtAtSale = 0;
  if (repaid.length > 0) {
    originalDebtAtSale = Math.max(prevSnap, prevOpenUnpaid, enteredFromForm, unpaidAmount);
  } else {
    originalDebtAtSale = Math.max(prevSnap, unpaidAmount, enteredFromForm);
  }
  originalDebtAtSale = clampUnpaid(totalSale, originalDebtAtSale);

  const profit = totalSale - base.cost;
  const reinvest = profit * 0.1;
  const netProfit = profit - reinvest;
  const newCapital = base.cost + reinvest;
  const recordId =
    existingRecordId != null && String(existingRecordId).trim() !== "" ? String(existingRecordId).trim() : newRecordId();
  return {
    date: base.date,
    product: base.product,
    description: base.description,
    totalSale,
    unpaidAmount,
    originalDebtAtSale,
    debtCleared: repaid.length > 0,
    debtClearedAt: repaid.length > 0 ? repaid : null,
    cost: base.cost,
    recordId,
    profit,
    reinvest,
    netProfit,
    newCapital
  };
}

function clearSaleEditMode() {
  state.editingSaleRecordId = null;
  const submit = document.getElementById("saleSubmitBtn");
  const cancel = document.getElementById("cancelSaleEditBtn");
  if (submit) {
    submit.textContent = "إضافة سجل اليوم";
    submit.classList.remove("btn-success-cta");
  }
  if (cancel) cancel.classList.add("hidden");
}

function applyRecordToSaleForm(rec) {
  if (!rec) return;
  dom.fields.date.value = String(rec.date || "");
  dom.fields.product.value = String(rec.product || "");
  dom.fields.description.value = String(rec.description || "");
  dom.fields.totalSale.value = String(rec.totalSale ?? "");
  dom.fields.cost.value = String(rec.cost ?? "");
  const orig = originalUnpaid(rec);
  if (rec.debtCleared) {
    dom.fields.unpaidAmount.value = "";
    const d = String(rec.debtClearedAt || "").trim();
    dom.debtRepaidDate.value = d.length >= 10 ? d.slice(0, 10) : d;
  } else {
    dom.fields.unpaidAmount.value = orig > 0 ? String(orig) : "";
    if (dom.debtRepaidDate) dom.debtRepaidDate.value = "";
  }
  syncDebtRepaidUi();
}

/** بعد «تمرير» لمربع البيع: يظهر النموذج ويُركَّز على ما كُتِب لتقليل خطأ الزبائن */
function scrollAndFocusSaleFormForEdit(rec) {
  const anchor = dom.salesSectionCard || dom.form;
  if (anchor) scrollToPanel(anchor);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        const desc = dom.fields.description;
        const prod = dom.fields.product;
        const descLen = String(rec?.description || "").trim().length;
        /** أولًا وصف البيع إن له نص؛ وإلا اسم المنتج */
        let el =
          descLen >= 4 && desc ? desc : prod && String(rec?.product || "").trim().length > 0 ? prod : prod || desc || dom.fields.date;
        if (!el || typeof el.focus !== "function") return;
        el.focus({ preventScroll: true });
        if (el === prod && typeof el.select === "function") el.select();
      } catch (_) {}
    });
  });
}

function investorPhoneDigits(raw) {
  return String(raw || "").replace(/\D/g, "");
}

function isValidInvestorPhone(raw) {
  const digits = investorPhoneDigits(raw);
  return digits.length >= 8 && digits.length <= 15;
}

function computeIdea(base) {
  const capital = Number(base.capital) || 0;
  const price = Number(base.price) || 0;
  const qty = Number(base.qty) || 0;
  const expectedSales = price * qty;
  const expectedProfit = expectedSales - capital;
  const ideaType = base.ideaType === "service" ? "service" : "product";
  return {
    ideaId: newRecordId(),
    name: base.name,
    description: base.description,
    privateNotes: base.privateNotes || "",
    ideaType,
    capital,
    price,
    qty,
    expectedSales,
    expectedProfit
  };
}

function buildExpenseEntry(raw) {
  const amtRaw = Number(raw.amount);
  const amount = Number.isFinite(amtRaw) && amtRaw >= 0 ? amtRaw : 0;
  return {
    expenseId: newRecordId(),
    purchase: String(raw.purchase || "").trim(),
    amount,
    date: String(raw.date || "").trim()
  };
}

function renderDebtCell(record) {
  if (record.debtCleared) {
    const when = record.debtClearedAt ? escapeHtml(String(record.debtClearedAt)) : "";
    return `<span class="tag-ok">تم دفع الدين</span>${when ? `<br><span style="font-size:12px;color:var(--muted)">${when}</span>` : ""}`;
  }
  const u = originalUnpaid(record);
  if (u <= 0) return `<span style="font-size:12px;color:var(--muted)">لا يوجد آجل مسجّل</span>`;
  return `<button type="button" class="btn-ghost-light btn-small" data-debt-paid="${escapeHtml(recordCanonicalId(record))}">تسجيل دفع الدين</button>`;
}

/** صف في بطاقة سجل اليوم؛ القيمة نص/HTML آمن وفق المتصل */
function dailyKvRow(label, valueHtml) {
  return `<div class="daily-sale-card__row"><span class="daily-sale-card__k">${escapeHtml(label)}</span><span class="daily-sale-card__v">${valueHtml}</span></div>`;
}

function dailyKvMoney(label, formatted) {
  return dailyKvRow(label, escapeHtml(String(formatted)));
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
  let saleIdsBackfilled = false;

  for (const record of state.records) {
    const cid = recordCanonicalId(record);
    if (cid) record.recordId = cid;
    if (!record.recordId || String(record.recordId).trim() === "") {
      record.recordId = newRecordId();
      saleIdsBackfilled = true;
    }
    totalSales += record.totalSale;
    totalProfit += record.profit;
    totalReinvest += record.reinvest;
    totalNetProfit += record.netProfit;
    currentCapital += record.newCapital;
    const orig = displayOriginalReceivable(record);
    const rem = displayRemainingReceivable(record);
    const col = collectedFromCustomer(record);
    sumRemaining += rem;
    sumCollected += col;

    const article = document.createElement("article");
    article.className = "daily-sale-card";
    const desc = String(record.description || "").trim();
    article.innerHTML = `
      <header class="daily-sale-card__head">
        <span class="daily-sale-card__date">${escapeHtml(String(record.date))}</span>
        <h3 class="daily-sale-card__title">${escapeHtml(String(record.product))}</h3>
      </header>
      ${desc ? `<p class="daily-sale-card__desc">${escapeHtml(desc)}</p>` : ""}
      <div class="daily-sale-card__grid">
        ${dailyKvMoney("إجمالي البيع", currency(record.totalSale))}
        ${dailyKvMoney("آجل (أصل)", orig > 0 ? currency(orig) : "—")}
        ${dailyKvMoney(
          "متبقي الآجل",
          rem > 0 ? currency(rem) : orig > 0 ? `${currency(0)} — لا يتبقى` : "—"
        )}
        ${dailyKvMoney("المدفوع", currency(col))}
        ${dailyKvMoney("التكلفة", currency(record.cost))}
        ${dailyKvMoney("الربح", currency(record.profit))}
        ${dailyKvMoney("10% استثمار", currency(record.reinvest))}
        ${dailyKvMoney("صافي الربح", currency(record.netProfit))}
        ${dailyKvMoney("رأس المال الجديد", currency(record.newCapital))}
      </div>
      <div class="daily-sale-card__debtblock">
        <span class="daily-sale-card__k">دفع الدين</span>
        <div class="daily-sale-card__debtactions">${renderDebtCell(record)}</div>
      </div>
      <div class="daily-sale-card__editrow">
        <button type="button" class="btn-ghost-light btn-small" data-sale-edit="${escapeHtml(recordCanonicalId(record))}">تعديل</button>
        <button type="button" class="btn-ghost-light btn-small" data-sale-delete="${escapeHtml(recordCanonicalId(record))}" style="color:var(--danger)">حذف</button>
      </div>`;
    dom.rowsContainer.appendChild(article);
  }

  if (saleIdsBackfilled) saveRecords();

  dom.totals.totalSalesEl.textContent = currency(totalSales);
  dom.totals.totalProfitEl.textContent = currency(totalProfit);
  dom.totals.totalReinvestEl.textContent = currency(totalReinvest);
  dom.totals.totalNetProfitEl.textContent = currency(totalNetProfit);
  dom.totals.currentCapitalEl.textContent = currency(currentCapital);
  dom.totals.totalUnpaidEl.textContent = currency(sumRemaining);
  dom.totals.totalPaidEl.textContent = currency(sumCollected);
  dom.emptyState.style.display = state.records.length === 0 ? "block" : "none";
  renderDailySalesSummary();
  renderMonthlyProfitSummary();

  if (dom.sidebarNetProfit) dom.sidebarNetProfit.textContent = currency(totalNetProfit);
  if (dom.sidebarCapital) dom.sidebarCapital.textContent = currency(currentCapital);
  if (dom.sidebarReceivables) dom.sidebarReceivables.textContent = currency(sumRemaining);
  if (dom.dashboardHeroProfit && dom.totals.totalProfitEl)
    dom.dashboardHeroProfit.textContent = dom.totals.totalProfitEl.textContent;
  if (dom.sidebarProfitTrend) {
    if (state.records.length === 0) dom.sidebarProfitTrend.textContent = "—";
    else if (totalProfit > 0) dom.sidebarProfitTrend.textContent = "+ نشاط";
    else if (totalProfit < 0) dom.sidebarProfitTrend.textContent = "تنبيه";
    else dom.sidebarProfitTrend.textContent = "متعادل";
  }

  renderFinanceHub();
  renderInsights();

  log("info", "render_done", { rowsRendered: state.records.length });
}

function renderDailySalesSummary() {
  if (!dom.dailySalesSummary) return;
  const salesByDay = new Map();
  for (const rec of state.records) {
    const key = String(rec.date || "").trim();
    if (!key) continue;
    salesByDay.set(key, (salesByDay.get(key) || 0) + (Number(rec.totalSale) || 0));
  }

  const entries = [...salesByDay.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  if (entries.length === 0) {
    dom.dailySalesSummary.innerHTML = `<div class="rank-item"><span>لا توجد بيانات يومية بعد</span><strong>—</strong></div>`;
    return;
  }

  dom.dailySalesSummary.innerHTML = entries
    .slice(0, 15)
    .map(([day, total]) => `<div class="rank-item"><span>${escapeHtml(day)}</span><strong>${currency(total)}</strong></div>`)
    .join("");
}

function renderMonthlyProfitSummary() {
  if (!dom.monthlyProfitSummary) return;
  const profitByMonth = new Map();
  for (const rec of state.records) {
    const d = String(rec.date || "").trim();
    if (!d) continue;
    const monthKey = d.length >= 7 ? d.slice(0, 7) : d;
    profitByMonth.set(monthKey, (profitByMonth.get(monthKey) || 0) + (Number(rec.netProfit) || 0));
  }

  const entries = [...profitByMonth.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  if (entries.length === 0) {
    dom.monthlyProfitSummary.innerHTML = `<div class="rank-item"><span>لا توجد بيانات شهرية بعد</span><strong>—</strong></div>`;
    return;
  }

  dom.monthlyProfitSummary.innerHTML = entries
    .map(([month, totalProfit]) => `<div class="rank-item"><span>${escapeHtml(month)}</span><strong>${currency(totalProfit)}</strong></div>`)
    .join("");
}

/** يحدّث بطاقات «المبيعات اليومية + المصروفات + الوصيات» في ملخص المشروع */
function renderFinanceHub() {
  const fusionEl = document.getElementById("hubFusionLine");
  if (!fusionEl) return;

  const salesOps = state.records.length;
  const totalSalesAmt = state.records.reduce((acc, r) => acc + (Number(r.totalSale) || 0), 0);
  const totalNet = state.records.reduce((acc, r) => acc + (Number(r.netProfit) || 0), 0);

  const expCnt = state.expenses.length;
  const expSum = state.expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  const wyCnt = state.wasiyyat.length;
  const wyCap = state.wasiyyat.reduce((acc, w) => acc + (Number(w.capital) || 0), 0);
  const wyPrice = state.wasiyyat.reduce((acc, w) => acc + (Number(w.productPrice) || 0), 0);

  const setTxt = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };

  setTxt("hubSalesOps", String(salesOps));
  setTxt("hubSalesTotalRef", currency(totalSalesAmt));
  setTxt("hubNetProfitRef", currency(totalNet));

  setTxt("hubExpenseCount", String(expCnt));
  setTxt("hubExpenseSum", currency(expSum));

  setTxt("hubWasiyyatCount", String(wyCnt));
  setTxt("hubWasiyyatCapital", currency(wyCap));
  setTxt("hubWasiyyatPrice", currency(wyPrice));

  const afterExp = totalNet - expSum;
  fusionEl.textContent = `ربط الموازنة: صافي الربح من سجل المبيعات ${currency(totalNet)} ناقص إجمالي المصروفات ${currency(expSum)} = ${currency(
    afterExp
  )}. — الوصيات: ${wyCnt} صفًا؛ رأس مال مربوط ${currency(wyCap)}؛ ثمن متوقع للبيع ${currency(wyPrice)}.`;
}

function renderIdeasPreview() {
  const capital = Number(dom.ideaFields.capital.value) || 0;
  const price = Number(dom.ideaFields.price.value) || 0;
  const qty = Number(dom.ideaFields.qty.value) || 0;
  const expectedSales = price * qty;
  const expectedProfit = expectedSales - capital;
  const marginPct = expectedSales > 0 ? Math.round((expectedProfit / expectedSales) * 100) : 0;
  dom.ideaTotals.expectedSalesEl.textContent = currency(expectedSales);
  dom.ideaTotals.expectedProfitEl.textContent = currency(expectedProfit);
  if (dom.ideaTotals.profitMarginEl) dom.ideaTotals.profitMarginEl.textContent = `${marginPct}%`;

  if (!dom.ideaAdvice) return;
  if (expectedProfit <= 0) {
    dom.ideaAdvice.innerHTML =
      "<strong>💡 نصيحة قوية</strong><span class='idea-profit-weak'>الربح المتوقع ضعيف ❌</span> — ما تبدأش فيها وركّز على فكرة أقوى.";
    return;
  }
  dom.ideaAdvice.innerHTML =
    "<strong>💡 نصيحة قوية</strong><span class='idea-profit-good'>فكرة فيها ربح واضح ✅</span> — تنجم تركز عليها بعد مقارنة باقي الأفكار.";
}

function ideaTypeLabel(idea) {
  const t = idea?.ideaType || "product";
  return t === "service" ? "خدمة" : "منتج";
}

function syncIdeaTypeUi() {
  const isService = !!dom.ideaTypeService?.checked;
  if (dom.ideaPriceLabel) {
    dom.ideaPriceLabel.textContent = isService ? "سعر الخدمة المتوقع (د)" : "سعر البيع المتوقع (د)";
  }
  if (dom.ideaQtyLabel) {
    dom.ideaQtyLabel.textContent = isService ? "عدد الزبائن المتوقع" : "الكمية المتوقعة";
  }
  if (dom.ideaFields.qty) {
    dom.ideaFields.qty.placeholder = isService ? "عدد الزبائن (مثال: 10)" : "10";
  }
  if (dom.ideaTypeHint) {
    dom.ideaTypeHint.innerHTML = isService
      ? "اختر النوع قبل إدخال الفكرة: <strong>منتج = بيع + مخزون + الكمية المتوقعة</strong> — <strong>خدمة = عمل + زبائن + عدد الزبائن المتوقع</strong>"
      : "اختر النوع قبل إدخال الفكرة: <strong>منتج = بيع + مخزون + الكمية المتوقعة</strong> — <strong>خدمة = عمل + زبائن + عدد الزبائن المتوقع</strong>";
  }
}

function renderIdeas() {
  if (!dom.ideaRowsContainer) return;
  dom.ideaRowsContainer.innerHTML = "";
  for (const idea of state.ideas) {
    const sales = Number(idea.expectedSales) || 0;
    const profit = Number(idea.expectedProfit) || 0;
    const marginPct = sales > 0 ? Math.round((profit / sales) * 100) : 0;
    const desc = String(idea.description || "").trim();
    const article = document.createElement("article");
    article.className = "idea-log-card";
    article.innerHTML = `
      <header class="idea-log-card__head">
        <span class="idea-log-card__type">${escapeHtml(ideaTypeLabel(idea))}</span>
        <h3 class="idea-log-card__title">${escapeHtml(String(idea.name || ""))}</h3>
      </header>
      ${desc ? `<p class="idea-log-card__desc">${escapeHtml(desc)}</p>` : ""}
      <div class="idea-log-card__grid">
        ${dailyKvMoney("رأس المال", currency(Number(idea.capital) || 0))}
        ${dailyKvMoney("السعر", currency(Number(idea.price) || 0))}
        ${dailyKvRow("الكمية", escapeHtml(String(Number(idea.qty) || 0)))}
        ${dailyKvMoney("إجمالي البيع", currency(sales))}
        ${dailyKvMoney("الربح المتوقع", currency(profit))}
        ${dailyKvRow("الهامش", escapeHtml(`${marginPct}%`))}
      </div>`;
    dom.ideaRowsContainer.appendChild(article);
  }
  dom.ideasEmptyState.style.display = state.ideas.length === 0 ? "block" : "none";
  renderInsights();
}

function renderExpenses() {
  if (!dom.expenseCards || !dom.expensesEmptyState) return;
  dom.expenseCards.innerHTML = "";
  const list = [...state.expenses].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  for (const row of list) {
    const article = document.createElement("article");
    article.className = "expense-log-card";
    const idEsc = escapeHtml(String(row.expenseId || ""));
    article.innerHTML = `
      <div class="expense-log-card__head">
        <span class="expense-log-card__date">${escapeHtml(String(row.date || "—"))}</span>
        <button type="button" class="btn-ghost-light btn-small" data-expense-delete="${idEsc}" style="color:var(--danger)">حذف</button>
      </div>
      <h3 class="expense-log-card__title">${escapeHtml(String(row.purchase || "—"))}</h3>
      <div class="expense-log-card__grid">
        ${dailyKvMoney("الثمن", currency(Number(row.amount) || 0))}
      </div>`;
    dom.expenseCards.appendChild(article);
  }
  dom.expensesEmptyState.style.display = state.expenses.length === 0 ? "block" : "none";
}

function renderWasiyyat() {
  if (!dom.wasiyyatRowsContainer || !dom.wasiyyatEmptyState) return;
  dom.wasiyyatRowsContainer.innerHTML = "";
  for (const row of state.wasiyyat) {
    const completion = row.completionDate && String(row.completionDate).trim() ? escapeHtml(String(row.completionDate)) : "—";
    const tr = document.createElement("tr");
    const idEsc = escapeHtml(String(row.wasiyyatId || ""));
    tr.innerHTML = `
      <td>${currency(Number(row.capital) || 0)}</td>
      <td>${currency(Number(row.productPrice) || 0)}</td>
      <td>${escapeHtml(String(row.saleDate || ""))}</td>
      <td>${completion}</td>
      <td>${escapeHtml(String(row.personName || ""))}</td>
      <td>${row.phone ? escapeHtml(String(row.phone)) : "—"}</td>
      <td><button type="button" class="btn-ghost-light btn-small" data-wasiyyat-delete="${idEsc}" style="color:var(--danger)">حذف</button></td>
    `;
    dom.wasiyyatRowsContainer.appendChild(tr);
  }
  dom.wasiyyatEmptyState.style.display = state.wasiyyat.length === 0 ? "block" : "none";
  renderFinanceHub();
}

function renderInvestors() {
  if (!dom.investorRowsContainer || !dom.investorsEmptyState) return;
  dom.investorRowsContainer.innerHTML = "";
  for (const item of state.investors) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(String(item.name || ""))}</td>
      <td>${escapeHtml(ideaTypeLabel(item))}</td>
      <td>${escapeHtml(String(item.description || ""))}</td>
      <td>${item.contactPhone ? escapeHtml(String(item.contactPhone)) : "—"}</td>
      <td>${currency(Number(item.capital) || 0)}</td>
      <td>${currency(Number(item.expectedSales) || 0)}</td>
      <td>${Number(item.qty) || 0}</td>
      <td>${escapeHtml(String(item.createdAt || ""))}</td>
    `;
    dom.investorRowsContainer.appendChild(tr);
  }
  dom.investorsEmptyState.style.display = state.investors.length === 0 ? "block" : "none";
}

function renderDeletionLog() {
  if (!dom.deletionLogList) return;
  if (state.deletionLog.length === 0) {
    dom.deletionLogList.innerHTML = `<div class="rank-item"><span>لا توجد عمليات حذف بعد</span><strong>—</strong></div>`;
    return;
  }
  dom.deletionLogList.innerHTML = state.deletionLog
    .slice(0, 30)
    .map((item) => `<div class="rank-item"><span>${escapeHtml(String(item.message || ""))}</span><strong>${escapeHtml(String(item.at || ""))}</strong></div>`)
    .join("");
}

function addDeletionLog(message) {
  state.deletionLog.unshift({
    message,
    at: new Date().toLocaleString("ar")
  });
  saveDeletionLog();
  renderDeletionLog();
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
    state.expenses = [];
    state.wasiyyat = [];
    render();
    renderIdeas();
    renderExpenses();
    renderWasiyyat();
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
    closeSidebarDrawerIfMobile();
    // Always logout locally first so the button never appears "stuck".
    applySignedOutState("تم تسجيل الخروج.");

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
  bindSalesFlushOnPageHide();
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
        applySignedOutState("تم تسجيل الخروج.");
        return;
      }

      await refreshSessionState();
    });
  }

  function syncDebtRepaidUi() {
    const hasDate = !!String(dom.debtRepaidDate?.value || "").trim();
    if (hasDate) {
      dom.fields.unpaidAmount.value = "";
      dom.fields.unpaidAmount.disabled = true;
    } else dom.fields.unpaidAmount.disabled = false;
  }

  dom.debtRepaidDate?.addEventListener("change", () => {
    log("info", "debt_repaid_date_change", { value: dom.debtRepaidDate?.value ?? "" });
    syncDebtRepaidUi();
  });
  syncDebtRepaidUi();

  bindSidebarDrawerUi();

  dom.showSalesSectionBtn?.addEventListener("click", () => setActiveSection("sales"));
  dom.showIdeasSectionBtn?.addEventListener("click", () => setActiveSection("ideas"));

  document.getElementById("dashboardQuickActions")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-quick]");
    if (!btn) return;
    handleDashboardQuick(btn.getAttribute("data-quick"));
  });

  dom.projectSummarySection?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-quick]");
    if (!btn) return;
    handleDashboardQuick(btn.getAttribute("data-quick"));
  });

  document.getElementById("bottomNav")?.addEventListener("click", (event) => {
    const v = event.target.closest("[data-bottom-view]")?.getAttribute("data-bottom-view");
    if (v === "summary") setMainView("summary");
    else if (v === "daily") setMainView("daily");
    else if (v === "ideas") setMainView("ideas");
    else if (v === "investors") setMainView("investors");
    else return;
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  document.getElementById("bnFab")?.addEventListener("click", () => {
    setMainView("sales");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });

  setMainView("summary");

  dom.navSales?.addEventListener("click", () => {
    setMainView("sales");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  dom.navProjectHome?.addEventListener("click", () => {
    setMainView("summary");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  dom.navIdeasForm?.addEventListener("click", () => {
    setMainView("ideas");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  dom.navExpenses?.addEventListener("click", () => {
    setMainView("expenses");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  dom.navWasiyyat?.addEventListener("click", () => {
    setMainView("wasiyyat");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  dom.navInvestors?.addEventListener("click", () => {
    setMainView("investors");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  dom.navDailyLog?.addEventListener("click", () => {
    setMainView("daily");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  dom.navSummary?.addEventListener("click", () => {
    setMainView("summary");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  dom.navReports?.addEventListener("click", () => {
    setMainView("summary");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });
  dom.navSettings?.addEventListener("click", () => {
    setMainView("settings");
    scrollToPanel(dom.workspaceTop);
    closeSidebarDrawerIfMobile();
  });

  dom.fields.unpaidAmount.addEventListener("input", () => {
    const str = dom.fields.unpaidAmount.value.trim();
    if (str === "") return;
    const v = Number(str);
    if (!Number.isFinite(v) || v <= 0) return;
    if (String(dom.debtRepaidDate?.value || "").trim()) {
      dom.debtRepaidDate.value = "";
      syncDebtRepaidUi();
    }
  });

  dom.rowsContainer.addEventListener("click", async (event) => {
    const clickRoot = event.target instanceof Element ? event.target : event.target?.parentElement;
    const editBtn = clickRoot?.closest("[data-sale-edit]");
    if (editBtn && state.currentUser) {
      const id = editBtn.getAttribute("data-sale-edit");
      const rec = state.records.find((r) => recordCanonicalId(r) === String(id || "").trim());
      if (!rec) return;
      state.editingSaleRecordId = id;
      applyRecordToSaleForm(rec);
      const submitBtn = document.getElementById("saleSubmitBtn");
      const cancelBtn = document.getElementById("cancelSaleEditBtn");
      if (submitBtn) {
        submitBtn.textContent = "حفظ التعديلات";
        submitBtn.classList.add("btn-success-cta");
      }
      if (cancelBtn) cancelBtn.classList.remove("hidden");
      setMainView("sales");
      closeSidebarDrawerIfMobile();
      scrollAndFocusSaleFormForEdit(rec);
      return;
    }

    const delBtn = clickRoot?.closest("[data-sale-delete]");
    if (delBtn && state.currentUser) {
      const id = delBtn.getAttribute("data-sale-delete");
      const idx = state.records.findIndex((r) => recordCanonicalId(r) === String(id || "").trim());
      if (idx < 0 || !id) return;
      if (!confirm("حذف هذه العملية من سجل الأيام؟ سُحذف من الجهاز ومن السحابة إن وُجدت مزامنة.")) return;
      const removed = state.records[idx];
      state.records.splice(idx, 1);
      saveRecords(state.records.length === 0 ? { allowEmptyPersist: true } : {});
      if (state.editingSaleRecordId && String(state.editingSaleRecordId) === id) {
        clearSaleEditMode();
        dom.form.reset();
        syncDebtRepaidUi();
      }
      render();
      if (state.db) {
        const remoteOk = await deleteRecordRemote(id);
        if (!remoteOk) {
          state.records.splice(idx, 0, removed);
          saveRecords();
          render();
          setSyncStatus("فشل حذف السطر على السحابة؛ أُعيد السجل محليًا.", false);
          return;
        }
        setSyncStatus("تم حذف العملية من السجل والسحابة.", true);
      } else setSyncStatus("تم حذف العملية من السجل المحلي.", true);
      log("info", "sale_deleted", { recordId: id });
      addDeletionLog(`حذف عملية بيع (${removed.product || id})`);
      return;
    }

    const btn = clickRoot?.closest("[data-debt-paid]");
    if (!btn || !state.currentUser) return;
    const paidId = String(btn.getAttribute("data-debt-paid") || "").trim();
    const rec = state.records.find((r) => recordCanonicalId(r) === paidId);
    if (!rec || rec.debtCleared || remainingUnpaid(rec) <= 0) return;
    if (!confirm("تأكيد أن الزبون سدّى كامل الآجل المسجّل لهذا السطر؟")) return;
    log("info", "debt_mark_paid", { recordId: rec.recordId });
    const owed = clampUnpaid(rec.totalSale, rec.unpaidAmount ?? rec.unpaid ?? 0);
    const prevSnap = Number(rec.originalDebtAtSale);
    rec.originalDebtAtSale = clampUnpaid(rec.totalSale, Math.max(owed, Number.isFinite(prevSnap) ? prevSnap : 0));
    rec.debtCleared = true;
    rec.debtClearedAt = new Date().toISOString().slice(0, 10);
    saveRecords();
    await upsertRecordRemote(rec);
    render();
  });

  document.getElementById("cancelSaleEditBtn")?.addEventListener("click", () => {
    clearSaleEditMode();
    dom.form.reset();
    syncDebtRepaidUi();
  });

  dom.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const repaid = String(dom.debtRepaidDate?.value || "").trim();
    const unpaidStr = dom.fields.unpaidAmount.value.trim();
    const unpaidRaw = unpaidStr === "" ? 0 : Number(unpaidStr);
    const unpaidEffective = repaid ? 0 : unpaidRaw;
    if (!repaid && Number.isNaN(unpaidRaw)) {
      return alert("أدخل رقما صحيحا في خانة «مبيعات غير مدفوعة»، أو اتركها فارغة (صفر).");
    }
    if (repaid && unpaidRaw > 0) return alert("أزل تاريخ إسداد الدين أو احذف مبلغ الآجل — لا يجمع بينهما.");

    const base = {
      date: dom.fields.date.value,
      product: dom.fields.product.value.trim(),
      description: dom.fields.description.value.trim(),
      totalSale: Number(dom.fields.totalSale.value),
      unpaidAmount: unpaidEffective,
      unpaidRawFromForm: unpaidRaw,
      debtRepaidDate: repaid || "",
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
      debtRepaidDate: repaid || null
    });
    try {
      const editingId = state.editingSaleRecordId;
      const newRecord = computeRecord(base, editingId);
      const wasEditing = !!editingId;
      if (wasEditing) {
        const idx = state.records.findIndex((r) => recordCanonicalId(r) === String(editingId));
        if (idx < 0) {
          setSyncStatus("تعذر العثور على السجل المراد تعديله.", false);
          return;
        }
        state.records[idx] = newRecord;
      } else {
        state.records.unshift(newRecord);
      }
      saveRecords();
      render();
      setSyncStatus(wasEditing ? "تم تحديث العملية محليًا." : "تمت إضافة العملية محليًا بنجاح.", true);
      clearSaleEditMode();
      dom.form.reset();
      syncDebtRepaidUi();

      const remoteOk = await upsertRecordRemote(newRecord);
      if (!remoteOk) {
        setSyncStatus(
          wasEditing ? "تم التعديل محليًا؛ فشلت المزامنة مع Supabase." : "تمت إضافة العملية محليًا، لكن فشلت مزامنتها مع Supabase.",
          false
        );
      } else {
        setSyncStatus(
          wasEditing ? "تم حفظ التعديل ومزامنته مع Supabase." : "تمت إضافة العملية ومزامنتها مع Supabase.",
          true
        );
      }
    } catch (err) {
      setSyncStatus(`فشل حفظ العملية: ${err?.message || "خطأ غير معروف"}`, false);
    }
  });

  for (const field of [dom.ideaFields.capital, dom.ideaFields.price, dom.ideaFields.qty]) {
    field.addEventListener("input", renderIdeasPreview);
  }
  dom.ideaTypeProduct?.addEventListener("change", syncIdeaTypeUi);
  dom.ideaTypeService?.addEventListener("change", syncIdeaTypeUi);
  dom.addIdeaToInvestorsBtn?.addEventListener("click", () => {
    if (dom.sendToInvestors) dom.sendToInvestors.checked = true;
    if (typeof dom.ideaForm?.requestSubmit === "function") {
      dom.ideaForm.requestSubmit();
      return;
    }
    dom.ideaForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  dom.wasiyyatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.currentUser) return alert("سجّل الدخول بـ Gmail أولًا.");
    const f = dom.wasiyyatFields;
    if (!f.capital || !f.price || !f.saleDate || !f.personName || !f.phone) return;
    const capital = Number(f.capital.value);
    const productPrice = Number(f.price.value);
    const saleDate = String(f.saleDate.value || "").trim();
    const completionRaw = String(f.completionDate?.value || "").trim();
    const personName = String(f.personName.value || "").trim();
    const phoneRaw = String(f.phone.value || "").trim();
    if (Number.isNaN(capital) || capital < 0) return alert("أدخل رأس مال صالحًا.");
    if (Number.isNaN(productPrice) || productPrice < 0) return alert("أدخل ثمن المنتج صالحًا.");
    if (!saleDate) return alert("اختر تاريخ الاستلام.");
    if (!personName) return alert("أدخل اسم الشخص.");
    if (!isValidInvestorPhone(phoneRaw)) {
      alert("أدخل رقم هاتف صالحًا (8 إلى 15 رقمًا).");
      f.phone.focus();
      return;
    }
    state.wasiyyat.unshift({
      wasiyyatId: newRecordId(),
      capital,
      productPrice,
      saleDate,
      completionDate: completionRaw || null,
      personName,
      phone: phoneRaw
    });
    saveWasiyyat();
    renderWasiyyat();
    dom.wasiyyatForm.reset();
    setSyncStatus("تمت إضافة سجل الوصية.", true);
  });

  dom.wasiyyatRowsContainer?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-wasiyyat-delete]");
    if (!btn || !state.currentUser) return;
    const id = btn.getAttribute("data-wasiyyat-delete");
    const idx = state.wasiyyat.findIndex((w) => String(w.wasiyyatId) === id);
    if (idx < 0) return;
    if (!confirm("حذف هذا السطر من خانة الوصيات؟")) return;
    state.wasiyyat.splice(idx, 1);
    saveWasiyyat();
    renderWasiyyat();
    setSyncStatus("تم حذف سجل الوصية.", true);
  });

  dom.standaloneExpenseForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.currentUser) return alert("سجّل الدخول بـ Gmail أولًا.");
    const f = dom.expenseFields;
    if (!f.purchase || !f.amount || !f.date) return;
    const purchase = f.purchase.value.trim();
    const amtRaw = Number(f.amount.value);
    const amount = f.amount.value.trim() === "" || Number.isNaN(amtRaw) ? 0 : amtRaw;
    const date = f.date.value.trim();
    if (!purchase) return alert("أدخل وصف المشتريات.");
    if (amount < 0 || Number.isNaN(amount)) return alert("أدخل ثمنًا صحيحًا.");
    if (!date) return alert("اختر تاريخ المصروف.");
    const entry = buildExpenseEntry({ purchase, amount, date });
    state.expenses.unshift(entry);
    saveExpenses();
    renderExpenses();
    dom.standaloneExpenseForm.reset();
    setSyncStatus("تم حفظ المصروف.", true);
  });

  dom.expenseCards?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-expense-delete]");
    if (!btn || !state.currentUser) return;
    const id = btn.getAttribute("data-expense-delete");
    const idx = state.expenses.findIndex((e) => String(e.expenseId) === id);
    if (idx < 0) return;
    if (!confirm("حذف هذا المصروف من السجل؟")) return;
    state.expenses.splice(idx, 1);
    saveExpenses();
    renderExpenses();
    setSyncStatus("تم حذف المصروف.", true);
  });

  dom.ideaForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.currentUser) return alert("سجّل الدخول بـ Gmail أولًا.");
    const ideaType =
      dom.ideaTypeService?.checked ? "service" : dom.ideaTypeProduct?.checked ? "product" : "product";
    const base = {
      name: dom.ideaFields.name.value.trim(),
      description: dom.ideaFields.description.value.trim(),
      privateNotes: dom.ideaFields.privateNotes.value.trim(),
      ideaType,
      capital: Number(dom.ideaFields.capital.value),
      price: Number(dom.ideaFields.price.value),
      qty: Number(dom.ideaFields.qty.value)
    };
    if (!base.name || !base.description || base.capital < 0 || Number.isNaN(base.capital) || base.price < 0 || Number.isNaN(base.price) || base.qty < 0 || Number.isNaN(base.qty)) {
      return;
    }
    const idea = computeIdea(base);
    const shouldSendToInvestors = !!dom.sendToInvestors?.checked || base.capital <= 0;
    if (shouldSendToInvestors) {
      const phoneRaw = String(dom.ideaInvestorPhone?.value || "").trim();
      if (!isValidInvestorPhone(phoneRaw)) {
        alert(
          "أدخل رقم هاتف صالح للتواصل قبل الإرسال إلى خانة المستثمرين (8 إلى 15 رقمًا، يمكن أن يبدأ رمز الدولة)."
        );
        dom.ideaInvestorPhone?.focus();
        return;
      }
      state.investors.unshift({
        ...idea,
        // Never expose sensitive implementation notes in investors inbox.
        privateNotes: "",
        contactPhone: phoneRaw,
        createdAt: new Date().toISOString().slice(0, 10)
      });
      saveInvestors();
      renderInvestors();
      setSyncStatus("تم إرسال الفكرة إلى خانة المستثمرين.", true);
    } else {
      state.ideas.unshift(idea);
      saveIdeas();
      renderIdeas();
      setSyncStatus("تمت إضافة الفكرة إلى خانة الأفكار.", true);
    }
    dom.ideaForm.reset();
    if (dom.sendToInvestors) dom.sendToInvestors.checked = false;
    syncIdeaTypeUi();
    renderIdeasPreview();
  });

  dom.resetIdeasBtn?.addEventListener("click", () => {
    if (!state.currentUser) return;
    if (!confirm("هل أنت متأكد من حذف كل الأفكار؟")) return;
    const deletedCount = state.ideas.length;
    state.ideas = [];
    saveIdeas({ allowEmptyBackup: true });
    renderIdeas();
    renderIdeasPreview();
    addDeletionLog(`تم حذف كل الأفكار (${deletedCount})`);
  });

  dom.resetInvestorsBtn?.addEventListener("click", () => {
    if (!state.currentUser) return;
    if (!confirm("هل أنت متأكد من حذف كل أفكار المستثمرين؟")) return;
    const deletedCount = state.investors.length;
    state.investors = [];
    saveInvestors({ allowEmptyBackup: true });
    renderInvestors();
    addDeletionLog(`تم حذف خانة المستثمرين (${deletedCount})`);
  });

  dom.recoverSalesBtn?.addEventListener("click", () => {
    void recoverSalesMergeFromDeviceAndCloud();
  });

  dom.resetBtn?.addEventListener("click", async () => {
    if (!state.currentUser) return alert("سجّل الدخول أولًا.");
    if (!confirm("هل أنت متأكد من حذف كل السجلات؟")) return;
    log("warn", "reset_all_local", { previousCount: state.records.length });
    const deletedCount = state.records.length;
    const uid = state.currentUser.id;
    state.records = [];
    saveRecords({ allowEmptyBackup: true, allowEmptyPersist: true });
    render();
    addDeletionLog(`تم حذف كل المبيعات (${deletedCount})`);

    try {
      const remoteOk = await deleteAllRemote();
      if (!remoteOk) {
        setSalesClearPending(true, uid);
        setSyncStatus("تم مسح المبيعات محليًا؛ لم يتم تأكيد المسح على السحابة. لن يُسترجَع القديم إلى أن ينجح الحذف.", false);
      } else {
        setSalesClearPending(false, uid);
        setSyncStatus("تم مسح كل المبيعات (محليًا وعلى السحابة).", true);
      }
    } catch (err) {
      setSalesClearPending(true, uid);
      setSyncStatus(`تم المسح محليًا؛ خطأ شبكة أو سحابة: ${err?.message || err}`, false);
    }
  });

  refreshAuthButtons();
  setAuthStatus("النظام جاهز. يمكنك تسجيل الدخول أو إنشاء حساب.", true);
  refreshSessionState();
  syncIdeaTypeUi();
  renderIdeasPreview();
  renderInvestors();
  renderWasiyyat();
  renderDeletionLog();
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
