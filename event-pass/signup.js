(function () {
  const form = document.querySelector("#signupForm");
  const status = document.querySelector("#signupStatus");
  const sheetLink = document.querySelector("#sheetLink");

  if (sheetLink) {
    sheetLink.href = window.LEAEvent.config.spreadsheetUrl;
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status is-visible ${type ? `is-${type}` : ""}`;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    const data = Object.fromEntries(new FormData(form).entries());

    if (!data.phone && !data.email) {
      setStatus("Enter a phone number or email so the pass can be tied to the guest.", "bad");
      return;
    }

    data.action = "signup";
    data.marketingConsent = document.querySelector("#marketingConsent").checked;
    data.signupSource = "Event signup page";

    submit.disabled = true;
    setStatus("Creating pass...", "");

    try {
      const response = await window.LEAEvent.request(data);

      if (!response.ok) {
        throw new Error(response.error || "Unable to create pass.");
      }

      window.LEAEvent.setStoredGuest(response.guest);
      window.location.href = `pass.html?id=${encodeURIComponent(response.guest.guestId)}`;
    } catch (error) {
      setStatus(error.message, "bad");
      submit.disabled = false;
    }
  });
})();
