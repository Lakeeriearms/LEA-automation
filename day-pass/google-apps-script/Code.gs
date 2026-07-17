const SPREADSHEET_ID = "1tHECAraZxA1YZSYEuq527L7zVWBRpd-Uwq-U0oMj-uI";
const SHEET_NAME = "Day Pass Leads";
const MEMBERSHIP_URL = "https://www.learms.net/memberships";
const MAX_PASSES_PER_PHONE_PER_YEAR = 2;
const LIMIT_WINDOW_DAYS = 365;

const HEADERS = [
  "Timestamp",
  "First Name",
  "Last Name",
  "Phone",
  "Email",
  "ZIP",
  "Referral",
  "Visit Type",
  "Pass Number",
  "Business Name",
  "Restaurant/Selected Access Acknowledged",
  "Marketing Consent",
  "Created At",
  "Expires At",
  "Decision",
  "Prior Approved Passes Last 365 Days",
  "Limit Window Start",
  "Limit Window End",
  "Membership Redirect URL",
  "Lead Source",
];

function doPost(event) {
  try {
    const payload = parsePostPayload_(event);
    return json_(processSubmission_(payload));
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function doGet(event) {
  const params = (event && event.parameter) || {};

  if (params.callback || params.payload) {
    try {
      const payload = parseGetPayload_(params);
      return jsonp_(processSubmission_(payload), params.callback);
    } catch (error) {
      return jsonp_({ ok: false, error: String(error) }, params.callback);
    }
  }

  return ContentService
    .createTextOutput(
      "Lake Erie Arms day pass endpoint is running. Sheet target: " +
        getSpreadsheet_().getName()
    )
    .setMimeType(ContentService.MimeType.TEXT);
}

function processSubmission_(payload) {
  const sheet = getLeadSheet_();
  const submittedAt = new Date();
  const normalizedPhone = normalizePhone_(payload.phone);
  const usage = countApprovedPassesForPhone_(sheet, normalizedPhone, submittedAt);
  const limitReached =
    normalizedPhone && usage.count >= MAX_PASSES_PER_PHONE_PER_YEAR;
  const decision = limitReached ? "LIMIT_REACHED" : "APPROVED";

  appendLeadRow_(sheet, payload, {
    submittedAt,
    decision,
    passNumber: limitReached ? "" : payload.passNumber || "",
    priorApprovedPasses: usage.count,
    windowStart: usage.windowStart,
    windowEnd: submittedAt,
    redirectUrl: limitReached ? MEMBERSHIP_URL : "",
  });

  if (limitReached) {
    return {
      ok: false,
      code: "PASS_LIMIT_REACHED",
      message:
        "This phone number has already used the annual day pass limit. Please review membership options.",
      redirectUrl: MEMBERSHIP_URL,
      priorApprovedPassesLast365Days: usage.count,
      maxPassesPerYear: MAX_PASSES_PER_PHONE_PER_YEAR,
    };
  }

  return {
    ok: true,
    sheetName: sheet.getName(),
    priorApprovedPassesLast365Days: usage.count,
    remainingPassesThisYear: Math.max(
      0,
      MAX_PASSES_PER_PHONE_PER_YEAR - usage.count - 1
    ),
  };
}

function appendLeadRow_(sheet, payload, decisionData) {
  const row = makeBlankRow_();
  const acknowledged =
    payload.restaurantOnlyAcknowledged === true ||
    payload.restaurantOnlyAcknowledged === "true";
  const marketingConsent =
    payload.marketingConsent === true || payload.marketingConsent === "true";

  setRowValue_(row, "Timestamp", decisionData.submittedAt);
  setRowValue_(row, "First Name", payload.firstName || "");
  setRowValue_(row, "Last Name", payload.lastName || "");
  setRowValue_(row, "Phone", normalizePhone_(payload.phone));
  setRowValue_(row, "Email", payload.email || "");
  setRowValue_(row, "ZIP", payload.zip || "");
  setRowValue_(row, "Referral", payload.referral || "");
  setRowValue_(row, "Visit Type", payload.visitType || "");
  setRowValue_(row, "Pass Number", decisionData.passNumber);
  setRowValue_(row, "Business Name", payload.businessName || "");
  setRowValue_(row, "Restaurant/Selected Access Acknowledged", acknowledged);
  setRowValue_(row, "Marketing Consent", marketingConsent);
  setRowValue_(row, "Created At", payload.createdAt || "");
  setRowValue_(row, "Expires At", payload.expiresAt || "");
  setRowValue_(row, "Decision", decisionData.decision);
  setRowValue_(
    row,
    "Prior Approved Passes Last 365 Days",
    decisionData.priorApprovedPasses
  );
  setRowValue_(row, "Limit Window Start", decisionData.windowStart);
  setRowValue_(row, "Limit Window End", decisionData.windowEnd);
  setRowValue_(row, "Membership Redirect URL", decisionData.redirectUrl);
  setRowValue_(row, "Lead Source", payload.leadSource || payload.businessName || "");

  sheet.appendRow(row);
}

function countApprovedPassesForPhone_(sheet, normalizedPhone, submittedAt) {
  const windowStart = new Date(submittedAt);
  windowStart.setDate(windowStart.getDate() - LIMIT_WINDOW_DAYS);

  if (!normalizedPhone || sheet.getLastRow() <= 1) {
    return { count: 0, windowStart };
  }

  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, lastColumn)
    .getValues();
  const index = getHeaderIndex_(sheet);
  let count = 0;

  rows.forEach((row) => {
    const rowPhone = normalizePhone_(row[index.Phone]);
    if (rowPhone !== normalizedPhone) {
      return;
    }

    const decision = String(row[index.Decision] || "").trim().toUpperCase();
    if (decision && decision !== "APPROVED") {
      return;
    }

    const rowDate =
      parseDate_(row[index.Timestamp]) || parseDate_(row[index.CreatedAt]);
    if (!rowDate) {
      return;
    }

    if (rowDate >= windowStart && rowDate <= submittedAt) {
      count += 1;
    }
  });

  return { count, windowStart };
}

function getLeadSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    return;
  }

  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const currentHeaders = headerRange.getValues()[0];
  let changed = false;

  HEADERS.forEach((header, index) => {
    if (!currentHeaders[index]) {
      currentHeaders[index] = header;
      changed = true;
    }
  });

  if (changed) {
    headerRange.setValues([currentHeaders]);
  }

  sheet.setFrozenRows(1);
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("No active spreadsheet. Set SPREADSHEET_ID in Code.gs.");
  }

  return spreadsheet;
}

function getHeaderIndex_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length))
    .getValues()[0];

  return {
    Timestamp: headers.indexOf("Timestamp"),
    Phone: headers.indexOf("Phone"),
    CreatedAt: headers.indexOf("Created At"),
    Decision: headers.indexOf("Decision"),
  };
}

function makeBlankRow_() {
  return HEADERS.map(() => "");
}

function setRowValue_(row, header, value) {
  const index = HEADERS.indexOf(header);
  if (index >= 0) {
    row[index] = value;
  }
}

function parsePostPayload_(event) {
  if (!event || !event.postData || !event.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(event.postData.contents);
  } catch (error) {
    return {};
  }
}

function parseGetPayload_(params) {
  if (params.payload) {
    try {
      return JSON.parse(params.payload);
    } catch (error) {
      return {};
    }
  }

  return params;
}

function normalizePhone_(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

function parseDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return value;
  }

  if (typeof value === "number" && isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }

  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return isNaN(date) ? null : date;
  }

  return null;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(payload, callback) {
  const callbackName = String(callback || "");
  const safeCallback = /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callbackName)
    ? callbackName
    : "";

  if (!safeCallback) {
    return json_(payload);
  }

  return ContentService
    .createTextOutput(safeCallback + "(" + JSON.stringify(payload) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
