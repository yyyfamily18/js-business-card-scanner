const STORAGE_KEY = "scanned_business_cards_v1";
let savedCards = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

// DOM Elements
const fileInput = document.getElementById("file-input");
const dropzone = document.getElementById("dropzone");
const dropzonePrompt = document.getElementById("dropzone-prompt");
const cardPreview = document.getElementById("card-preview");
const progressWrapper = document.getElementById("progress-wrapper");
const statusText = document.getElementById("status-text");
const progressPct = document.getElementById("progress-pct");
const progressFill = document.getElementById("progress-fill");
const rawTextEl = document.getElementById("raw-text");
const jsonPreviewEl = document.getElementById("json-preview");
const jsonModeLabel = document.getElementById("json-mode-label");

const fields = {
  full_name: document.getElementById("field-name"),
  job_title: document.getElementById("field-title"),
  company: document.getElementById("field-company"),
  email: document.getElementById("field-email"),
  phone: document.getElementById("field-phone"),
  website: document.getElementById("field-website"),
  address: document.getElementById("field-address")
};

// Get current form values as a clean object
function getCurrentCardData() {
  return {
    full_name: fields.full_name.value.trim(),
    job_title: fields.job_title.value.trim(),
    company: fields.company.value.trim(),
    email: fields.email.value.trim(),
    phone: fields.phone.value.trim(),
    website: fields.website.value.trim(),
    address: fields.address.value.trim(),
    scanned_at: new Date().toISOString()
  };
}

// Refresh live JSON box and counters
function updateUI() {
  document.getElementById("metric-count").textContent = savedCards.length;
  if (savedCards.length > 0) {
    jsonModeLabel.textContent = `Session Batch (${savedCards.length} cards)`;
    jsonPreviewEl.textContent = JSON.stringify(savedCards, null, 2);
  } else {
    jsonModeLabel.textContent = "Current Card";
    jsonPreviewEl.textContent = JSON.stringify(getCurrentCardData(), null, 2);
  }
}

// Populate form inputs from parsed result
function populateForm(data) {
  Object.keys(fields).forEach(key => {
    fields[key].value = data[key] || "";
  });
  updateUI();
}

// Run Tesseract.js OCR on an image source (File, DataURL, or Blob)
async function processImage(imageSrc) {
  cardPreview.src = imageSrc;
  cardPreview.hidden = false;
  dropzonePrompt.hidden = true;
  progressWrapper.hidden = false;
  progressFill.style.width = "0%";

  const startTime = performance.now();

  try {
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: m => {
        if (m.status === "recognizing text") {
          const pct = Math.round(m.progress * 100);
          statusText.textContent = "Extracting text...";
          progressPct.textContent = `${pct}%`;
          progressFill.style.width = `${pct}%`;
        } else {
          statusText.textContent = m.status;
        }
      }
    });

    const { data } = await worker.recognize(imageSrc);
    await worker.terminate();

    const elapsedMs = Math.round(performance.now() - startTime);
    document.getElementById("metric-latency").textContent = `${elapsedMs} ms`;
    document.getElementById("metric-confidence").textContent = `${Math.round(data.confidence)}%`;

    rawTextEl.textContent = data.text.trim() || "(No readable text detected)";
    const parsed = parseBusinessCardText(data.text);
    populateForm(parsed);

    statusText.textContent = "Extraction complete";
    progressPct.textContent = "100%";
    progressFill.style.width = "100%";
  } catch (err) {
    console.error(err);
    statusText.textContent = "OCR failed. Try a clearer image.";
  }
}

// Handle file input selection
function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = e => processImage(e.target.result);
  reader.readAsDataURL(file);
}

fileInput.addEventListener("change", e => handleFile(e.target.files[0]));

// Drag and drop events
dropzone.addEventListener("dragover", e => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", e => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  handleFile(e.dataTransfer.files[0]);
});

// Live update JSON preview whenever user edits any form input
Object.values(fields).forEach(input => input.addEventListener("input", updateUI));

// Save current card into session batch (localStorage)
document.getElementById("btn-add-batch").addEventListener("click", () => {
  const card = getCurrentCardData();
  if (!card.full_name && !card.email && !card.company) {
    alert("Please scan or enter at least a name, company, or email first.");
    return;
  }
  savedCards.push(card);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCards));
  updateUI();
});

// Clear saved session cards
document.getElementById("btn-clear-batch").addEventListener("click", () => {
  savedCards = [];
  localStorage.removeItem(STORAGE_KEY);
  updateUI();
});

// Copy JSON to clipboard
document.getElementById("btn-copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(jsonPreviewEl.textContent);
  const btn = document.getElementById("btn-copy");
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = "Copy JSON"), 1500);
});

// Download JSON file
document.getElementById("btn-download").addEventListener("click", () => {
  const payload = savedCards.length > 0 ? savedCards : [getCurrentCardData()];
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `business-cards-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Generate a crisp synthetic sample business card on HTML5 Canvas for 1-click demos
document.getElementById("btn-sample").addEventListener("click", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 700;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 700, 400);
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(0, 0, 22, 400);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 32px Arial";
  ctx.fillText("Sarah Jenkins", 60, 95);

  ctx.fillStyle = "#2563eb";
  ctx.font = "600 20px Arial";
  ctx.fillText("Principal Solutions Architect", 60, 130);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 20px Arial";
  ctx.fillText("Northstar Cloud Technologies Ltd.", 60, 195);

  ctx.font = "18px Arial";
  ctx.fillText("sarah.jenkins@northstarcloud.io", 60, 245);
  ctx.fillText("+1 (415) 890-4321", 60, 278);
  ctx.fillText("www.northstarcloud.io", 60, 311);
  ctx.fillText("450 Mission Street, Suite 300, San Francisco", 60, 344);

  processImage(canvas.toDataURL("image/png"));
});

// Initialize UI on load
updateUI();
