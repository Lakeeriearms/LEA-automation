const SPREADSHEET_ID = "1XAj47kCYJ7MMK4WcsLmGhCyLbRzbMDgfMYw7RKPO_yw";
const HEADER_ROW = 4;
const DATA_START_ROW = 5;

const EVENTS = {
  "event-main": {
    key: "range-to-patio-party",
    name: "Range to Patio Party",
    sheetName: "Range to Patio Party - Aug 8-9",
  },
  "range-to-patio-party": {
    key: "range-to-patio-party",
    name: "Range to Patio Party",
    sheetName: "Range to Patio Party - Aug 8-9",
  },
  "try-before-you-buy": {
    key: "range-to-patio-party",
    name: "Range to Patio Party",
    sheetName: "Range to Patio Party - Aug 8-9",
  },
};

const EVENT_CODE_CAPACITY = 100000;

const EVENT_HEADERS = [
  "Code",
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "City",
  "State",
  "Total Spend",
  "Member / Membership",
  "LEA Range",
  "LUL Immersion Zone",
  "LUL Action Zone",
  "Retail Purchase",
  "LEA Cafe Purchase",
  "Caliber Club Purchase",
  "Photobooth Post",
  "Total Punches",
  "Raffle Entries",
  "Last Updated",
  "Membership Status",
  "Member Amount",
  "Range Amount",
  "Immersion Amount",
  "Action Zone Amount",
  "Retail Amount",
  "LEA Cafe Amount",
  "Caliber Club Amount",
  "Photobooth Amount",
];

const EVENT_PUNCH_COLUMNS = {
  member: 9,
  range: 10,
  "level-up-live-immersion-zone": 11,
  "level-up-live-action-zone": 12,
  retail: 13,
  "lea-cafe": 14,
  "caliber-club": 15,
  photobooth: 16,
};

const EVENT_PURCHASE_COLUMNS = {
  member: 21,
  range: 22,
  "level-up-live-immersion-zone": 23,
  "level-up-live-action-zone": 24,
  retail: 25,
  "lea-cafe": 26,
  "caliber-club": 27,
  photobooth: 28,
};

const STATIONS = {
  member: {
    id: "member",
    name: "Member / Membership",
    checklistItem: "Is member or purchase membership",
    baseEntries: 1,
    purchaseBonusEntries: 0,
    allowsPurchase: true,
  },
  range: {
    id: "range",
    name: "LEA Range",
    checklistItem: "Shoot at the Range",
    baseEntries: 1,
    purchaseBonusEntries: 0,
    allowsPurchase: true,
  },
  "level-up-live-immersion-zone": {
    id: "level-up-live-immersion-zone",
    name: "Level Up Live Immersion Zone",
    checklistItem: "Play in the Immersive Zone",
    baseEntries: 1,
    purchaseBonusEntries: 0,
    allowsPurchase: true,
  },
  "level-up-live-action-zone": {
    id: "level-up-live-action-zone",
    name: "Level Up Live Action Zone",
    checklistItem: "Play in the Action Zone",
    baseEntries: 1,
    purchaseBonusEntries: 0,
    allowsPurchase: true,
  },
  retail: {
    id: "retail",
    name: "Retail",
    checklistItem: "Make Purchase at Retail",
    baseEntries: 1,
    purchaseBonusEntries: 0,
    allowsPurchase: true,
  },
  "lea-cafe": {
    id: "lea-cafe",
    name: "LEA Cafe",
    checklistItem: "Make Purchase at LEA Cafe",
    baseEntries: 1,
    purchaseBonusEntries: 0,
    allowsPurchase: true,
  },
  "caliber-club": {
    id: "caliber-club",
    name: "Caliber Club",
    checklistItem: "Make Purchase at Caliber Club",
    baseEntries: 1,
    purchaseBonusEntries: 0,
    allowsPurchase: true,
  },
  photobooth: {
    id: "photobooth",
    name: "Photobooth",
    checklistItem: "Take photo in booth & post/tag us",
    baseEntries: 1,
    purchaseBonusEntries: 0,
    allowsPurchase: true,
  },
};

function doGet(event) {
  const payload = normalizeParams_(event && event.parameter ? event.parameter : {});
  const result = route_(payload);

  if (payload.callback) {
    const callbackName = String(payload.callback).replace(/[^\w.$]/g, "");
    return ContentService
      .createTextOutput(callbackName + "(" + JSON.stringify(result) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(result);
}

function doPost(event) {
  const payload = parsePayload_(event);
  return json_(route_(payload));
}

function route_(payload) {
  try {
    const event = getEvent_(payload.eventKey);

    switch (payload.action) {
      case "signup":
        return signup_(payload, event);
      case "scan":
        return scan_(payload, event);
      case "lookup":
        return lookup_(payload, event);
      case "setup":
        setupWorkbook_(event);
        return { ok: true, eventName: event.name, message: "Workbook setup complete." };
      case "stations":
        return { ok: true, eventName: event.name, stations: stationList_() };
      default:
        return {
          ok: true,
          eventName: event.name,
          message: "Lake Erie Arms event punch card endpoint is running.",
          actions: ["signup", "scan", "lookup", "stations"],
          stations: stationList_(),
        };
    }
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

function signup_(payload, event) {
  const firstName = clean_(payload.firstName);
  const lastName = clean_(payload.lastName);
  const phone = clean_(payload.phone);
  const email = clean_(payload.email);
  const city = clean_(payload.city);
  const state = clean_(payload.state).toUpperCase();

  if (!firstName || !lastName || (!phone && !email)) {
    throw new Error("First name, last name, and phone or email are required.");
  }

  const guestId = createUniqueGuestId_(event);
  const now = new Date();
  const memberStatus = normalizeMembershipStatus_(payload.memberStatus);

  appendEventSignup_({
    guestId,
    firstName,
    lastName,
    email,
    phone,
    city,
    state,
    memberStatus,
    updatedAt: now,
  }, event);

  return {
    ok: true,
    guest: {
      guestId,
      firstName,
      lastName,
      phone,
      email,
      city,
      state,
      memberStatus,
      createdAt: now.toISOString(),
    },
    stations: stationList_(),
  };
}

function scan_(payload, event) {
  const guestId = clean_(payload.guestId).toUpperCase();
  const stationId = clean_(payload.stationId);
  const station = STATIONS[stationId];

  if (!guestId) {
    throw new Error("Missing guest ID.");
  }

  if (!station) {
    throw new Error("Unknown station: " + stationId);
  }

  const guest = findEventGuest_(guestId, event);
  if (!guest) {
    throw new Error("Guest not found: " + guestId);
  }

  const purchaseAmount = Math.max(0, Number(payload.purchaseAmount || 0));
  const existingPunch = findEventPunch_(guestId, stationId, event);
  const now = new Date();

  if (existingPunch) {
    if (purchaseAmount > 0) {
      const totals = markEventPurchase_(guestId, station.id, purchaseAmount, now, event);
      return {
        ok: true,
        duplicate: true,
        message: "Already punched for " + station.name + ". Purchase amount updated.",
        guest,
        station,
        existingPunch,
        punch: {
          timestamp: now.toISOString(),
          purchaseAmount,
          entries: totals.raffleEntries,
          activityEntries: totals.totalPunches,
          purchaseEntries: totals.purchaseEntries,
        },
      };
    }

    return {
      ok: true,
      duplicate: true,
      message: "Already punched for " + station.name + ".",
      guest,
      station,
      existingPunch,
    };
  }

  const scanId = "SCAN-" + Utilities.getUuid().slice(0, 8).toUpperCase();
  const totals = markEventPunch_(guestId, station.id, purchaseAmount, now, event);

  return {
    ok: true,
    duplicate: false,
    message: "Punch added for " + station.name + ".",
    guest,
    station,
    punch: {
      timestamp: now.toISOString(),
      purchaseAmount,
      entries: totals.raffleEntries,
      activityEntries: totals.totalPunches,
      purchaseEntries: totals.purchaseEntries,
      scanId,
    },
  };
}

function lookup_(payload, event) {
  const guestId = clean_(payload.guestId).toUpperCase();
  const guest = findEventGuest_(guestId, event);

  if (!guest) {
    throw new Error("Guest not found: " + guestId);
  }

  return {
    ok: true,
    guest,
    punches: getEventPunches_(guestId, event),
    stations: stationList_(),
  };
}

function setupWorkbook_(event) {
  ensureEventSheet_(event);
}

function createGuestId_() {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyMMdd");
  const suffix = Utilities.getUuid().replace(/-/g, "").slice(0, 10).toUpperCase();
  return "LEA-" + date + "-" + suffix;
}

function createUniqueGuestId_(event) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const guestId = createGuestId_();

    if (!findEventRow_(getSheet_(event.sheetName), guestId)) {
      return guestId;
    }
  }

  throw new Error("Unable to create a unique guest code. Try again.");
}

function findEventGuest_(guestId, event) {
  const sheet = getSheet_(event.sheetName);
  const row = findEventRow_(sheet, guestId);

  if (!row) {
    return null;
  }

  const values = sheet.getRange(row, 1, 1, EVENT_HEADERS.length).getValues()[0];

  return {
    guestId: values[0],
    firstName: values[1],
    lastName: values[2],
    email: values[3],
    phone: values[4],
    city: values[5],
    state: values[6],
    memberStatus: values[19] || (values[8] === true ? "Member" : "Non member"),
  };
}

function getSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  return sheet;
}

function ensureEventSheet_(event) {
  const sheet = getSheet_(event.sheetName);

  if (sheet.getMaxColumns() < EVENT_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), EVENT_HEADERS.length - sheet.getMaxColumns());
  }

  const headerRange = sheet.getRange(HEADER_ROW, 1, 1, EVENT_HEADERS.length);
  headerRange.setValues([EVENT_HEADERS]);
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(HEADER_ROW);

  const dataRowCount = Math.max(1, sheet.getMaxRows() - DATA_START_ROW + 1);
  sheet.getRange(DATA_START_ROW, 8, dataRowCount, 1).setNumberFormat("$#,##0.00");
  const checkboxRange = sheet.getRange(DATA_START_ROW, 9, dataRowCount, 8);
  checkboxRange.insertCheckboxes();
  sheet.getRange(DATA_START_ROW, 21, dataRowCount, 8).setNumberFormat("$#,##0.00");
}

function appendEventSignup_(guest, event) {
  const sheet = getSheet_(event.sheetName);
  const row = findNextEventRow_(sheet);
  const formulaRow = row;

  sheet.getRange(row, 1, 1, EVENT_HEADERS.length).setValues([[
    guest.guestId,
    guest.firstName,
    guest.lastName,
    guest.email,
    guest.phone,
    guest.city,
    guest.state,
    "=IF(A" + formulaRow + "=\"\",\"\",SUM(U" + formulaRow + ":AB" + formulaRow + "))",
    guest.memberStatus !== "Non member",
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    "=IF(A" + formulaRow + "=\"\",\"\",COUNTIF(I" + formulaRow + ":P" + formulaRow + ",TRUE))",
    "=IF(A" + formulaRow + "=\"\",\"\",Q" + formulaRow + "+IF(Q" + formulaRow + "=8,25,0)+ROUNDDOWN(H" + formulaRow + "/10,0))",
    guest.updatedAt,
    guest.memberStatus,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]]);
}

function findNextEventRow_(sheet) {
  const maxRows = sheet.getMaxRows();
  const values = sheet.getRange(DATA_START_ROW, 1, maxRows - DATA_START_ROW + 1, 1).getValues();

  for (let i = 0; i < values.length; i += 1) {
    if (!values[i][0]) {
      return DATA_START_ROW + i;
    }
  }

  sheet.insertRowsAfter(maxRows, 500);
  return maxRows + 1;
}

function markEventPunch_(guestId, stationId, purchaseAmount, updatedAt, event) {
  const column = EVENT_PUNCH_COLUMNS[stationId];

  if (!column) {
    return getEventEntryTotals_(guestId, event);
  }

  const sheet = getSheet_(event.sheetName);
  const row = findEventRow_(sheet, guestId);

  if (!row) {
    throw new Error("Guest not found: " + guestId);
  }

  sheet.getRange(row, column).setValue(true);
  writeEventPurchaseAmount_(sheet, row, stationId, purchaseAmount);
  sheet.getRange(row, 19).setValue(updatedAt);

  return getEventEntryTotals_(guestId, event);
}

function markEventPurchase_(guestId, stationId, purchaseAmount, updatedAt, event) {
  const sheet = getSheet_(event.sheetName);
  const row = findEventRow_(sheet, guestId);

  if (!row) {
    throw new Error("Guest not found: " + guestId);
  }

  writeEventPurchaseAmount_(sheet, row, stationId, purchaseAmount);
  sheet.getRange(row, 19).setValue(updatedAt);

  return getEventEntryTotals_(guestId, event);
}

function writeEventPurchaseAmount_(sheet, row, stationId, purchaseAmount) {
  const column = EVENT_PURCHASE_COLUMNS[stationId];

  if (!column) {
    return;
  }

  sheet.getRange(row, column).setValue(Math.max(0, Number(purchaseAmount || 0)));
}

function getEventEntryTotals_(guestId, event) {
  const sheet = getSheet_(event.sheetName);
  const row = findEventRow_(sheet, guestId);

  if (!row) {
    return {
      totalPunches: 0,
      purchaseTotal: 0,
      purchaseEntries: 0,
      raffleEntries: 0,
    };
  }

  const checks = sheet.getRange(row, 9, 1, 8).getValues()[0];
  const totalPunches = checks.filter(function (value) { return value === true; }).length;
  const amounts = sheet.getRange(row, 21, 1, 8).getValues()[0];
  const purchaseTotal = amounts.reduce(function (sum, value) {
    return sum + Math.max(0, Number(value || 0));
  }, 0);
  const purchaseEntries = Math.floor(purchaseTotal / 10);
  const completionBonus = totalPunches === 8 ? 25 : 0;
  const raffleEntries = totalPunches + completionBonus + purchaseEntries;

  return {
    totalPunches,
    purchaseTotal,
    purchaseEntries,
    raffleEntries,
  };
}

function findEventPunch_(guestId, stationId, event) {
  const column = EVENT_PUNCH_COLUMNS[stationId];

  if (!column) {
    return null;
  }

  const sheet = getSheet_(event.sheetName);
  const row = findEventRow_(sheet, guestId);

  if (!row) {
    return null;
  }

  if (sheet.getRange(row, column).getValue() !== true) {
    return null;
  }

  const totals = getEventEntryTotals_(guestId, event);

  return {
    guestId,
    stationId,
    stationName: STATIONS[stationId].name,
    entries: totals.raffleEntries,
  };
}

function getEventPunches_(guestId, event) {
  const sheet = getSheet_(event.sheetName);
  const row = findEventRow_(sheet, guestId);

  if (!row) {
    return [];
  }

  const checks = sheet.getRange(row, 9, 1, 8).getValues()[0];
  return stationList_()
    .filter(function (station) {
      const column = EVENT_PUNCH_COLUMNS[station.id];
      return column && checks[column - 9] === true;
    })
    .map(function (station) {
      return {
        stationId: station.id,
        stationName: station.name,
      };
    });
}

function findEventRow_(sheet, guestId) {
  const lastRow = sheet.getLastRow();

  if (lastRow < DATA_START_ROW) {
    return null;
  }

  const values = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 1).getValues();

  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0]).toUpperCase() === guestId) {
      return DATA_START_ROW + i;
    }
  }

  return null;
}

function getEvent_(eventKey) {
  const key = clean_(eventKey) || "range-to-patio-party";
  const event = EVENTS[key];

  if (!event) {
    throw new Error("Unknown event: " + key);
  }

  return event;
}

function stationList_() {
  return Object.keys(STATIONS).map(function (key) {
    return STATIONS[key];
  });
}

function normalizeParams_(params) {
  const payload = {};

  Object.keys(params || {}).forEach(function (key) {
    payload[key] = params[key];
  });

  return payload;
}

function parsePayload_(event) {
  if (!event || !event.postData || !event.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(event.postData.contents);
  } catch (error) {
    return normalizeParams_(event.parameter || {});
  }
}

function normalizeMembershipStatus_(value) {
  const status = clean_(value).toLowerCase();
  const allowed = {
    "non-member": "Non member",
    "non member": "Non member",
    brass: "Brass",
    gold: "Gold",
    platinum: "Platinum",
    charter: "Charter",
    "caliber-member": "Caliber member",
    "caliber member": "Caliber member",
  };

  return allowed[status] || "Non member";
}

function clean_(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
