(function () {
  const config = window.LEA_EVENT_CONFIG || {};
  const storageKey = "lea-event-pass-mock";

  const stations = {
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
      checklistItem: "Free Shooting on LEA Range",
      baseEntries: 1,
      purchaseBonusEntries: 0,
      allowsPurchase: false,
    },
    "level-up-live-immersion-zone": {
      id: "level-up-live-immersion-zone",
      name: "Level Up Live Immersion Zone",
      checklistItem: "1 Free Mag in LUL",
      baseEntries: 1,
      purchaseBonusEntries: 0,
      allowsPurchase: false,
    },
    "level-up-live-action-zone": {
      id: "level-up-live-action-zone",
      name: "Level Up Live Action Zone",
      checklistItem: "1 Free Run in Action Zone",
      baseEntries: 1,
      purchaseBonusEntries: 0,
      allowsPurchase: false,
    },
    retail: {
      id: "retail",
      name: "Retail",
      checklistItem: "Make Purchase at Retail",
      baseEntries: 1,
      purchaseBonusEntries: 1,
      allowsPurchase: true,
    },
    "lea-cafe": {
      id: "lea-cafe",
      name: "LEA Cafe",
      checklistItem: "Make Purchase at LEA Cafe",
      baseEntries: 1,
      purchaseBonusEntries: 1,
      allowsPurchase: true,
    },
    "caliber-club": {
      id: "caliber-club",
      name: "Caliber Club",
      checklistItem: "Make Purchase at Caliber Club",
      baseEntries: 1,
      purchaseBonusEntries: 1,
      allowsPurchase: true,
    },
    photobooth: {
      id: "photobooth",
      name: "Photobooth",
      checklistItem: "Take photo in booth & post/tag us",
      baseEntries: 1,
      purchaseBonusEntries: 0,
      allowsPurchase: false,
    },
  };

  function readMock() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || { guests: [], punches: [] };
    } catch (error) {
      return { guests: [], punches: [] };
    }
  }

  function writeMock(data) {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  function createGuestId() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const extra = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `LEA-${yy}${mm}${dd}-${rand}${extra}`;
  }

  function mockRequest(payload) {
    const data = readMock();
    const action = payload.action;

    if (action === "signup") {
      const guest = {
        guestId: createGuestId(),
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone || "",
        email: payload.email || "",
        city: payload.city || "",
        state: payload.state || "",
        memberStatus: payload.memberStatus === "member" ? "Member" : "Guest",
        createdAt: new Date().toISOString(),
      };
      data.guests.push(guest);
      writeMock(data);
      return Promise.resolve({ ok: true, guest, stations: Object.values(stations), mock: true });
    }

    if (action === "lookup") {
      const guest = data.guests.find((item) => item.guestId === payload.guestId);
      if (!guest) {
        return Promise.resolve({ ok: false, error: `Guest not found: ${payload.guestId}`, mock: true });
      }
      return Promise.resolve({
        ok: true,
        guest,
        punches: data.punches.filter((item) => item.guestId === payload.guestId),
        stations: Object.values(stations),
        mock: true,
      });
    }

    if (action === "scan") {
      const guest = data.guests.find((item) => item.guestId === payload.guestId);
      const station = stations[payload.stationId];

      if (!guest) {
        return Promise.resolve({ ok: false, error: `Guest not found: ${payload.guestId}`, mock: true });
      }

      if (!station) {
        return Promise.resolve({ ok: false, error: `Unknown station: ${payload.stationId}`, mock: true });
      }

      const duplicate = data.punches.find(
        (item) => item.guestId === payload.guestId && item.stationId === payload.stationId,
      );

      if (duplicate) {
        return Promise.resolve({
          ok: true,
          duplicate: true,
          message: `Already punched for ${station.name}.`,
          guest,
          station,
          existingPunch: duplicate,
          mock: true,
        });
      }

      const purchaseAmount = Math.max(0, Number(payload.purchaseAmount || 0));
      const punch = {
        timestamp: new Date().toISOString(),
        guestId: payload.guestId,
        stationId: station.id,
        stationName: station.name,
        staffName: payload.staffName || "",
        purchaseAmount,
        entries: station.baseEntries + (purchaseAmount > 0 ? station.purchaseBonusEntries : 0),
        scanId: `MOCK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      };
      data.punches.push(punch);
      writeMock(data);
      return Promise.resolve({
        ok: true,
        duplicate: false,
        message: `Punch added for ${station.name}.`,
        guest,
        station,
        punch,
        mock: true,
      });
    }

    return Promise.resolve({ ok: true, stations: Object.values(stations), mock: true });
  }

  function jsonpRequest(payload) {
    if (!config.apiUrl) {
      return mockRequest(payload);
    }

    return new Promise((resolve, reject) => {
      const callback = `leaEventCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url = new URL(config.apiUrl);
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value);
        }
      });
      url.searchParams.set("callback", callback);

      const script = document.createElement("script");
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("The event tracker did not respond."));
      }, 15000);

      function cleanup() {
        window.clearTimeout(timer);
        delete window[callback];
        script.remove();
      }

      window[callback] = (response) => {
        cleanup();
        resolve(response);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Unable to reach the event tracker."));
      };

      script.src = url.toString();
      document.head.append(script);
    });
  }

  window.LEAEvent = {
    config,
    stations,
    request: jsonpRequest,
    getStation(id) {
      return stations[id] || stations.range;
    },
    getStoredGuest() {
      try {
        return JSON.parse(sessionStorage.getItem("lea-event-guest"));
      } catch (error) {
        return null;
      }
    },
    setStoredGuest(guest) {
      sessionStorage.setItem("lea-event-guest", JSON.stringify(guest));
    },
    getParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    },
  };
})();
