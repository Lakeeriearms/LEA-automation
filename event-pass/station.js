(function () {
  const title = document.querySelector("#stationTitle");
  const subtitle = document.querySelector("#stationSubtitle");
  const checklist = document.querySelector("#stationChecklist");
  const status = document.querySelector("#scanStatus");
  const video = document.querySelector("#readerVideo");
  const placeholder = document.querySelector("#readerPlaceholder");
  const manualId = document.querySelector("#manualGuestId");
  const lookupButton = document.querySelector("#lookupButton");
  const confirmButton = document.querySelector("#confirmButton");
  const staffName = document.querySelector("#staffName");
  const purchaseAmount = document.querySelector("#purchaseAmount");
  const purchaseField = document.querySelector("#purchaseField");
  const result = document.querySelector("#scanResult");
  const resultName = document.querySelector("#resultName");
  const resultGuestId = document.querySelector("#resultGuestId");
  const resultDetail = document.querySelector("#resultDetail");
  const sheetLink = document.querySelector("#sheetLink");
  const stationButtons = Array.from(document.querySelectorAll("[data-station-option]"));

  let stationId = window.LEAEvent.getParam("station") || window.LEA_STATION_ID || "range";
  let stream;
  let scanning = false;
  let detectedGuestId = "";

  if (sheetLink) {
    sheetLink.href = window.LEAEvent.config.spreadsheetUrl;
  }

  function station() {
    return window.LEAEvent.getStation(stationId);
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status is-visible ${type ? `is-${type}` : ""}`;
  }

  function renderStation() {
    const current = station();
    title.textContent = current.name;
    subtitle.textContent = "Scan a customer pass to check off this station in the raffle tracker.";
    checklist.textContent = current.checklistItem;
    purchaseField.classList.toggle("hide", !current.allowsPurchase);
    stationButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.stationOption === stationId);
    });
  }

  function normalizeGuestId(value) {
    const match = String(value || "").toUpperCase().match(/LEA-\d{6}-[A-Z0-9]{6,12}/);
    return match ? match[0] : String(value || "").trim().toUpperCase();
  }

  async function lookupGuest(value) {
    const guestId = normalizeGuestId(value);

    if (!guestId) {
      setStatus("Scan or type a Guest ID first.", "bad");
      return;
    }

    detectedGuestId = guestId;
    manualId.value = guestId;
    setStatus("Looking up guest...", "");

    const response = await window.LEAEvent.request({ action: "lookup", guestId });

    if (!response.ok) {
      result.classList.add("hide");
      confirmButton.disabled = true;
      setStatus(response.error || "Guest not found.", "bad");
      return;
    }

    result.classList.remove("hide");
    resultName.textContent = `${response.guest.firstName || ""} ${response.guest.lastName || ""}`.trim();
    resultGuestId.textContent = response.guest.guestId;
    resultDetail.textContent = `${response.punches.length} punches already recorded.`;
    confirmButton.disabled = false;
    setStatus("Guest found. Confirm the punch when the activity is complete.", "good");
  }

  async function confirmPunch() {
    if (!detectedGuestId) {
      setStatus("Scan or look up a guest first.", "bad");
      return;
    }

    confirmButton.disabled = true;
    setStatus("Recording punch...", "");

    const response = await window.LEAEvent.request({
      action: "scan",
      guestId: detectedGuestId,
      stationId,
      staffName: staffName.value,
      purchaseAmount: purchaseAmount.value || 0,
    });

    if (!response.ok) {
      confirmButton.disabled = false;
      setStatus(response.error || "Unable to record punch.", "bad");
      return;
    }

    if (response.duplicate) {
      setStatus(response.message || "This station was already punched.", "bad");
      resultDetail.textContent = "Duplicate blocked. No new raffle entry was added.";
      return;
    }

    setStatus(response.message || "Punch recorded.", "good");
    resultDetail.textContent = `${response.punch.entries} raffle entr${response.punch.entries === 1 ? "y" : "ies"} added.`;
  }

  async function startCamera() {
    if (!("mediaDevices" in navigator) || !("BarcodeDetector" in window)) {
      placeholder.textContent = "Camera QR scanning is not supported in this browser. Type the Guest ID below.";
      return;
    }

    try {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      video.srcObject = stream;
      video.classList.remove("hide");
      placeholder.classList.add("hide");
      scanning = true;

      const tick = async () => {
        if (!scanning) {
          return;
        }

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const codes = await detector.detect(video).catch(() => []);
          if (codes.length > 0) {
            scanning = false;
            await lookupGuest(codes[0].rawValue);
            window.setTimeout(() => {
              scanning = true;
              tick();
            }, 1800);
            return;
          }
        }

        window.requestAnimationFrame(tick);
      };

      tick();
    } catch (error) {
      placeholder.textContent = "Camera permission was blocked. Type the Guest ID below.";
    }
  }

  stationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      stationId = button.dataset.stationOption;
      purchaseAmount.value = "";
      renderStation();
    });
  });

  lookupButton.addEventListener("click", () => lookupGuest(manualId.value));
  confirmButton.addEventListener("click", confirmPunch);
  manualId.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      lookupGuest(manualId.value);
    }
  });

  window.addEventListener("pagehide", () => {
    scanning = false;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  });

  renderStation();
  startCamera();
})();
