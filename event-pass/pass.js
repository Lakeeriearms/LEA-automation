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

  Object.values(window.LEAEvent.stations).forEach((station) => {
    const item = document.createElement("li");
    item.textContent = station.checklistItem;
    checklist.append(item);
  });
})();
