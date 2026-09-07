(() => {
  "use strict";
  const DB = window.LANGSIR_DB;
  const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const HISTORY_KEY = "formLangsirJakkHistoryV1";
  const DUTY_SIGNATURE_KEY = "formLangsirJakkDutySignatureV1";
  const TYPE_TITLES = { type1:"Loks Dinas Masuk DAO", type2:"Loks Depan Kabin", type3:"Rangkaian JAKK–DAO", type4:"Langsir KRL", manual:"Form Manual" };
  const MAP_WIDTH = 2800;
  const MAP_HEIGHT = 1155;
  let toastTimer;
  let routeMarkerSerial = 0;
  const state = {
    type: "type1", orderNumber: "001", movementNumber: "26", date: "", start: "", end: "",
    type1Origin: "jakk-vii", type1Entry: "dao-5", type1Coupling: "dao-4", type1Exit: "jakk-viii",
    type2Origin: "jakk-vi", type2Cabin: "L104", type2Target: "jakk-viii",
    type3Origin: "jakk-ix", type3Dao: "dao-4", type3Exit: "jakk-vii",
    type4Origin: "jakk-vii", type4Target: "jakk-vi", krlNumber: "",
    manualStageCount: "2", manualEmplacement: "JAKK–DAO",
    manual1Code: "", manual1Origin: "", manual1Destination: "", manual1Sentence: "", manual1Signals: "", manual1Jakk: "", manual1Dao: "",
    manual2Code: "", manual2Origin: "", manual2Destination: "", manual2Sentence: "", manual2Signals: "", manual2Jakk: "", manual2Dao: ""
  };

  const $ = (id) => document.getElementById(id);
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const short = (value) => [...DB.jakkTracks, ...DB.daoTracks].find((x) => x[0] === value)?.[1] || value;
  const label = (value) => `${value.startsWith("dao-") ? "Jalur " + short(value) + " DAO" : "Jalur " + short(value) + " JAKK"}`;
  const serviceOptions = () => DB.jakkTracks.filter((x) => DB.serviceTracks.includes(x[0]));
  const reverse = (list) => [...list].reverse();
  const manualList = (value) => unique(String(value || "").split(/[,;\n]+/).map((item) => item.trim()));

  function levelSwitches(origin, targetLevel) {
    const originLevel = DB.level[origin] ?? targetLevel;
    const step = originLevel <= targetLevel ? 1 : -1;
    const result = [];
    for (let level = originLevel; step > 0 ? level <= targetLevel : level >= targetLevel; level += step) {
      result.push(...(DB.levelSwitches[level] || []));
    }
    return unique(result);
  }

  function deviceRoute(origin, destination) {
    const verified = DB.verifiedRoutes[`${origin}|${destination}`];
    if (verified) return { origin: label(origin), destination: label(destination), ...verified };
    if (origin.startsWith("jakk-") && destination.startsWith("dao-")) {
      return {
        origin: label(origin), destination: label(destination),
        signals: unique([DB.startSignals[origin], "L44B"]),
        jakk: DB.jakkDaoSwitches[origin] || unique([...levelSwitches(origin, DB.cabinLevel.L44A), "W45"]),
        dao: DB.daoWestSwitches[destination] || ["W2"], verified: false
      };
    }
    if (origin.startsWith("dao-") && destination.startsWith("jakk-")) {
      const jakk = DB.jakkDaoSwitches[destination] || unique([...levelSwitches(destination, DB.cabinLevel.L44A), "W45"]);
      return {
        origin: label(origin), destination: label(destination), signals: ["L46A", "L44A"],
        jakk: reverse(jakk), dao: reverse(DB.daoWestSwitches[origin] || ["W2"]), verified: false
      };
    }
    return { origin: label(origin), destination: label(destination), signals: [], jakk: [], dao: [], verified: false };
  }

  function type1EntryRoute(origin, entry, coupling) {
    const base = deviceRoute(origin, entry);
    const internal = unique([
      ...(DB.daoEastSwitches[entry] || []),
      ...reverse(DB.daoEastSwitches[coupling] || []),
      ...(entry === "dao-11" || coupling === "dao-11" ? ["W19"] : [])
    ]);
    return { ...base, destination: `${label(entry)}, gandeng ${label(coupling)}`, dao: unique([...(DB.daoWestSwitches[entry] || ["W2"]), ...internal]), verified: false };
  }

  function type2OutboundRoute(origin, cabin) {
    return {
      origin: label(origin), destination: `Depan kabin ${cabin}`,
      signals: unique([DB.startSignals[origin], cabin]),
      jakk: levelSwitches(origin, DB.cabinLevel[cabin]),
      dao: [], verified: false
    };
  }

  function type2ReturnRoute(cabin, target) {
    return {
      origin: `Depan kabin ${cabin}`, destination: `${label(target)}, gandeng rangkaian`,
      signals: [cabin],
      jakk: reverse(levelSwitches(target, DB.cabinLevel[cabin])),
      dao: [], verified: false
    };
  }

  function krlRoute(origin, destination, outbound) {
    if (outbound) return { origin: label(origin), destination: "Arah Kampung Bandan · L144", signals: unique([DB.startSignals[origin], "L144"]), jakk: levelSwitches(origin, DB.cabinLevel.L144), dao: [], verified: false };
    return { origin: "Sinyal L144", destination: label(destination), signals: ["L144"], jakk: reverse(levelSwitches(destination, DB.cabinLevel.L144)), dao: [], verified: false };
  }

  function stages() {
    const n = state.movementNumber || "-";
    if (state.type === "manual") {
      return Array.from({ length: Number(state.manualStageCount) || 1 }, (_, index) => {
        const number = index + 1;
        return {
          code: state[`manual${number}Code`] || "-",
          sentence: state[`manual${number}Sentence`] || "Perintah langsir belum diisi.",
          route: {
            origin: state[`manual${number}Origin`] || "-",
            destination: state[`manual${number}Destination`] || "-",
            signals: manualList(state[`manual${number}Signals`]),
            jakk: manualList(state[`manual${number}Jakk`]),
            dao: manualList(state[`manual${number}Dao`]),
            verified: true
          }
        };
      });
    }
    if (state.type === "type1") return [
      { code: `L${n}`, sentence: `L${n} LANGSIR DARI JALUR ${short(state.type1Origin)} KE JALUR ${short(state.type1Entry)} DAO, GANDENG JALUR ${short(state.type1Coupling)} DAO.`, route: type1EntryRoute(state.type1Origin, state.type1Entry, state.type1Coupling) },
      { code: `R${n}`, sentence: `R${n} LANGSIR DARI JALUR ${short(state.type1Coupling)} DAO KE JALUR ${short(state.type1Exit)} EMPLASEMEN JAKK.`, route: deviceRoute(state.type1Coupling, state.type1Exit) }
    ];
    if (state.type === "type2") return [
      { code: `L${n}`, sentence: `L${n} LANGSIR DARI JALUR ${short(state.type2Origin)} EMPLASEMEN JAKK KE DEPAN KABIN ${state.type2Cabin}.`, route: type2OutboundRoute(state.type2Origin, state.type2Cabin) },
      { code: `R${n}`, sentence: `R${n} LANGSIR DARI DEPAN KABIN ${state.type2Cabin} KE JALUR ${short(state.type2Target)} EMPLASEMEN JAKK, GANDENG RANGKAIAN.`, route: type2ReturnRoute(state.type2Cabin, state.type2Target) }
    ];
    if (state.type === "type3") return [
      { code: `R${n}`, sentence: `R${n} LANGSIR DARI JALUR ${short(state.type3Origin)} KE JALUR ${short(state.type3Dao)} DAO.`, route: deviceRoute(state.type3Origin, state.type3Dao) },
      { code: `L${n}`, sentence: `L${n} LANGSIR DARI JALUR ${short(state.type3Dao)} DAO KE JALUR ${short(state.type3Exit)} EMPLASEMEN JAKK.`, route: deviceRoute(state.type3Dao, state.type3Exit) }
    ];
    const krl = state.krlNumber || "KRL";
    return [
      { code: krl, sentence: `${krl} LANGSIR DARI JALUR ${short(state.type4Origin)} KE ARAH KAMPUNG BANDAN, PREIPAL SINYAL L144.`, route: krlRoute(state.type4Origin, state.type4Target, true) },
      { code: krl, sentence: `${krl} LANGSIR DARI SINYAL L144 KE JALUR ${short(state.type4Target)} EMPLASEMEN JAKK.`, route: krlRoute(state.type4Origin, state.type4Target, false) }
    ];
  }

  function options(list, current) {
    return list.map(([value, name]) => `<option value="${value}" ${value === current ? "selected" : ""}>${value.startsWith("dao-") ? `Jalur ${name} DAO` : `Jalur ${name} JAKK`}</option>`).join("");
  }
  function field(title, key, list) { return `<label>${title}<select data-key="${key}">${options(list, state[key])}</select></label>`; }

  function manualField(title, key, placeholder, textarea = false) {
    const value = escapeHtml(state[key]);
    if (textarea) return `<label>${title}<textarea data-key="${key}" placeholder="${escapeHtml(placeholder)}">${value}</textarea></label>`;
    return `<label>${title}<input data-key="${key}" value="${value}" placeholder="${escapeHtml(placeholder)}"></label>`;
  }

  function manualStageFields(number) {
    return `<h3 class="manual-stage-title">URUTAN LANGSIR ${number}</h3>` +
      manualField("Kode sarana/rangkaian", `manual${number}Code`, "Contoh: L26, R25, atau KRL") +
      manualField("Jalur/lokasi awal", `manual${number}Origin`, "Contoh: Jalur VII JAKK") +
      manualField("Jalur/lokasi akhir", `manual${number}Destination`, "Contoh: Jalur 4 DAO") +
      manualField("Kalimat perintah langsir", `manual${number}Sentence`, "Tulis perintah langsir lengkap", true) +
      manualField("Sinyal yang dilalui", `manual${number}Signals`, "Pisahkan dengan koma") +
      manualField("Wesel JAKK", `manual${number}Jakk`, "Pisahkan dengan koma") +
      manualField("Wesel DAO", `manual${number}Dao`, "Pisahkan dengan koma");
  }

  function renderControls() {
    let html = "";
    if (state.type === "type1") html = field("Jalur awal loks", "type1Origin", serviceOptions()) + field("Jalur masuk DAO", "type1Entry", DB.daoTracks) + field("Gandeng jalur DAO", "type1Coupling", DB.daoTracks) + field("Kembali ke jalur JAKK", "type1Exit", serviceOptions());
    if (state.type === "type2") html = field("Jalur awal loks", "type2Origin", DB.jakkTracks) + `<label>Sinyal depan kabin<select data-key="type2Cabin">${DB.cabinSignals.map((x) => `<option ${x === state.type2Cabin ? "selected" : ""}>${x}</option>`).join("")}</select></label>` + field("Jalur gandeng", "type2Target", serviceOptions());
    if (state.type === "type3") html = field("Jalur awal JAKK", "type3Origin", serviceOptions()) + field("Jalur tujuan DAO", "type3Dao", DB.daoTracks) + field("Jalur kembali JAKK", "type3Exit", serviceOptions());
    if (state.type === "type4") html = `<label>Nomor KRL<input data-key="krlNumber" value="${state.krlNumber}" placeholder="Nomor KRL"></label>` + field("Jalur awal KRL", "type4Origin", DB.jakkTracks) + field("Jalur tujuan KRL", "type4Target", DB.jakkTracks);
    if (state.type === "manual") html = `<label>Jumlah urutan langsir<select data-key="manualStageCount"><option value="1" ${state.manualStageCount === "1" ? "selected" : ""}>1 urutan</option><option value="2" ${state.manualStageCount === "2" ? "selected" : ""}>2 urutan</option></select></label><label>Emplasemen<select data-key="manualEmplacement"><option ${state.manualEmplacement === "JAKK" ? "selected" : ""}>JAKK</option><option ${state.manualEmplacement === "JAKK–DAO" ? "selected" : ""}>JAKK–DAO</option></select></label>` + manualStageFields(1) + (state.manualStageCount === "2" ? manualStageFields(2) : "");
    $("routeControls").innerHTML = html;
    $("routeControls").querySelectorAll("[data-key]").forEach((el) => el.addEventListener("input", (e) => {
      state[e.target.dataset.key] = e.target.value;
      if (e.target.dataset.key === "manualStageCount") renderControls();
      render();
    }));
  }

  function stageHtml(stage, index) {
    const list = (x) => x.length ? x.join(" · ") : "Tidak dilalui";
    return `<article class="stage-card"><div class="stage-title"><i>${index + 1}</i><span>Urutan Langsir ${index + 1} · ${stage.code}<br><small>${stage.route.origin} → ${stage.route.destination}</small></span></div><div class="stage-body"><div class="command">${stage.sentence}</div><div class="devices"><div class="device"><small>SINYAL</small><b>${list(stage.route.signals)}</b></div><div class="device"><small>WESEL JAKK</small><b>${list(stage.route.jakk)}</b></div><div class="device"><small>WESEL DAO</small><b>${list(stage.route.dao)}</b></div></div></div></article>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  function fullDate(value) {
    if (!value) return "-";
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC"
    }).format(date);
  }

  function showToast(message, isError = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function loadHistory() {
    try {
      const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function writeHistory(records) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
      return true;
    } catch (error) {
      showToast("Riwayat gagal disimpan. Penyimpanan browser tidak tersedia.", true);
      return false;
    }
  }

  function normalizedOrderNumber() {
    return String(state.orderNumber || "").replace(/\D/g, "").padStart(3, "0").slice(-3);
  }

  function trainNumber(stageData) {
    if (state.type === "manual") return stageData.map((stage) => stage.code).filter((code) => code !== "-").join(" / ") || "-";
    if (state.type === "type4") return state.krlNumber || "KRL";
    return state.movementNumber || "-";
  }

  function signatureIdentity() {
    return [...document.querySelectorAll(".signature-card[data-role]")].map((card) => {
      const inputs = card.querySelectorAll("input");
      const role = card.querySelector("[data-signature-role]")?.textContent || card.querySelector("b").textContent;
      return { role, name: inputs[0].value.trim(), nipp: inputs[1].value.trim() };
    });
  }

  function dailyHistory(date = state.date) {
    return loadHistory()
      .filter((record) => record.date === date)
      .sort((a, b) => Number(a.orderNumber) - Number(b.orderNumber) || String(a.savedAt).localeCompare(String(b.savedAt)));
  }

  function renderHistory() {
    const records = dailyHistory();
    $("historyDate").textContent = fullDate(state.date);
    $("historyCount").textContent = `${records.length} order`;
    $("downloadRecap").disabled = records.length === 0;
    if (!records.length) {
      $("historyList").innerHTML = `<div class="history-empty">Belum ada order yang disimpan pada tanggal ini.</div>`;
      return;
    }
    $("historyList").innerHTML = records.map((record) => {
      const summary = record.stages.map((stage) => stage.sentence).join(" · ");
      return `<article class="history-item">
        <div class="history-order"><strong>${escapeHtml(record.fullOrder)}</strong><span>${escapeHtml(record.start || "-")}–${escapeHtml(record.end || "-")}</span></div>
        <div class="history-detail"><b>${escapeHtml(record.trainNumber)} · ${escapeHtml(record.typeTitle)}</b><span>${escapeHtml(summary)}</span></div>
        <button class="history-delete" type="button" data-delete-order="${escapeHtml(record.id)}" aria-label="Hapus order ${escapeHtml(record.fullOrder)}">×</button>
      </article>`;
    }).join("");
    $("historyList").querySelectorAll("[data-delete-order]").forEach((button) => button.addEventListener("click", () => {
      const record = records.find((item) => item.id === button.dataset.deleteOrder);
      if (!record || !window.confirm(`Hapus ${record.fullOrder} dari riwayat tanggal ini?`)) return;
      if (writeHistory(loadHistory().filter((item) => item.id !== record.id))) {
        renderHistory();
        showToast(`${record.fullOrder} sudah dihapus dari riwayat.`);
      }
    }));
  }

  function saveCurrentOrder() {
    render();
    const orderNumber = normalizedOrderNumber();
    const stageData = stages();
    if (!state.date || !String(state.orderNumber || "").match(/\d/)) {
      showToast("Tanggal dan nomor order harus diisi.", true);
      return;
    }
    if (state.type === "manual" && stageData.some((stage) => stage.code === "-" || stage.sentence === "Perintah langsir belum diisi.")) {
      showToast("Kode sarana dan kalimat perintah pada Form Manual harus diisi.", true);
      return;
    }
    const history = loadHistory();
    if (history.some((record) => record.date === state.date && record.orderNumber === orderNumber)) {
      showToast(`Nomor order ${orderNumber} sudah tersimpan pada tanggal ini.`, true);
      return;
    }
    const record = {
      id: `${state.date}-${orderNumber}-${Date.now()}`,
      date: state.date,
      orderNumber,
      fullOrder: $("fullOrder").textContent,
      trainNumber: trainNumber(stageData),
      type: state.type,
      typeTitle: TYPE_TITLES[state.type],
      start: state.start,
      end: state.end,
      savedAt: new Date().toISOString(),
      stages: stageData.map((stage) => ({
        code: stage.code,
        sentence: stage.sentence,
        origin: stage.route.origin,
        destination: stage.route.destination,
        signals: [...stage.route.signals],
        jakk: [...stage.route.jakk],
        dao: [...stage.route.dao]
      })),
      signatures: signatureIdentity()
    };
    history.push(record);
    if (!writeHistory(history)) return;
    const nextNumber = Math.min(999, Number(orderNumber) + 1);
    state.orderNumber = String(nextNumber).padStart(3, "0");
    $("orderNumber").value = state.orderNumber;
    render();
    showToast(`${record.fullOrder} berhasil disimpan. Nomor berikutnya ${state.orderNumber}.`);
  }

  function csvCell(value) {
    const clean = String(value ?? "").replace(/\r?\n/g, " ");
    return `"${clean.replace(/"/g, '""')}"`;
  }

  function downloadDailyRecap() {
    const records = dailyHistory();
    if (!records.length) {
      showToast("Belum ada order untuk tanggal ini.", true);
      return;
    }
    const headers = ["Nomor Kereta/LOK", "Dari Jalur", "Ke Jalur / Gandeng Jalur"];
    const rows = records.flatMap((record) => (record.stages || []).map((stage) => [
      stage.code || record.trainNumber || "-",
      stage.origin || "-",
      stage.destination || "-"
    ]));
    const csv = `sep=;\r\n${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `REKAP_ORDER_LANGSIR_${state.date.split("-").reverse().join("-")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${records.length} order berhasil dibuat menjadi rekap harian.`);
  }

  function signatureData() {
    return [...document.querySelectorAll(".signature-card[data-role]")].map((card) => {
      const inputs = card.querySelectorAll("input");
      return {
        role: card.querySelector("[data-signature-role]")?.textContent || card.querySelector("b").textContent,
        image: card.querySelector("canvas").toDataURL("image/png"),
        name: inputs[0].value,
        nipp: inputs[1].value
      };
    });
  }

  function dutySignatureCard() {
    return document.querySelector('.signature-card[data-role="ppkapap"]');
  }

  function clearCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function canvasHasInk(canvas) {
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) return true;
    }
    return false;
  }

  function drawSignatureImage(canvas, source, onDone) {
    const image = new Image();
    image.onload = () => {
      clearCanvas(canvas);
      const rect = canvas.getBoundingClientRect();
      const availableWidth = Math.max(1, rect.width - 12);
      const availableHeight = Math.max(1, rect.height - 10);
      const scale = Math.min(availableWidth / image.naturalWidth, availableHeight / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const x = (rect.width - width) / 2;
      const y = (rect.height - height) / 2;
      canvas.getContext("2d").drawImage(image, x, y, width, height);
      if (onDone) onDone();
    };
    image.onerror = () => showToast("Gambar tanda tangan tidak dapat dibaca.", true);
    image.src = source;
  }

  function loadDutySignature() {
    try {
      const saved = JSON.parse(localStorage.getItem(DUTY_SIGNATURE_KEY) || "null");
      if (!saved || !saved.image || !saved.name || !saved.nipp) return null;
      return saved;
    } catch (error) {
      return null;
    }
  }

  function updateDutySignatureStatus(saved, message = "") {
    const status = $("dutySignatureStatus");
    if (message) {
      status.textContent = message;
      status.classList.remove("active");
      return;
    }
    if (!saved) {
      status.textContent = "Belum ada TTD dinas tersimpan";
      status.classList.remove("active");
      return;
    }
    status.textContent = `AKTIF SELAMA DINAS · ${saved.role} ${saved.name} · NIPP ${saved.nipp}`;
    status.classList.add("active");
  }

  function setDutyRole(role, useGenericLabel = false) {
    const normalized = role === "PPKA" ? "PPKA" : "PAP";
    $("dutyRole").value = normalized;
    dutySignatureCard().querySelector("[data-signature-role]").textContent = useGenericLabel ? "PPKA/PAP" : normalized;
  }

  function applyDutySignature(saved) {
    const card = dutySignatureCard();
    const inputs = card.querySelectorAll("input");
    setDutyRole(saved.role);
    inputs[0].value = saved.name;
    inputs[1].value = saved.nipp;
    updateDutySignatureStatus(saved);
    drawSignatureImage(card.querySelector("canvas"), saved.image, render);
  }

  function saveDutySignature() {
    const card = dutySignatureCard();
    const canvas = card.querySelector("canvas");
    const inputs = card.querySelectorAll("input");
    const saved = {
      role: $("dutyRole").value === "PPKA" ? "PPKA" : "PAP",
      name: inputs[0].value.trim(),
      nipp: inputs[1].value.trim(),
      image: canvas.toDataURL("image/png"),
      savedAt: new Date().toISOString()
    };
    if (!saved.name || !saved.nipp) {
      showToast("Isi nama dan NIPP petugas PPKA/PAP terlebih dahulu.", true);
      return;
    }
    if (!canvasHasInk(canvas)) {
      showToast("Gambar atau tempel tanda tangan petugas terlebih dahulu.", true);
      return;
    }
    try {
      localStorage.setItem(DUTY_SIGNATURE_KEY, JSON.stringify(saved));
      setDutyRole(saved.role);
      updateDutySignatureStatus(saved);
      render();
      showToast(`TTD ${saved.role} ${saved.name} aktif selama dinas.`);
    } catch (error) {
      showToast("TTD dinas gagal disimpan pada browser ini.", true);
    }
  }

  function clearDutySignature() {
    if (!window.confirm("Aplusan petugas? Hapus TTD dinas yang sedang tersimpan?")) return;
    try {
      localStorage.removeItem(DUTY_SIGNATURE_KEY);
    } catch (error) {
      showToast("TTD dinas tidak dapat dihapus dari browser.", true);
      return;
    }
    const card = dutySignatureCard();
    const inputs = card.querySelectorAll("input");
    clearCanvas(card.querySelector("canvas"));
    inputs[0].value = "";
    inputs[1].value = "";
    $("dutySignatureUpload").value = "";
    setDutyRole("PAP", true);
    updateDutySignatureStatus(null);
    render();
    showToast("TTD dinas lama dihapus. Silakan isi petugas aplusan.");
  }

  function attachDutySignature(file) {
    if (!file || !file.type.startsWith("image/")) {
      showToast("Pilih file gambar tanda tangan.", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => drawSignatureImage(dutySignatureCard().querySelector("canvas"), String(reader.result), () => {
      updateDutySignatureStatus(null, "TTD sudah ditempel · klik Simpan Selama Dinas");
      render();
    });
    reader.onerror = () => showToast("File tanda tangan gagal dibaca.", true);
    reader.readAsDataURL(file);
  }

  function pathBounds(pathData) {
    const tokens = String(pathData || "").match(/[MLHC]|-?\d*\.?\d+/gi) || [];
    const points = [];
    let command = "", index = 0, x = 0, y = 0;
    const add = (nextX, nextY) => { x = Number(nextX); y = Number(nextY); points.push([x, y]); };
    while (index < tokens.length) {
      if (/^[MLHC]$/i.test(tokens[index])) command = tokens[index++].toUpperCase();
      if (command === "M" || command === "L") {
        add(tokens[index++], tokens[index++]);
      } else if (command === "H") {
        add(tokens[index++], y);
      } else if (command === "C") {
        add(tokens[index++], tokens[index++]);
        add(tokens[index++], tokens[index++]);
        add(tokens[index++], tokens[index++]);
      } else {
        index += 1;
      }
    }
    if (!points.length) return null;
    return {
      minX: Math.min(...points.map((point) => point[0])),
      minY: Math.min(...points.map((point) => point[1])),
      maxX: Math.max(...points.map((point) => point[0])),
      maxY: Math.max(...points.map((point) => point[1]))
    };
  }

  function routeCrop(paths) {
    const bounds = paths.map((item) => pathBounds(item.d)).filter(Boolean);
    if (!bounds.length) return [0, 0, MAP_WIDTH, MAP_HEIGHT];
    let minX = Math.min(...bounds.map((box) => box.minX)) - 80;
    let maxX = Math.max(...bounds.map((box) => box.maxX)) + 80;
    let minY = Math.min(...bounds.map((box) => box.minY)) - 72;
    let maxY = Math.max(...bounds.map((box) => box.maxY)) + 72;
    const minimumWidth = 1120, minimumHeight = 220;
    if (maxX - minX < minimumWidth) {
      const extra = (minimumWidth - (maxX - minX)) / 2;
      minX -= extra; maxX += extra;
    }
    if (maxY - minY < minimumHeight) {
      const extra = (minimumHeight - (maxY - minY)) / 2;
      minY -= extra; maxY += extra;
    }
    if (minX < 0) { maxX -= minX; minX = 0; }
    if (minY < 0) { maxY -= minY; minY = 0; }
    if (maxX > MAP_WIDTH) { minX -= maxX - MAP_WIDTH; maxX = MAP_WIDTH; }
    if (maxY > MAP_HEIGHT) { minY -= maxY - MAP_HEIGHT; maxY = MAP_HEIGHT; }
    minX = Math.max(0, minX); minY = Math.max(0, minY);
    return [minX, minY, maxX - minX, maxY - minY].map((value) => Math.round(value));
  }

  function orderedSwitches(stage) {
    const jakk = (stage.route.jakk || []).map((code) => ({ code, area: "JAKK" }));
    const dao = (stage.route.dao || []).map((code) => ({ code, area: "DAO" }));
    return /\bDAO\b/i.test(stage.route.origin) ? [...dao, ...jakk] : [...jakk, ...dao];
  }

  function stageMapSpecs(stageData) {
    let routePaths = [];
    if (state.type === "type1") routePaths = [
      [{ d: daoPath(state.type1Origin, state.type1Entry), dir: "end" }, { d: daoTransfer(state.type1Entry, state.type1Coupling), dir: "end" }],
      [{ d: daoPath(state.type1Exit, state.type1Coupling), dir: "start" }]
    ];
    if (state.type === "type2") routePaths = [
      [{ d: cabinPath(state.type2Origin, state.type2Cabin), dir: "end" }],
      [{ d: cabinPath(state.type2Target, state.type2Cabin), dir: "start" }]
    ];
    if (state.type === "type3") routePaths = [
      [{ d: daoPath(state.type3Origin, state.type3Dao), dir: "end" }],
      [{ d: daoPath(state.type3Exit, state.type3Dao), dir: "start" }]
    ];
    if (state.type === "type4") routePaths = [
      [{ d: cabinPath(state.type4Origin, "L144"), dir: "end" }],
      [{ d: cabinPath(state.type4Target, "L144"), dir: "start" }]
    ];
    return stageData.map((stage, index) => {
      const paths = routePaths[index]?.length ? routePaths[index] : [{ d: "M180 578 H2620", dir: "end" }];
      return {
        stage,
        paths,
        crop: routeCrop(paths),
        switches: orderedSwitches(stage),
        showEmplacement: state.type !== "manual",
        color: index === 0 ? "#dc2626" : "#ffd400"
      };
    });
  }

  function routeFigureHtml(spec, index) {
    const [x, y, width, height] = spec.crop;
    const title = `Urutan Langsir ${index + 1}: ${spec.stage.route.origin} ke ${spec.stage.route.destination}`;
    const markerId = `route-arrow-${index}-${routeMarkerSerial++}`;
    const arrowHeight = Math.round(Math.max(44, Math.min(68, width * 0.037)));
    const arrowWidth = Math.round(arrowHeight * 1.2);
    const routePaths = spec.paths.map((path) => {
      const arrow = path.dir === "start" ? `marker-start="url(#${markerId})"` : `marker-end="url(#${markerId})"`;
      return `<path class="isolated-route-halo" d="${path.d}"></path><path class="isolated-route-line" d="${path.d}" ${arrow}></path>`;
    }).join("");
    const emplacementImage = spec.showEmplacement
      ? `<image class="route-emplacement-image" href="emplasemen-jakk-dao.webp" x="0" y="0" width="${MAP_WIDTH}" height="${MAP_HEIGHT}" preserveAspectRatio="none"></image>`
      : "";
    const switches = spec.switches.length
      ? spec.switches.map((item, switchIndex) => `<li><span>${switchIndex + 1}</span><b>${escapeHtml(item.code)}</b><small>${item.area}</small></li>`).join("")
      : `<li class="device-empty">Belum diisi</li>`;
    const imageNote = spec.showEmplacement ? "FOTO DENAH ASLI · ARSIR RUTE AKTIF" : "RUTE MANUAL · IKUTI ARAH PANAH";
    return `<figure class="route-crop" style="--route-color:${spec.color}"><figcaption><span>URUTAN LANGSIR ${index + 1}</span><b>${escapeHtml(spec.stage.route.origin)}</b><em aria-hidden="true">→</em><b>${escapeHtml(spec.stage.route.destination)}</b></figcaption><div class="isolated-route"><div class="isolated-route-canvas"><svg viewBox="${x} ${y} ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(title)}"><defs><marker id="${markerId}" viewBox="0 0 12 10" refX="10.4" refY="5" markerUnits="userSpaceOnUse" markerWidth="${arrowWidth}" markerHeight="${arrowHeight}" orient="auto-start-reverse" overflow="visible"><path class="route-arrow-head" d="M0 0 L12 5 L0 10 L2.7 5 Z" fill="${spec.color}"></path></marker></defs>${emplacementImage}${routePaths}</svg><div class="route-compass" aria-hidden="true"><b>← JAKK</b><b>TPK →</b></div><span>${imageNote}</span></div><div class="route-device-row route-switch-row"><strong>WESEL DILALUI</strong><ol class="route-switch-chain">${switches}</ol></div></div></figure>`;
  }

  function routeMapsHtml(stageData) {
    return stageMapSpecs(stageData).map((spec, index) => routeFigureHtml(spec, index)).join("");
  }

  function renderRouteMaps(stageData) {
    $("routeMapList").innerHTML = routeMapsHtml(stageData);
  }

  function printFormHtml(stageData, title, order) {
    const routeRows = stageData.map((stage, index) => `<tr class="filled-route-row">
      <td><span class="stage-number">Urutan Langsir ${index + 1}</span>${escapeHtml(stage.code)}</td>
      <td>${escapeHtml(stage.route.origin)}</td>
      <td>${escapeHtml(stage.route.destination)}</td>
      <td><strong>${escapeHtml(stage.sentence)}</strong><span>Sinyal: ${escapeHtml(stage.route.signals.join(", ") || "-")}</span><span>Wesel JAKK: ${escapeHtml(stage.route.jakk.join(", ") || "-")}</span><span>Wesel DAO: ${escapeHtml(stage.route.dao.join(", ") || "-")}</span></td>
    </tr>`).join("");
    const signatures = signatureData().map((person) => `<div class="print-signature-cell"><strong>${escapeHtml(person.role)}</strong><img class="print-signature-image" src="${person.image}" alt=""><p>Nama: ${escapeHtml(person.name)}</p><p>NIPP: ${escapeHtml(person.nipp)}</p></div>`).join("");
    const emplacement = state.type === "manual" ? state.manualEmplacement : (state.type === "type1" || state.type === "type3" ? "JAKK–DAO" : "JAKK");
    return `<article class="print-form-copy">
      <header class="print-form-header"><div class="print-brand"><img src="logo-kai.svg" alt="Logo KAI"></div><div class="print-title"><strong>FORM PERINTAH LANGSIR</strong><span>STASIUN JAKARTA KOTA</span><b>Nomor: ${escapeHtml(order)}</b></div><div class="print-emplacement"><span>Emplasemen:</span><b>${emplacement}</b></div></header>
      <div class="print-info"><div><span>Hari/Tanggal</span><b>${escapeHtml(fullDate(state.date))}</b></div><div><span>Tipe</span><b>${escapeHtml(title)}</b></div><div><span>Jam Mulai</span><b>${escapeHtml(state.start || "-")}</b></div><div><span>Jam Selesai</span><b>${escapeHtml(state.end || "-")}</b></div></div>
      <section class="print-map-section"><div class="print-map-heading">POTONGAN DENAH EMPLASEMEN DAN ARSIR RUTE · KIRI JAKK / KANAN TPK</div><div class="print-map-grid">${routeMapsHtml(stageData)}</div></section>
      <table class="print-route-table"><colgroup><col class="col-code"><col class="col-track"><col class="col-track"><col class="col-note"></colgroup><thead><tr><th>Rangkaian</th><th>Jalur Awal</th><th>Jalur Akhir</th><th>Keterangan</th></tr></thead><tbody>${routeRows}</tbody></table>
      <section class="print-signatures"><div class="print-signature-groups"><span>Yang Menerima Perintah</span><span>Yang Memerintah</span></div><div class="print-signature-grid">${signatures}</div></section>
      <footer class="print-form-footer">1/1</footer>
    </article>`;
  }

  function renderPrintPair(stageData, title, order) {
    $("printPair").innerHTML = printFormHtml(stageData, title, order) + printFormHtml(stageData, title, order);
  }

  function daoPath(jakk, dao) { const g = DB.geometry; return `${g.jakkToDaoMouth[jakk] || g.jakkToDaoMouth["jakk-ix"]}${g.daoWestLeg[dao] || g.daoWestLeg["dao-5"]} H2085`; }
  function daoTransfer(entry, coupling) {
    const g = DB.geometry.daoEastLeg, from = g[entry] || g["dao-5"], to = g[coupling] || g["dao-4"];
    const turn = Math.min(2744, Math.max(from.joinX, to.joinX) + 22);
    return to.y === 548 ? `${from.d} H${turn} H2085` : `${from.d} H${turn} H${to.joinX} L${to.bendX} ${to.y} H2085`;
  }
  function cabinPath(track, signal) {
    const g = DB.geometry, startY = g.trackStartY[track] || 608, railY = g.railY[track] || startY, endY = g.cabinY[signal] || g.cabinY.L144, endX = g.cabinX[signal] || g.cabinX.L144;
    const start = `M145 ${startY} H455`, curve = startY === railY ? " H525" : ` C500 ${startY} 500 ${railY} 540 ${railY}`;
    if (railY === endY) return `${start}${curve} H${endX}`;
    const upward = endY < railY, levels = unique(Object.values(g.railY)).filter((y) => y >= Math.min(railY,endY) && y <= Math.max(railY,endY)).sort((a,b) => upward ? b-a : a-b);
    let x = 580, d = `${start}${curve} H${x}`;
    for (let i=1;i<levels.length;i++) { x += 96; d += ` L${x} ${levels[i]} H${x+18}`; x += 18; }
    return `${d} H${endX}`;
  }

  function render() {
    routeMarkerSerial = 0;
    $("typeTitle").textContent = TYPE_TITLES[state.type];
    const date = state.date ? new Date(`${state.date}T00:00:00`) : new Date();
    const order = String(state.orderNumber || "1").replace(/\D/g,"").padStart(3,"0").slice(-3);
    $("fullOrder").textContent = `${order}/${ROMAN[date.getMonth()]}/JAKK/${date.getFullYear()}`;
    const stageData = stages();
    $("movementNumberField").hidden = state.type === "manual";
    $("metaMovement").textContent = state.type === "manual" ? stageData.map((stage) => stage.code).join(" / ") : (state.type === "type4" ? (state.krlNumber || "KRL") : (state.movementNumber || "-"));
    $("metaDate").textContent = state.date || "-"; $("metaStart").textContent = state.start || "-"; $("metaEnd").textContent = state.end || "-";
    $("stageList").innerHTML = stageData.map(stageHtml).join("");
    renderRouteMaps(stageData);
    renderPrintPair(stageData, TYPE_TITLES[state.type], $("fullOrder").textContent);
    renderHistory();
  }

  function initInputs() {
    const now = new Date(), local = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10); state.date = local; $("orderDate").value = local;
    [["orderNumber","orderNumber"],["movementNumber","movementNumber"],["orderDate","date"],["startTime","start"],["endTime","end"]].forEach(([id,key]) => $(id).addEventListener("input",(e) => { state[key]=e.target.value; render(); }));
    $("typeTabs").addEventListener("click",(e) => { const button=e.target.closest("button[data-type]"); if(!button)return; state.type=button.dataset.type; document.querySelectorAll("#typeTabs button").forEach((x)=>x.classList.toggle("active",x===button)); renderControls(); render(); });
    $("saveOrder").addEventListener("click", saveCurrentOrder);
    $("downloadRecap").addEventListener("click", downloadDailyRecap);
    $("printButton").addEventListener("click",()=>{ render(); window.print(); });
    window.addEventListener("beforeprint", render);
  }

  function initSignatures() {
    const canvases = [...document.querySelectorAll(".signature-card canvas")];
    canvases.forEach((canvas) => {
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(1, devicePixelRatio || 1);
        const oldImage = canvasHasInk(canvas) ? canvas.toDataURL("image/png") : "";
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        const context = canvas.getContext("2d");
        context.scale(ratio, ratio);
        context.lineWidth = 2;
        context.lineCap = "round";
        if (oldImage) drawSignatureImage(canvas, oldImage, render);
      };
      resize();
      const ctx = canvas.getContext("2d");
      let drawing = false;
      const point = (event) => {
        const rect = canvas.getBoundingClientRect();
        return [event.clientX - rect.left, event.clientY - rect.top];
      };
      canvas.addEventListener("pointerdown", (event) => {
        drawing = true;
        canvas.setPointerCapture(event.pointerId);
        const [x, y] = point(event);
        ctx.beginPath();
        ctx.moveTo(x, y);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!drawing) return;
        const [x, y] = point(event);
        ctx.lineTo(x, y);
        ctx.stroke();
      });
      canvas.addEventListener("pointerup", () => {
        drawing = false;
        if (canvas.closest(".signature-card")?.dataset.role === "ppkapap") {
          updateDutySignatureStatus(null, "Ada perubahan TTD · klik Simpan Selama Dinas");
        }
        render();
      });
      canvas.addEventListener("pointercancel", () => { drawing = false; });
    });
    document.querySelectorAll(".signature-card input").forEach((input) => input.addEventListener("input", () => {
      if (input.closest(".signature-card")?.dataset.role === "ppkapap") {
        updateDutySignatureStatus(null, "Data petugas berubah · klik Simpan Selama Dinas");
      }
      render();
    }));
    $("dutyRole").addEventListener("change", (event) => {
      setDutyRole(event.target.value);
      updateDutySignatureStatus(null, "Jabatan berubah · klik Simpan Selama Dinas");
      render();
    });
    $("dutySignatureUpload").addEventListener("change", (event) => {
      attachDutySignature(event.target.files?.[0]);
    });
    $("saveDutySignature").addEventListener("click", saveDutySignature);
    $("clearDutySignature").addEventListener("click", clearDutySignature);
    $("clearSign").addEventListener("click", () => {
      canvases.forEach(clearCanvas);
      const savedDuty = loadDutySignature();
      if (savedDuty) applyDutySignature(savedDuty);
      else render();
    });
    const savedDuty = loadDutySignature();
    if (savedDuty) applyDutySignature(savedDuty);
    else updateDutySignatureStatus(null);
  }

  initInputs(); renderControls(); initSignatures(); render();
})();
