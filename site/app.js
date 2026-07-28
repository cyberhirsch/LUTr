import { LutRenderer } from "./lut-renderer.js";
import { colorSpace, colorSpaceLabel, colorSpaceOptions } from "./color-spaces.js";
import { composeCube, downloadText, parseCube } from "./lut-io.js";
import { decodeImageFile } from "./image-loader.js";

const state = {
  catalog: null,
  imageId: null,
  query: "",
  sort: "recommended",
  previewOnly: true,
  facets: new Map(),
  visible: 60,
  compare: [],
  activeLut: null,
  customImage: null,
  lutInputOverrides: new Map(),
  lutOutputOverrides: new Map(),
  uploadedLut: null,
};

let lutRenderer = null;
let catalogRenderGeneration = 0;

const facetDefinitions = [
  ["transformClass", "Transform type", (lut) => [lut.transformClass]],
  ["license", "License", (lut) => [lut.license]],
  ["format", "Format", (lut) => [lut.format]],
  ["look", "Look & behavior", (lut) => lut.tags.filter((tag) => ["warm","cool","black-and-white","cinematic","vintage","subtle","moderate","strong","hdr","accessibility","simulation","correction"].includes(tag))],
  ["collection", "Collection", (lut) => [lut.collection]],
];

const els = Object.fromEntries([
  "imageRail","statLuts","statPreviews","statCollections","selectedReferenceImage","catalogTitle",
  "selectedReferenceMeta","searchInput","previewOnly","facetGroups","resultCount","methodLabel",
  "sortSelect","activeChips","lutGrid","emptyState","loadMore","clearFilters","emptyReset",
  "surpriseButton","filterPanel","filterScrim","openFilters","activeFilterCount","viewerDialog",
  "viewerClose","viewerOriginal","viewerAfter","viewerAfterWrap","wipeRange","viewerCollection",
  "viewerTitle","viewerBadges","viewerNotice","viewerMetadata","viewerSource","compareFromViewer",
  "compareTray","compareCount","compareNames","clearCompare","openCompare","compareDialog",
  "compareClose","compareGrid","uploadImageButton","imageUpload","imageColorSpace","imageColorSpaceHint","viewerCanvas","viewerOriginalCanvas",
  "viewerLutInputSpace","viewerLutOutputSpace","viewerDownloadInput","viewerDownloadOutput","downloadConvertedLut",
  "converterTab","converterPanel","converterClose","converterFile","converterLutInput","converterLutOutput",
  "converterNewInput","converterNewOutput","converterSize","converterStatus","converterDownload",
].map((id) => [id, document.getElementById(id)]));

const label = (value) => value
  .replaceAll("-", " ")
  .replace(/\b\w/g, (m) => m.toUpperCase())
  .replace("Cc0", "CC0")
  .replace("Clf", "CLF")
  .replace("Hdr", "HDR")
  .replace("Sdr", "SDR");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

function lutPipeline(lut, image = selectedImage()) {
  return {
    sourceSpace: image.colorSpace,
    lutInputSpace: state.lutInputOverrides.get(lut.id) || lut.inputColorSpace,
    lutOutputSpace: state.lutOutputOverrides.get(lut.id) || lut.outputColorSpace,
    displaySpace: "srgb",
  };
}

function pipelineReady(pipeline) {
  return [pipeline.sourceSpace, pipeline.lutInputSpace, pipeline.lutOutputSpace, pipeline.displaySpace]
    .every((id) => Boolean(colorSpace(id)));
}

function parseUrl() {
  const params = new URLSearchParams(location.search);
  state.imageId = params.get("image");
  state.query = params.get("q") || "";
  state.sort = params.get("sort") || "recommended";
  state.previewOnly = params.get("all") !== "1";
  for (const encoded of params.getAll("f")) {
    const [group, mode, ...valueParts] = encoded.split(":");
    const value = decodeURIComponent(valueParts.join(":"));
    if (!group || !mode || !value) continue;
    if (!state.facets.has(group)) state.facets.set(group, new Map());
    state.facets.get(group).set(value, mode);
  }
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.imageId && state.imageId !== "upload") params.set("image", state.imageId);
  if (state.query) params.set("q", state.query);
  if (state.sort !== "recommended") params.set("sort", state.sort);
  if (!state.previewOnly) params.set("all", "1");
  for (const [group, values] of state.facets) {
    for (const [value, mode] of values) params.append("f", `${group}:${mode}:${encodeURIComponent(value)}`);
  }
  history.replaceState(null, "", `${location.pathname}?${params.toString()}${location.hash}`);
}

function selectedImage() {
  if (state.imageId === "upload" && state.customImage) return state.customImage;
  return state.catalog.images.find((image) => image.id === state.imageId) || state.catalog.images[0];
}

function setImage(id, scroll = true) {
  state.imageId = id;
  state.visible = 60;
  renderImages();
  renderSelectedReference();
  renderCatalog();
  syncUrl();
  if (scroll) document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderImages() {
  els.imageRail.innerHTML = state.catalog.images.map((image) => `
    <button class="image-card" role="listitem" data-image="${image.id}" aria-pressed="${image.id === state.imageId}">
      <img src="./${image.proxy}" alt="${image.title}" loading="lazy" />
      <span class="image-copy"><strong>${image.title}</strong><span>${image.subtitle}</span></span>
    </button>`).join("");
  els.imageRail.querySelectorAll("[data-image]").forEach((button) => {
    button.addEventListener("click", () => setImage(button.dataset.image));
  });
}

function renderSelectedReference() {
  const image = selectedImage();
  els.selectedReferenceImage.src = image.id === "upload" ? image.proxy : `./${image.proxy}`;
  els.selectedReferenceImage.alt = image.title;
  els.catalogTitle.textContent = image.title;
  els.selectedReferenceMeta.textContent = `${image.encoding} · ${image.license} · ${image.tags.join(" · ")}`;
  els.imageColorSpace.value = image.colorSpace || "";
  els.imageColorSpaceHint.textContent = image.colorSpaceReason ||
    `Catalog metadata declares ${colorSpaceLabel(image.colorSpace)}. Change this if the reference was encoded differently.`;
  els.imageColorSpaceHint.dataset.confidence = image.colorSpaceConfidence || "declared";
}

async function useUploadedImage(file) {
  if (!file) return;
  const originalLabel = els.uploadImageButton.textContent;
  els.uploadImageButton.disabled = true;
  els.uploadImageButton.textContent = "Reading image…";
  try {
    const decoded = await decodeImageFile(file);
    if (state.customImage?.proxy) URL.revokeObjectURL(state.customImage.proxy);
    state.customImage = {
      id: "upload",
      title: file.name,
      subtitle: `Your local ${decoded.format} · processed only in this browser`,
      proxy: decoded.proxy,
      element: decoded.source,
      displayElement: decoded.image,
      license: "Private local upload",
      tags: ["upload", "local", "client-rendered", decoded.format.toLowerCase()],
      encoding: `${decoded.format} · guessed ${colorSpaceLabel(decoded.guess.id)}`,
      colorSpace: decoded.guess.id,
      colorSpaceReason: `${decoded.guess.confidence === "embedded" ? "Embedded metadata" : "Automatic guess"}: ${decoded.guess.reason} Confirm or override this value.`,
      colorSpaceConfidence: decoded.guess.confidence,
    };
    setImage("upload");
  } catch (error) {
    alert(`LUTr could not decode that image. ${error.message}`);
    return;
  } finally {
    els.imageUpload.value = "";
    els.uploadImageButton.disabled = false;
    els.uploadImageButton.textContent = originalLabel;
  }
}

function facetState(group, value) {
  return state.facets.get(group)?.get(value) || "neutral";
}

function cycleFacet(group, value) {
  if (!state.facets.has(group)) state.facets.set(group, new Map());
  const values = state.facets.get(group);
  const current = values.get(value) || "neutral";
  const next = current === "neutral" ? "include" : current === "include" ? "exclude" : "neutral";
  if (next === "neutral") values.delete(value); else values.set(value, next);
  if (!values.size) state.facets.delete(group);
  state.visible = 60;
  renderAllFilterDependent();
}

function matchesText(lut) {
  if (!state.query.trim()) return true;
  const terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [lut.title, lut.collection, lut.transformClass, lut.format, lut.license, ...lut.tags].join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function matchesFacets(lut, omitGroup = null) {
  for (const [group, values] of state.facets) {
    if (group === omitGroup) continue;
    const def = facetDefinitions.find(([id]) => id === group);
    if (!def) continue;
    const lutValues = def[2](lut);
    const includes = [...values].filter(([, mode]) => mode === "include").map(([value]) => value);
    const excludes = [...values].filter(([, mode]) => mode === "exclude").map(([value]) => value);
    if (includes.length && !includes.some((value) => lutValues.includes(value))) return false;
    if (excludes.some((value) => lutValues.includes(value))) return false;
  }
  return true;
}

function baseFiltered(omitGroup = null) {
  return state.catalog.luts.filter((lut) =>
    (!state.previewOnly || lut.previewType) &&
    matchesText(lut) &&
    matchesFacets(lut, omitGroup)
  );
}

function sortedResults() {
  const results = baseFiltered();
  const licenseRank = { "CC0-1.0": 0, "Unlicense": 0, "MIT": 1, "BSD-3-Clause": 1, "CC-BY-4.0": 2, "CC-BY-SA-4.0": 3, "LGPL-3.0": 3, "GPL-3.0": 4 };
  const stable = (a, b) => a.id.localeCompare(b.id);
  const sorts = {
    name: (a,b) => a.title.localeCompare(b.title) || stable(a,b),
    collection: (a,b) => a.collection.localeCompare(b.collection) || a.title.localeCompare(b.title) || stable(a,b),
    documented: (a,b) => b.completeness - a.completeness || stable(a,b),
    license: (a,b) => (licenseRank[a.license] ?? 9) - (licenseRank[b.license] ?? 9) || stable(a,b),
    "intensity-asc": (a,b) => (a.intensity ?? 99) - (b.intensity ?? 99) || stable(a,b),
    "intensity-desc": (a,b) => (b.intensity ?? -1) - (a.intensity ?? -1) || stable(a,b),
    warm: (a,b) => (a.warmth ?? 99) - (b.warmth ?? 99) || stable(a,b),
    format: (a,b) => a.format.localeCompare(b.format) || a.title.localeCompare(b.title) || stable(a,b),
    recommended: (a,b) => Number(Boolean(b.previewType)) - Number(Boolean(a.previewType)) || b.completeness - a.completeness || a.collection.localeCompare(b.collection) || stable(a,b),
  };
  return results.sort(sorts[state.sort] || sorts.recommended);
}

function renderFacetGroups() {
  els.facetGroups.innerHTML = facetDefinitions.map(([id, title, getter], index) => {
    const candidates = baseFiltered(id);
    const counts = new Map();
    for (const lut of candidates) for (const value of getter(lut)) counts.set(value, (counts.get(value) || 0) + 1);
    const selectedValues = [...(state.facets.get(id)?.keys() || [])];
    const values = [...new Set([...selectedValues, ...counts.keys()])].sort((a,b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b));
    return `<details class="facet-group" ${index < 3 ? "open" : ""}>
      <summary>${title}</summary>
      <div class="facet-options">${values.map((value) => {
        const mode = facetState(id, value);
        return `<button class="facet-option" data-group="${id}" data-value="${encodeURIComponent(value)}" data-state="${mode}">
          <span class="state-box">${mode === "include" ? "✓" : mode === "exclude" ? "−" : ""}</span>
          <span>${label(value)}</span><span class="count">${counts.get(value) || 0}</span>
        </button>`;
      }).join("")}</div>
    </details>`;
  }).join("");
  els.facetGroups.querySelectorAll(".facet-option").forEach((button) => {
    button.addEventListener("click", () => cycleFacet(button.dataset.group, decodeURIComponent(button.dataset.value)));
  });
}

function metricTag(lut) {
  if (lut.intensity == null) return null;
  return lut.intensity < .06 ? "Subtle" : lut.intensity < .15 ? "Moderate" : "Strong";
}

function card(lut) {
  const image = selectedImage();
  const pipeline = lutPipeline(lut, image);
  const clientPreview = Boolean(lutRenderer && lut.clientLut && pipelineReady(pipeline));
  const needsColorSpace = Boolean(lut.clientLut && !pipelineReady(pipeline));
  const tags = [...new Set([metricTag(lut), ...lut.tags])].filter(Boolean).slice(0, 3);
  const selected = state.compare.includes(lut.id);
  return `<article class="lut-card" data-lut="${lut.id}">
    <button class="lut-preview" data-open="${lut.id}" aria-label="View ${lut.title}">
      ${clientPreview ? `<canvas data-client-preview="${lut.id}" aria-label="${lut.title} applied to ${image.title}"></canvas>` : needsColorSpace ? `<span class="no-preview">Input/output color space required<br />Open to define the pipeline</span>` : `<span class="no-preview">Metadata only<br />Color path not yet validated</span>`}
      <span class="status">${clientPreview ? "Color managed" : needsColorSpace ? "Space required" : lut.previewType ? "Illustrative" : "No preview"}</span>
    </button>
    <div class="lut-card-body">
      <div class="lut-card-kicker">${lut.collection} · ${lut.format}</div>
      <h3 title="${lut.title}">${lut.title}</h3>
      <div class="tag-row">${tags.map((tag) => `<span>${label(tag)}</span>`).join("")}</div>
      <div class="lut-card-actions">
        <button data-open="${lut.id}">Details ↗</button>
        <button data-compare="${lut.id}" class="${selected ? "selected" : ""}">${selected ? "✓ Added" : "+ Compare"}</button>
      </div>
    </div>
  </article>`;
}

function renderCatalog() {
  const generation = ++catalogRenderGeneration;
  const results = sortedResults();
  const visible = results.slice(0, state.visible);
  els.resultCount.textContent = `${results.length.toLocaleString()} transform${results.length === 1 ? "" : "s"}`;
  els.lutGrid.innerHTML = visible.map(card).join("");
  els.emptyState.hidden = results.length > 0;
  els.loadMore.hidden = visible.length >= results.length;
  els.loadMore.textContent = `Show ${Math.min(60, results.length - visible.length)} more of ${results.length}`;
  els.lutGrid.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => openViewer(button.dataset.open)));
  els.lutGrid.querySelectorAll("[data-compare]").forEach((button) => button.addEventListener("click", () => toggleCompare(button.dataset.compare)));
  if (lutRenderer) renderClientThumbnails(visible, generation);
}

async function renderClientThumbnails(luts, generation) {
  const image = selectedImage();
  const source = image.id === "upload" ? image.element : `./${image.proxy}`;
  for (const lut of luts) {
    if (generation !== catalogRenderGeneration || selectedImage().id !== image.id) return;
    const canvas = els.lutGrid.querySelector(`[data-client-preview="${CSS.escape(lut.id)}"]`);
    if (!canvas || !lut.clientLut) continue;
    try {
      await lutRenderer.render(source, `./${lut.clientLut}`, lut.clientLutSize, canvas, 480, lutPipeline(lut, image));
    } catch {
      const message = document.createElement("span");
      message.className = "no-preview";
      message.innerHTML = "Client preview<br />failed to render";
      canvas.replaceWith(message);
    }
  }
}

function renderChips() {
  const chips = [];
  if (state.query) chips.push({ label: `Search: ${state.query}`, action: () => { state.query = ""; els.searchInput.value = ""; } });
  for (const [group, values] of state.facets) for (const [value, mode] of values) {
    chips.push({ label: `${mode === "exclude" ? "Not " : ""}${label(value)}`, action: () => cycleFacet(group, value) });
  }
  els.activeChips.innerHTML = chips.map((chip, index) => `<button data-chip="${index}">${chip.label}<span>×</span></button>`).join("");
  els.activeChips.querySelectorAll("[data-chip]").forEach((button) => button.addEventListener("click", () => {
    chips[Number(button.dataset.chip)].action();
    renderAllFilterDependent();
  }));
  els.activeFilterCount.textContent = chips.length ? `(${chips.length})` : "";
}

function renderAllFilterDependent() {
  renderFacetGroups();
  renderChips();
  renderCatalog();
  syncUrl();
}

function resetFilters() {
  state.query = "";
  state.facets.clear();
  state.previewOnly = true;
  state.sort = "recommended";
  state.visible = 60;
  els.searchInput.value = "";
  els.previewOnly.checked = true;
  els.sortSelect.value = "recommended";
  renderAllFilterDependent();
}

function applyPreset(name) {
  state.facets.clear();
  state.previewOnly = name !== "technical";
  if (name === "creative") state.facets.set("transformClass", new Map([["creative-look","include"],["film-emulation","include"]]));
  if (name === "technical") state.facets.set("transformClass", new Map([["camera-transform","include"],["display-transform","include"],["color-space-conversion","include"],["tone-map","include"]]));
  if (name === "commercial") state.facets.set("license", new Map([["CC0-1.0","include"],["Unlicense","include"],["MIT","include"],["BSD-3-Clause","include"],["CC-BY-SA-4.0","include"],["GPL-3.0","include"],["LGPL-3.0","include"]]));
  if (name === "mono") state.facets.set("look", new Map([["black-and-white","include"]]));
  els.previewOnly.checked = state.previewOnly;
  renderAllFilterDependent();
}

function configureViewerColorTools(lut, image) {
  const options = colorSpaceOptions();
  for (const select of [els.viewerLutInputSpace, els.viewerLutOutputSpace, els.viewerDownloadInput, els.viewerDownloadOutput]) {
    select.innerHTML = options;
  }
  els.viewerLutInputSpace.value = state.lutInputOverrides.get(lut.id) || lut.inputColorSpace || "";
  els.viewerLutOutputSpace.value = state.lutOutputOverrides.get(lut.id) || lut.outputColorSpace || "";
  els.viewerDownloadInput.value = image.colorSpace || "";
  els.viewerDownloadOutput.value = els.viewerLutOutputSpace.value;
  updateViewerDownloadState();
}

function updateViewerDownloadState() {
  els.downloadConvertedLut.disabled = !(
    state.activeLut?.clientLut &&
    els.viewerLutInputSpace.value &&
    els.viewerLutOutputSpace.value &&
    els.viewerDownloadInput.value &&
    els.viewerDownloadOutput.value
  );
}

async function renderViewerLut(lut, image) {
  const sourceUrl = image.id === "upload" ? image.proxy : `./${image.proxy}`;
  const pipeline = {
    sourceSpace: image.colorSpace,
    lutInputSpace: els.viewerLutInputSpace.value,
    lutOutputSpace: els.viewerLutOutputSpace.value,
    displaySpace: "srgb",
  };
  els.viewerCanvas.hidden = true;
  els.viewerAfter.hidden = false;
  els.viewerAfter.src = sourceUrl;
  if (!pipelineReady(pipeline)) {
    els.viewerNotice.textContent = "This LUT does not have a complete verified color path. Define both “LUT expects” and “LUT outputs” before rendering or conversion.";
    return;
  }
  if (!lutRenderer || !lut.clientLut) {
    els.viewerNotice.textContent = "This asset has no browser-renderable LUT representation.";
    return;
  }
  try {
    const source = image.id === "upload" ? image.element : sourceUrl;
    await lutRenderer.render(source, `./${lut.clientLut}`, lut.clientLutSize, els.viewerCanvas, 1600, pipeline);
    if (state.activeLut?.id !== lut.id) return;
    els.viewerAfter.hidden = true;
    els.viewerCanvas.hidden = false;
    const assumed = lut.colorSpaceConfidence?.startsWith("assumed");
    els.viewerNotice.textContent = `${image.id === "upload" ? "Rendered locally; your image was not uploaded. " : "Rendered locally from the reference proxy. "}Automatic path: ${colorSpaceLabel(pipeline.sourceSpace)} → ${colorSpaceLabel(pipeline.lutInputSpace)} → LUT → ${colorSpaceLabel(pipeline.lutOutputSpace)} → sRGB display.${assumed ? " The LUT input/output assignment is an explicit creative-look assumption." : ""}`;
  } catch (error) {
    els.viewerNotice.textContent = `Client render failed: ${error.message}`;
  }
}

async function openViewer(id) {
  const lut = state.catalog.luts.find((item) => item.id === id);
  if (!lut) return;
  state.activeLut = lut;
  const image = selectedImage();
  const sourceUrl = image.id === "upload" ? image.proxy : `./${image.proxy}`;
  els.viewerOriginal.src = sourceUrl;
  els.viewerOriginal.hidden = false;
  els.viewerOriginalCanvas.hidden = true;
  els.viewerOriginal.alt = `Original ${image.title}`;
  els.viewerAfter.alt = `${lut.title} applied to ${image.title}`;
  els.viewerAfterWrap.style.clipPath = "inset(0 0 0 58%)";
  els.wipeRange.value = 58;
  els.viewerCollection.textContent = lut.collection;
  els.viewerTitle.textContent = lut.title;
  els.viewerBadges.innerHTML = [lut.transformClass, lut.format, lut.license, lut.previewStatus, lut.colorSpaceConfidence].map((v) => `<span>${label(v)}</span>`).join("");
  const rows = [
    ["Format", lut.size ? `${lut.format} · ${lut.cubeKind === "1D" ? `${lut.size}-sample 1D` : `${lut.size}³`}` : lut.format],
    ["Class", label(lut.transformClass)],
    ["License", lut.license],
    ["License basis", label(lut.licenseBasis)],
    ["Author", lut.author || "Not declared"],
    ["LUT input", colorSpaceLabel(lut.inputColorSpace)],
    ["Input encoding", `${label(lut.inputGamut)} / ${label(lut.inputTransfer)}`],
    ["LUT output", colorSpaceLabel(lut.outputColorSpace)],
    ["Output encoding", `${label(lut.outputGamut)} / ${label(lut.outputTransfer)}`],
    ["Image input", colorSpaceLabel(image.colorSpace)],
    ["Source labels", lut.sourceLabels || "Not supplied"],
    ["Duplicates", lut.duplicateAssets ? `${lut.duplicateAssets.split(";").length} upstream copies collapsed` : "None detected"],
    ["Intensity", lut.intensity == null ? "Not measured" : `${Math.round(lut.intensity * 1000) / 10}% mean deviation`],
    ["Tags", lut.tags.join(", ")],
  ];
  els.viewerMetadata.innerHTML = rows
    .map(([term, value]) => `<dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
  els.viewerSource.href = lut.assetUrl || lut.source;
  els.compareFromViewer.textContent = state.compare.includes(lut.id) ? "Remove from compare" : "Add to compare";
  configureViewerColorTools(lut, image);
  els.viewerDialog.showModal();
  if (lutRenderer && image.colorSpace !== "srgb") {
    try {
      await lutRenderer.renderIdentity(
        image.id === "upload" ? image.element : sourceUrl,
        els.viewerOriginalCanvas,
        1600,
        { sourceSpace: image.colorSpace, lutInputSpace: "srgb", lutOutputSpace: "srgb", displaySpace: "srgb" },
      );
      els.viewerOriginal.hidden = true;
      els.viewerOriginalCanvas.hidden = false;
    } catch {}
  }
  await renderViewerLut(lut, image);
}

async function downloadCatalogLut() {
  const lut = state.activeLut;
  if (!lut || els.downloadConvertedLut.disabled) return;
  els.downloadConvertedLut.disabled = true;
  els.downloadConvertedLut.textContent = "Building 33³ CUBE…";
  try {
    const response = await fetch(`./${lut.clientLut}`);
    if (!response.ok) throw new Error(`Unable to load canonical CUBE (${response.status})`);
    const data = parseCube(await response.text(), lut.title);
    data.title = lut.title;
    const cube = composeCube({
      lut: data,
      newInput: els.viewerDownloadInput.value,
      lutInput: els.viewerLutInputSpace.value,
      lutOutput: els.viewerLutOutputSpace.value,
      newOutput: els.viewerDownloadOutput.value,
      title: `${lut.title} — converted by LUTr`,
    });
    const filename = `${lut.id.replace(/--[a-f0-9]{9}$/, "")}--${els.viewerDownloadInput.value}-to-${els.viewerDownloadOutput.value}.cube`;
    downloadText(filename, cube);
  } catch (error) {
    els.viewerNotice.textContent = `Converted LUT download failed: ${error.message}`;
  } finally {
    els.downloadConvertedLut.textContent = "Download converted .cube";
    updateViewerDownloadState();
  }
}

function toggleCompare(id) {
  const index = state.compare.indexOf(id);
  if (index >= 0) state.compare.splice(index, 1);
  else if (state.compare.length < 4) state.compare.push(id);
  renderCompareTray();
  renderCatalog();
  if (state.activeLut?.id === id) els.compareFromViewer.textContent = state.compare.includes(id) ? "Remove from compare" : "Add to compare";
}

function renderCompareTray() {
  els.compareTray.hidden = state.compare.length === 0;
  els.compareCount.textContent = state.compare.length;
  const luts = state.compare.map((id) => state.catalog.luts.find((lut) => lut.id === id)).filter(Boolean);
  els.compareNames.textContent = luts.map((lut) => lut.title).join(" · ");
  els.openCompare.disabled = state.compare.length < 2;
}

async function openCompareDialog() {
  const image = selectedImage();
  const luts = state.compare.map((id) => state.catalog.luts.find((lut) => lut.id === id)).filter(Boolean);
  els.compareGrid.innerHTML = luts.map((lut) => `
    <article class="compare-item">
      <img src="${image.id === "upload" ? image.proxy : `./${image.proxy}`}" alt="${image.title} before ${lut.title}" />
      <canvas data-compare-preview="${lut.id}" hidden></canvas>
      <h3>${lut.title}</h3><p>${lut.collection} · ${lut.license}</p>
    </article>`).join("");
  els.compareDialog.showModal();
  if (!lutRenderer) return;
  for (const lut of luts) {
    const pipeline = lutPipeline(lut, image);
    if (!lut.clientLut || !pipelineReady(pipeline)) continue;
    const canvas = els.compareGrid.querySelector(`[data-compare-preview="${CSS.escape(lut.id)}"]`);
    try {
      await lutRenderer.render(image.id === "upload" ? image.element : `./${image.proxy}`, `./${lut.clientLut}`, lut.clientLutSize, canvas, 800, pipeline);
      canvas.hidden = false;
      canvas.previousElementSibling.hidden = true;
    } catch {}
  }
}

function updateConverterState() {
  const ready = state.uploadedLut && [
    els.converterLutInput.value,
    els.converterLutOutput.value,
    els.converterNewInput.value,
    els.converterNewOutput.value,
  ].every((id) => Boolean(colorSpace(id)));
  els.converterDownload.disabled = !ready;
}

async function loadConverterFile(file) {
  state.uploadedLut = null;
  els.converterDownload.disabled = true;
  if (!file) {
    els.converterStatus.textContent = "Choose a 1D or 3D CUBE file to begin.";
    return;
  }
  try {
    const lut = parseCube(await file.text(), file.name);
    state.uploadedLut = lut;
    if (colorSpace(lut.declaredInput)) els.converterLutInput.value = lut.declaredInput;
    if (colorSpace(lut.declaredOutput)) els.converterLutOutput.value = lut.declaredOutput;
    if (els.converterLutInput.value) els.converterNewInput.value = els.converterLutInput.value;
    if (els.converterLutOutput.value) els.converterNewOutput.value = els.converterLutOutput.value;
    const dimensions = lut.kind === "1D" ? `${lut.size}-sample 1D` : `${lut.size}³`;
    els.converterStatus.textContent = `${lut.title} · ${dimensions} · ${lut.values.length.toLocaleString()} entries. Declare all four color spaces to enable conversion.`;
  } catch (error) {
    els.converterStatus.textContent = `Could not read LUT: ${error.message}`;
  }
  updateConverterState();
}

function downloadUploadedConversion() {
  if (!state.uploadedLut || els.converterDownload.disabled) return;
  els.converterDownload.disabled = true;
  els.converterDownload.textContent = "Converting…";
  try {
    const cube = composeCube({
      lut: state.uploadedLut,
      newInput: els.converterNewInput.value,
      lutInput: els.converterLutInput.value,
      lutOutput: els.converterLutOutput.value,
      newOutput: els.converterNewOutput.value,
      size: Number(els.converterSize.value),
      title: `${state.uploadedLut.title} — converted by LUTr`,
    });
    const safeTitle = state.uploadedLut.title.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
    downloadText(`${safeTitle}--${els.converterNewInput.value}-to-${els.converterNewOutput.value}.cube`, cube);
    els.converterStatus.textContent = `Converted ${state.uploadedLut.title} to a ${els.converterSize.value}³ CUBE.`;
  } catch (error) {
    els.converterStatus.textContent = `Conversion failed: ${error.message}`;
  } finally {
    els.converterDownload.textContent = "Convert and download";
    updateConverterState();
  }
}

function bindEvents() {
  let timer;
  els.searchInput.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.query = els.searchInput.value; state.visible = 60; renderAllFilterDependent(); }, 120);
  });
  els.previewOnly.addEventListener("change", () => { state.previewOnly = els.previewOnly.checked; renderAllFilterDependent(); });
  els.sortSelect.addEventListener("change", () => { state.sort = els.sortSelect.value; renderCatalog(); syncUrl(); });
  els.clearFilters.addEventListener("click", resetFilters);
  els.emptyReset.addEventListener("click", resetFilters);
  els.loadMore.addEventListener("click", () => { state.visible += 60; renderCatalog(); });
  els.surpriseButton.addEventListener("click", () => {
    const image = state.catalog.images[Math.floor(Math.random() * state.catalog.images.length)];
    setImage(image.id);
  });
  els.imageColorSpace.addEventListener("change", () => {
    const image = selectedImage();
    if (!image || !colorSpace(els.imageColorSpace.value)) return;
    image.colorSpace = els.imageColorSpace.value;
    image.colorSpaceReason = `Chosen manually: interpret the decoded pixels as ${colorSpaceLabel(image.colorSpace)}.`;
    image.colorSpaceConfidence = "user";
    if (image.id === "upload") image.encoding = `${image.subtitle.split(" · ")[0].replace("Your local ", "")} · ${colorSpaceLabel(image.colorSpace)}`;
    renderSelectedReference();
    renderCatalog();
  });
  els.uploadImageButton.addEventListener("click", () => els.imageUpload.click());
  els.imageUpload.addEventListener("change", () => useUploadedImage(els.imageUpload.files?.[0]));
  document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
  els.openFilters.addEventListener("click", () => { els.filterPanel.classList.add("open"); els.filterScrim.classList.add("open"); });
  els.filterScrim.addEventListener("click", () => { els.filterPanel.classList.remove("open"); els.filterScrim.classList.remove("open"); });
  els.viewerClose.addEventListener("click", () => els.viewerDialog.close());
  els.viewerDialog.addEventListener("click", (event) => { if (event.target === els.viewerDialog) els.viewerDialog.close(); });
  els.wipeRange.addEventListener("input", () => { els.viewerAfterWrap.style.clipPath = `inset(0 0 0 ${Number(els.wipeRange.value)}%)`; });
  els.viewerLutInputSpace.addEventListener("change", () => {
    if (!state.activeLut) return;
    state.lutInputOverrides.set(state.activeLut.id, els.viewerLutInputSpace.value);
    updateViewerDownloadState();
    renderViewerLut(state.activeLut, selectedImage());
  });
  els.viewerLutOutputSpace.addEventListener("change", () => {
    if (!state.activeLut) return;
    state.lutOutputOverrides.set(state.activeLut.id, els.viewerLutOutputSpace.value);
    if (!els.viewerDownloadOutput.value) els.viewerDownloadOutput.value = els.viewerLutOutputSpace.value;
    updateViewerDownloadState();
    renderViewerLut(state.activeLut, selectedImage());
  });
  els.viewerDownloadInput.addEventListener("change", updateViewerDownloadState);
  els.viewerDownloadOutput.addEventListener("change", updateViewerDownloadState);
  els.downloadConvertedLut.addEventListener("click", downloadCatalogLut);
  els.compareFromViewer.addEventListener("click", () => state.activeLut && toggleCompare(state.activeLut.id));
  els.clearCompare.addEventListener("click", () => { state.compare = []; renderCompareTray(); renderCatalog(); });
  els.openCompare.addEventListener("click", openCompareDialog);
  els.compareClose.addEventListener("click", () => els.compareDialog.close());
  els.compareDialog.addEventListener("click", (event) => { if (event.target === els.compareDialog) els.compareDialog.close(); });
  els.converterTab.addEventListener("click", () => {
    els.converterPanel.hidden = false;
    els.converterTab.setAttribute("aria-expanded", "true");
  });
  els.converterClose.addEventListener("click", () => {
    els.converterPanel.hidden = true;
    els.converterTab.setAttribute("aria-expanded", "false");
  });
  els.converterFile.addEventListener("change", () => loadConverterFile(els.converterFile.files?.[0]));
  for (const select of [els.converterLutInput, els.converterLutOutput, els.converterNewInput, els.converterNewOutput]) {
    select.addEventListener("change", updateConverterState);
  }
  els.converterDownload.addEventListener("click", downloadUploadedConversion);
}

async function init() {
  parseUrl();
  const response = await fetch("./data/catalog.json");
  if (!response.ok) throw new Error(`Catalog failed to load: ${response.status}`);
  state.catalog = await response.json();
  const spaceOptions = colorSpaceOptions();
  els.imageColorSpace.innerHTML = spaceOptions;
  for (const select of [
    els.converterLutInput, els.converterLutOutput, els.converterNewInput, els.converterNewOutput,
  ]) select.innerHTML = spaceOptions;
  for (const image of state.catalog.images) {
    image.colorSpaceConfidence ||= "declared";
    image.colorSpaceReason ||= `Catalog metadata declares ${colorSpaceLabel(image.colorSpace)}. Change this if the reference was encoded differently.`;
  }
  try {
    lutRenderer = new LutRenderer();
  } catch (error) {
    console.warn(error);
  }
  if (!state.catalog.images.some((image) => image.id === state.imageId)) state.imageId = state.catalog.images[0].id;
  els.statLuts.textContent = state.catalog.stats.luts.toLocaleString();
  els.statPreviews.textContent = state.catalog.stats.previewable.toLocaleString();
  els.statCollections.textContent = state.catalog.stats.collections;
  els.searchInput.value = state.query;
  els.previewOnly.checked = state.previewOnly;
  els.sortSelect.value = state.sort;
  renderImages();
  renderSelectedReference();
  renderAllFilterDependent();
  renderCompareTray();
  bindEvents();
}

init().catch((error) => {
  console.error(error);
  els.lutGrid.innerHTML = `<div class="empty-state"><h3>Catalog failed to load.</h3><p>${error.message}</p></div>`;
});
