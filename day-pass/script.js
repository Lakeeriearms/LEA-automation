const CONFIG = {
  submissionEndpoint: "https://script.google.com/macros/s/AKfycbwf3r8E_qzQvNmMKfw2FTaaEc_ixx1F8vIv5sJaF5WB73GiRyR5n2KSnyYw1zsIXjy_Vw/exec",
  businessName: "Lake Erie Arms",
  membershipUrl: "https://www.learms.net/memberships",
  maxPassesPerPhonePerYear: 2,
  sources: {
    "scott-leber": "Scott Leber",
  },
};

const form = document.querySelector("#dayPassForm");
const formView = document.querySelector("#formView");
const passView = document.querySelector("#passView");
const formError = document.querySelector("#formError");
const passGuest = document.querySelector("#passGuest");
const passDate = document.querySelector("#passDate");
const passNumber = document.querySelector("#passNumber");
const passAccess = document.querySelector("#passAccess");
const savePassButton = document.querySelector("#savePassButton");
const JSONP_TIMEOUT_MS = 12000;

function getToday() {
  return new Date();
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function dateStamp(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
}

function makePassNumber(date) {
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `LEA-${dateStamp(date)}-${randomPart}`;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function getSourceName() {
  const params = new URLSearchParams(window.location.search);
  const sourceCode = String(params.get("source") || "").trim().toLowerCase();

  return CONFIG.sources[sourceCode] || CONFIG.businessName;
}

function formDataToObject(formElement) {
  const values = Object.fromEntries(new FormData(formElement).entries());
  values.restaurantOnlyAcknowledged =
    formElement.restaurantOnlyAcknowledged.checked;
  values.marketingConsent = formElement.marketingConsent.checked;
  return values;
}

async function submitLead(payload) {
  if (!CONFIG.submissionEndpoint) {
    const existing = JSON.parse(localStorage.getItem("leaDayPassLeads") || "[]");
    const now = new Date(payload.createdAt);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 365);
    const phone = normalizePhone(payload.phone);
    const priorPasses = existing.filter((entry) => {
      const entryDate = new Date(entry.createdAt || entry.timestamp || 0);
      return (
        normalizePhone(entry.phone) === phone &&
        entry.decision !== "LIMIT_REACHED" &&
        entryDate >= cutoff &&
        entryDate <= now
      );
    }).length;

    if (phone && priorPasses >= CONFIG.maxPassesPerPhonePerYear) {
      existing.push({ ...payload, decision: "LIMIT_REACHED" });
      localStorage.setItem("leaDayPassLeads", JSON.stringify(existing));
      return {
        ok: false,
        code: "PASS_LIMIT_REACHED",
        redirectUrl: CONFIG.membershipUrl,
        priorApprovedPassesLast365Days: priorPasses,
      };
    }

    existing.push({ ...payload, decision: "APPROVED" });
    localStorage.setItem("leaDayPassLeads", JSON.stringify(existing));
    return { ok: true };
  }

  return submitLeadWithJsonp(payload);
}

function submitLeadWithJsonp(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `leaDayPassCallback_${Date.now()}_${Math.floor(
      Math.random() * 100000
    )}`;
    const script = document.createElement("script");
    const url = new URL(CONFIG.submissionEndpoint);

    url.searchParams.set("callback", callbackName);
    url.searchParams.set("payload", JSON.stringify(payload));

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("The pass request timed out."));
    }, JSONP_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      cleanup();
      resolve(response || { ok: false });
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("The pass request could not be completed."));
    };

    script.src = url.toString();
    document.head.append(script);
  });
}

function showPass(payload) {
  passGuest.textContent = `${payload.firstName} ${payload.lastName}`;
  passDate.textContent = formatDate(new Date(payload.createdAt));
  passNumber.textContent = payload.passNumber;
  passAccess.textContent = payload.visitType;

  formView.hidden = true;
  passView.hidden = false;
  document.body.classList.add("showing-pass");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearFormNotice() {
  formError.className = "form-error";
  formError.replaceChildren();
  formError.hidden = true;
}

function showFormError(message) {
  formError.className = "form-error";
  formError.textContent = message;
  formError.hidden = false;
}

function showMembershipLimit(response) {
  const passLimit =
    (response && response.maxPassesPerYear) ||
    CONFIG.maxPassesPerPhonePerYear;
  const redirectUrl =
    (response && response.redirectUrl) || CONFIG.membershipUrl;
  const title = document.createElement("strong");
  const copy = document.createElement("span");
  const link = document.createElement("a");

  title.textContent = `It looks like you've already signed up for ${passLimit} day passes this year.`;
  copy.textContent =
    "Please look at our memberships to keep visiting Lake Erie Arms.";
  link.className = "limit-membership-link";
  link.href = redirectUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View Membership Options";

  formError.className = "form-error limit-reached";
  formError.replaceChildren(title, copy, link);
  formError.hidden = false;
  formError.scrollIntoView({ block: "center", behavior: "smooth" });
}

function showRequestedPreviewState() {
  const params = new URLSearchParams(window.location.search);
  const isLocalPreview =
    window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isLocalPreview || params.get("preview") !== "limit") {
    return;
  }

  showMembershipLimit({
    maxPassesPerYear: CONFIG.maxPassesPerPhonePerYear,
    redirectUrl: CONFIG.membershipUrl,
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormNotice();

  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Creating Pass...";

  const now = getToday();
  const passId = makePassNumber(now);
  const payload = {
    ...formDataToObject(form),
    businessName: getSourceName(),
    leadSource: getSourceName(),
    passNumber: passId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      .toISOString(),
  };

  try {
    const response = await submitLead(payload);

    if (response && response.code === "PASS_LIMIT_REACHED") {
      showMembershipLimit(response);
      return;
    }

    if (response && response.ok === false) {
      throw new Error(response.error || "Submission was rejected.");
    }

    showPass(payload);
  } catch (error) {
    showFormError(
      "The pass could not be created. Please ask staff for assistance."
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create Day Pass";
  }
});

savePassButton.addEventListener("click", () => {
  window.print();
});

showRequestedPreviewState();
