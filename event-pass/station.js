(function () {
  const title = document.querySelector("#stationTitle");
  const subtitle = document.querySelector("#stationSubtitle");
  const checklist = document.querySelector("#stationChecklist");
  const status = document.querySelector("#scanStatus");
  const reader = document.querySelector("#reader");
  const video = document.querySelector("#readerVideo");
  const placeholder = document.querySelector("#readerPlaceholder");
  const cameraToggle = document.querySelector("#cameraToggle");
  const scanFeedback = document.querySelector("#scanFeedback");
  const scanFeedbackId = document.querySelector("#scanFeedbackId");
  const manualId = document.querySelector("#manualGuestId");
  const lookupButton = document.querySelector("#lookupButton");
  const confirmButton = document.querySelector("#confirmButton");
  const purchaseAmount = document.querySelector("#purchaseAmount");
  const purchaseField = document.querySelector("#purchaseField");
  const result = document.querySelector("#scanResult");
  const resultName = document.querySelector("#resultName");
  const resultGuestId = document.querySelector("#resultGuestId");
  const resultDetail = document.querySelector("#resultDetail");
  const stationButtons = Array.from(document.querySelectorAll("[data-station-option]"));

  const stationEventKey = window.LEAEvent.getParam("event") || window.LEA_STAFF_EVENT_KEY || "range-to-patio-party";
  if (stationEventKey && window.LEAEvent.config) {
    window.LEAEvent.config.eventKey = stationEventKey;
  }

  let stationId = window.LEAEvent.getParam("station") || window.LEA_STATION_ID || "range";
  let stream;
  let cameraStarting = false;
  let scanning = false;
  let scanLoopToken = 0;
  let detectedGuestId = "";
  let lastScannedGuestId = "";
  let lastScannedAt = 0;
  let feedbackTimer;

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

  function setCameraButton(isOn, label) {
    cameraToggle.disabled = cameraStarting;
    cameraToggle.textContent = label || (isOn ? "Turn camera off" : "Turn camera on");
    cameraToggle.setAttribute("aria-pressed", isOn ? "true" : "false");
  }

  function showScanFeedback(guestId) {
    window.clearTimeout(feedbackTimer);
    reader.classList.add("is-scanned");
    scanFeedbackId.textContent = guestId;
    scanFeedback.classList.remove("hide");

    if (navigator.vibrate) {
      navigator.vibrate([120, 60, 120]);
    }

    feedbackTimer = window.setTimeout(() => {
      reader.classList.remove("is-scanned");
      scanFeedback.classList.add("hide");
    }, 2400);
  }

  async function lookupGuest(value, options) {
    const guestId = normalizeGuestId(value);
    const fromScan = options && options.fromScan;

    if (!guestId) {
      setStatus("Scan or type a Guest ID first.", "bad");
      return;
    }

    detectedGuestId = guestId;
    manualId.value = guestId;
    setStatus(fromScan ? "QR code scanned. Looking up guest..." : "Looking up guest...", fromScan ? "good" : "");

    let response;

    try {
      response = await window.LEAEvent.request({ action: "lookup", guestId });
    } catch (error) {
      result.classList.add("hide");
      confirmButton.disabled = true;
      setStatus(error.message || "Unable to look up this guest. Try again.", "bad");
      return;
    }

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
    setStatus(
      fromScan
        ? "QR code scanned successfully. Guest found—confirm the punch when the activity is complete."
        : "Guest found. Confirm the punch when the activity is complete.",
      "good",
    );
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

  async function requestCameraStream_() {
    const attempts = [
      {
        video: {
          facingMode: { exact: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      { video: true, audio: false },
    ];
    let lastError;

    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
        if (error && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
          throw error;
        }
      }
    }

    throw lastError || new Error("Unable to open a camera.");
  }

  function stopCamera(message) {
    scanning = false;
    scanLoopToken += 1;
    window.clearTimeout(feedbackTimer);
    reader.classList.remove("is-scanned");
    scanFeedback.classList.add("hide");

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    video.pause();
    video.srcObject = null;
    video.classList.add("hide");
    placeholder.textContent = message || "Camera is off. Turn it on to scan a QR code.";
    placeholder.classList.remove("hide");
    cameraStarting = false;
    setCameraButton(false);
  }

  async function startCamera() {
    if (cameraStarting || stream) {
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      placeholder.textContent = "Camera access is not supported in this browser. Type the Guest ID below.";
      setCameraButton(false);
      return;
    }

    if (!window.isSecureContext) {
      placeholder.textContent = "Camera access requires a secure HTTPS page. Type the Guest ID below.";
      setCameraButton(false);
      return;
    }

    cameraStarting = true;
    setCameraButton(false, "Starting camera...");
    placeholder.textContent = "Starting camera...";
    placeholder.classList.remove("hide");

    try {
      stream = await requestCameraStream_();
      video.srcObject = stream;
      await video.play();
      video.classList.remove("hide");
      placeholder.classList.add("hide");
      const readQrCode = await createQrReader_();
      cameraStarting = false;
      setCameraButton(true);
      scanning = true;
      const loopToken = ++scanLoopToken;

      const tick = async () => {
        if (!scanning || loopToken !== scanLoopToken) {
          return;
        }

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const rawValue = await readQrCode();
          const guestId = normalizeGuestId(rawValue);
          const now = Date.now();
          const isRecentDuplicate = guestId === lastScannedGuestId && now - lastScannedAt < 6000;

          if (guestId && !isRecentDuplicate) {
            scanning = false;
            lastScannedGuestId = guestId;
            lastScannedAt = now;
            showScanFeedback(guestId);
            await lookupGuest(guestId, { fromScan: true });
            window.setTimeout(() => {
              if (!stream || loopToken !== scanLoopToken) {
                return;
              }
              scanning = true;
              tick();
            }, 2600);
            return;
          }
        }

        window.requestAnimationFrame(tick);
      };

      tick();
    } catch (error) {
      stopCamera(
        error && (error.name === "NotAllowedError" || error.name === "SecurityError")
          ? "Camera permission was blocked. Allow camera access in your browser settings, then tap Turn camera on."
          : "The camera or QR scanner could not start. Tap Turn camera on to retry, or type the Guest ID below.",
      );
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
  cameraToggle.addEventListener("click", () => {
    if (stream || cameraStarting) {
      stopCamera();
    } else {
      startCamera();
    }
  });
  manualId.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      lookupGuest(manualId.value);
    }
  });

  window.addEventListener("pagehide", () => {
    stopCamera();
  });

  renderStation();
  startCamera();
})();
