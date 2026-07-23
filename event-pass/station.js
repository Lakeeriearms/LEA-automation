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

  const stationEventKey = window.LEAEvent.getParam("event") || window.LEA_STAFF_EVENT_KEY || "range-to-patio-party";
  if (stationEventKey && window.LEAEvent.config) {
    window.LEAEvent.config.eventKey = stationEventKey;
  }

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
    purchaseField.classList.remove("hide");
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
      setStatus(response.message || "This station was already punched.", response.punch ? "good" : "bad");
      resultDetail.textContent = response.punch
        ? `Total raffle entries: ${response.punch.entries}.`
        : "Duplicate blocked. No new raffle entry was added.";
      return;
    }

    setStatus(response.message || "Punch recorded.", "good");
    resultDetail.textContent = `Total raffle entries: ${response.punch.entries}.`;
  }

  function loadQrFallback_() {
    if (window.jsQR) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-qr-fallback]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      script.async = true;
      script.dataset.qrFallback = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.append(script);
    });
  }

  async function createQrReader_() {
    if ("BarcodeDetector" in window) {
      try {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        return async () => {
          const codes = await detector.detect(video).catch(() => []);
          return codes.length > 0 ? codes[0].rawValue : "";
        };
      } catch (error) {
        // Fall back to canvas decoding below.
      }
    }

    await loadQrFallback_();

    if (typeof window.jsQR !== "function") {
      throw new Error("QR scanner fallback did not load.");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    return async () => {
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (!width || !height) {
        return "";
      }

      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      context.drawImage(video, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const code = window.jsQR(imageData.data, width, height, { inversionAttempts: "attemptBoth" });
      return code && code.data ? code.data : "";
    };
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      placeholder.textContent = "Camera access is not supported in this browser. Type the Guest ID below.";
      return;
    }

    try {
      const readQrCode = await createQrReader_();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
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
          const rawValue = await readQrCode();
          if (rawValue) {
            scanning = false;
            await lookupGuest(rawValue);
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
      placeholder.textContent = "Camera permission was blocked or the QR scanner could not start. Type the Guest ID below.";
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
