(() => {
  "use strict";
  const DB = window.LANGSIR_DB;
  const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const HISTORY_KEY = "formLangsirJakkHistoryV1";
  const TYPE_TITLES = { type1:"Loks Dinas Masuk DAO", type2:"Loks Depan Kabin", type3:"Rangkaian JAKK–DAO", type4:"Langsir KRL", manual:"Form Manual" };
  let toastTimer;
  const state = {
    type: "type1", orderNumber: "001", movementNumber: "26", date: "", start: "", end: "",
    type1Origin: "jakk-vii", type1Entry: "dao-5", type1Coupling: "dao-4", type1Exit: "jakk-viii",
    type2Origin: "jakk-vi", type2Cabin: "L124", type2Target: "jakk-viii",
    type3Origin: "jakk-ix", type3Dao: "dao-6", type3Exit: "jakk-vii",
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

  function type2Route(origin, cabin, target) {
    return {
      origin: label(origin), destination: `Depan kabin ${cabin}, lalu ${label(target)}`,
      signals: unique([DB.startSignals[origin], cabin]),
      jakk: unique([...levelSwitches(origin, DB.cabinLevel[cabin]), ...reverse(levelSwitches(target, DB.cabinLevel[cabin]))]),
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
      { code: `L${n}`, sentence: `L${n} LANGSIR DARI JALUR ${short(state.type2Origin)} KE DEPAN KABIN ${state.type2Cabin}, GANDENG RANGKAIAN DI JALUR ${short(state.type2Target)}.`, route: type2Route(state.type2Origin, state.type2Cabin, state.type2Target) }
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
      return { role: card.querySelector("b").textContent, name: inputs[0].value.trim(), nipp: inputs[1].value.trim() };
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
    const headers = [
      "No", "Nomor Order", "Nomor Kereta", "Jenis Order", "Tanggal", "Jam Mulai", "Jam Selesai",
      "Urutan Langsir 1", "Jalur Awal 1", "Jalur Akhir 1", "Sinyal 1", "Wesel JAKK 1", "Wesel DAO 1",
      "Urutan Langsir 2", "Jalur Awal 2", "Jalur Akhir 2", "Sinyal 2", "Wesel JAKK 2", "Wesel DAO 2",
      "PUK/PUS", "Masinis", "PLR", "PPKA/PAP", "Waktu Disimpan"
    ];
    const rows = records.map((record, index) => {
      const first = record.stages[0] || {};
      const second = record.stages[1] || {};
      const names = Object.fromEntries((record.signatures || []).map((person) => [person.role, [person.name, person.nipp].filter(Boolean).join(" / ")]));
      return [
        index + 1, record.fullOrder, record.trainNumber, record.typeTitle, record.date, record.start || "-", record.end || "-",
        first.sentence || "-", first.origin || "-", first.destination || "-", (first.signals || []).join(", ") || "-", (first.jakk || []).join(", ") || "-", (first.dao || []).join(", ") || "-",
        second.sentence || "-", second.origin || "-", second.destination || "-", (second.signals || []).join(", ") || "-", (second.jakk || []).join(", ") || "-", (second.dao || []).join(", ") || "-",
        names["PUK/PUS"] || "-", names.MASINIS || "-", names.PLR || "-", names["PPKA/PAP"] || "-", record.savedAt
      ];
    });
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
        role: card.querySelector("b").textContent,
        image: card.querySelector("canvas").toDataURL("image/png"),
        name: inputs[0].value,
        nipp: inputs[1].value
      };
    });
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
      <figure class="print-map-figure"><img src="emplasemen-jakk-dao.webp" alt="Denah emplasemen Jakarta Kota dan DAO"><figcaption>DENAH EMPLASEMEN JAKARTA KOTA–DAO</figcaption></figure>
      <table class="print-route-table"><colgroup><col class="col-code"><col class="col-track"><col class="col-track"><col class="col-note"></colgroup><thead><tr><th>Rangkaian</th><th>Jalur Awal</th><th>Jalur Akhir</th><th>Keterangan</th></tr></thead><tbody>${routeRows}</tbody></table>
      <section class="print-signatures"><div class="print-signature-groups"><span>Yang Menerima Perintah</span><span>Yang Memerintah</span></div><div class="print-signature-grid">${signatures}</div></section>
      <footer class="print-form-footer">1/1</footer>
    </article>`;
  }

  function renderPrintPair(stageData, title, order) {
    const form = printFormHtml(stageData, title, order);
    $("printPair").innerHTML = form + form;
  }

  function daoPath(jakk, dao) { const g = DB.geometry; return `${g.jakkToDaoMouth[jakk] || g.jakkToDaoMouth["jakk-ix"]}${g.daoWestLeg[dao] || g.daoWestLeg["dao-5"]}`; }
  function daoTransfer(entry, coupling) {
    const g = DB.geometry.daoEastLeg, from = g[entry] || g["dao-5"], to = g[coupling] || g["dao-4"];
    const turn = Math.min(2744, Math.max(from.joinX, to.joinX) + 22);
    return to.y === 548 ? `${from.d} H${turn} H2085` : `${from.d} H${turn} H${to.joinX} L${to.bendX} ${to.y} H2085`;
  }
  function cabinPath(track, signal) {
    const g = DB.geometry, startY = g.trackStartY[track] || 608, railY = g.railY[track] || startY, endY = g.cabinY[signal] || g.cabinY.L144;
    const start = `M145 ${startY} H455`, curve = startY === railY ? " H525" : ` C500 ${startY} 500 ${railY} 540 ${railY}`;
    if (railY === endY) return `${start}${curve} H1260`;
    const upward = endY < railY, levels = unique(Object.values(g.railY)).filter((y) => y >= Math.min(railY,endY) && y <= Math.max(railY,endY)).sort((a,b) => upward ? b-a : a-b);
    let x = 580, d = `${start}${curve} H${x}`;
    for (let i=1;i<levels.length;i++) { x += 96; d += ` L${x} ${levels[i]} H${x+18}`; x += 18; }
    return `${d} H1260`;
  }

  function mapStrokes() {
    if (state.type === "type1") return { first:[{d:daoPath(state.type1Origin,state.type1Entry),dir:"end"},{d:daoTransfer(state.type1Entry,state.type1Coupling),dir:"end"}], second:[{d:daoPath(state.type1Exit,state.type1Coupling),dir:"start"}] };
    if (state.type === "type3") return { first:[{d:daoPath(state.type3Origin,state.type3Dao),dir:"end"}], second:[{d:daoPath(state.type3Exit,state.type3Dao),dir:"start"}] };
    const origin = state.type === "type2" ? state.type2Origin : state.type4Origin;
    const target = state.type === "type2" ? state.type2Target : state.type4Target;
    const signal = state.type === "type2" ? state.type2Cabin : "L144";
    return { first:[{d:cabinPath(origin,signal),dir:"end"}], second:[{d:cabinPath(target,signal),dir:"start"}] };
  }

  function drawMap() {
    const ns = "http://www.w3.org/2000/svg", lines = $("routeLines"), routes = mapStrokes(); lines.replaceChildren();
    [[routes.first,"#f97316","arrowOrange"],[routes.second,"#0284c7","arrowBlue"]].forEach(([group,color,marker]) => group.forEach((item) => {
      const path = document.createElementNS(ns,"path"); path.setAttribute("d",item.d); path.setAttribute("fill","none"); path.setAttribute("stroke",color); path.setAttribute("stroke-width","4"); path.setAttribute("stroke-linecap","round"); path.setAttribute("stroke-linejoin","round"); path.setAttribute("opacity",".9"); path.setAttribute(item.dir === "start" ? "marker-start" : "marker-end",`url(#${marker})`); lines.appendChild(path);
    }));
  }

  function render() {
    $("typeTitle").textContent = TYPE_TITLES[state.type];
    const date = state.date ? new Date(`${state.date}T00:00:00`) : new Date();
    const order = String(state.orderNumber || "1").replace(/\D/g,"").padStart(3,"0").slice(-3);
    $("fullOrder").textContent = `${order}/${ROMAN[date.getMonth()]}/JAKK/${date.getFullYear()}`;
    const stageData = stages();
    $("movementNumberField").hidden = state.type === "manual";
    $("metaMovement").textContent = state.type === "manual" ? stageData.map((stage) => stage.code).join(" / ") : (state.type === "type4" ? (state.krlNumber || "KRL") : (state.movementNumber || "-"));
    $("metaDate").textContent = state.date || "-"; $("metaStart").textContent = state.start || "-"; $("metaEnd").textContent = state.end || "-";
    $("stageList").innerHTML = stageData.map(stageHtml).join("");
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
      const resize = () => { const r=canvas.getBoundingClientRect(), ratio=Math.max(1,devicePixelRatio||1), old=canvas.toDataURL(); canvas.width=r.width*ratio; canvas.height=r.height*ratio; const ctx=canvas.getContext("2d"); ctx.scale(ratio,ratio); ctx.lineWidth=2; ctx.lineCap="round"; if(old!=="data:,"){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,r.width,r.height);img.src=old;} }; resize();
      const ctx=canvas.getContext("2d"); let drawing=false;
      const point=(e)=>{const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
      canvas.addEventListener("pointerdown",(e)=>{drawing=true;canvas.setPointerCapture(e.pointerId);const[x,y]=point(e);ctx.beginPath();ctx.moveTo(x,y)});
      canvas.addEventListener("pointermove",(e)=>{if(!drawing)return;const[x,y]=point(e);ctx.lineTo(x,y);ctx.stroke()});
      canvas.addEventListener("pointerup",()=>{drawing=false;render()}); canvas.addEventListener("pointercancel",()=>drawing=false);
    });
    document.querySelectorAll(".signature-card input").forEach((input) => input.addEventListener("input", render));
    $("clearSign").addEventListener("click",()=>{canvases.forEach((c)=>c.getContext("2d").clearRect(0,0,c.width,c.height));render()});
  }

  initInputs(); renderControls(); initSignatures(); render();
})();
