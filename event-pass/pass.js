(function () {
  const guestName = document.querySelector("#guestName");
  const guestId = document.querySelector("#guestId");
  const qrImage = document.querySelector("#qrImage");
  const checklist = document.querySelector("#checklist");
  const sheetLink = document.querySelector("#sheetLink");
  const storedGuest = window.LEAEvent.getStoredGuest();
  const queryGuestId = window.LEAEvent.getParam("id");
  const guest = storedGuest && (!queryGuestId || storedGuest.guestId === queryGuestId)
    ? storedGuest
    : { guestId: queryGuestId, firstName: "Event", lastName: "Guest" };

  if (sheetLink) {
    sheetLink.href = window.LEAEvent.config.spreadsheetUrl;
  }

  if (!guest.guestId) {
    window.location.href = "../";
    return;
  }

  guestName.textContent = `${guest.firstName || ""} ${guest.lastName || ""}`.trim() || "Event Guest";
  guestId.textContent = guest.guestId;

  const qrPayload = guest.guestId;
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=18&data=${encodeURIComponent(qrPayload)}`;

  const checklistItems = new Map();

  Object.values(window.LEAEvent.stations).forEach((station) => {
    const item = document.createElement("li");
    item.textContent = station.checklistItem;
    item.dataset.stationId = station.id;
    checklistItems.set(station.id, item);
    checklist.append(item);
  });

  let refreshing = false;

  async function refreshPunches() {
    if (refreshing || document.hidden) {
      return;
    }

    refreshing = true;

    try {
      const response = await window.LEAEvent.request({
        action: "lookup",
        guestId: guest.guestId,
      });

      if (!response.ok) {
        return;
      }

      const punchedStations = new Set(
        (response.punches || []).map((punch) => punch.stationId),
      );

      checklistItems.forEach((item, stationId) => {
        const isComplete = punchedStations.has(stationId);
        item.classList.toggle("is-complete", isComplete);
        item.setAttribute("aria-label", `${item.textContent}: ${isComplete ? "complete" : "not complete"}`);
      });

      if (response.guest) {
        guestName.textContent = `${response.guest.firstName || ""} ${response.guest.lastName || ""}`.trim() || "Event Guest";
      }
    } catch (error) {
      // Keep the last known punch state if the tracker is temporarily unavailable.
    } finally {
      refreshing = false;
    }
  }

  refreshPunches();
  const refreshTimer = window.setInterval(refreshPunches, 10000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshPunches();
    }
  });

  window.addEventListener("pagehide", () => {
    window.clearInterval(refreshTimer);
  });
})();
