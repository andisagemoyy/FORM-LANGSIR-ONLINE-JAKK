(() => {
  "use strict";
  const DB = window.LANGSIR_DB;
  const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const state = {
    type: "type1", orderNumber: "001", movementNumber: "26", date: "", start: "", end: "",
    type1Origin: "jakk-vii", type1Entry: "dao-5", type1Coupling: "dao-4", type1Exit: "jakk-viii",
    type2Origin: "jakk-vi", type2Cabin: "L124", type2Target: "jakk-viii",
    type3Origin: "jakk-ix", type3Dao: "dao-6", type3Exit: "jakk-vii",
    type4Origin: "jakk-vii", type4Target: "jakk-vi", krlNumber: ""
  };

  const $ = (id) => document.getElementById(id);
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const short = (value) => [...DB.jakkTracks, ...DB.daoTracks].find((x) => x[0] === value)?.[1] || value;
  const label = (value) => `${value.startsWith("dao-") ? "Jalur " + short(value) + " DAO" : "Jalur " + short(value) + " JAKK"}`;
  const serviceOptions = () => DB.jakkTracks.filter((x) => DB.serviceTracks.includes(x[0]));
  const reverse = (list) => [...list].reverse();

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

  function renderControls() {
    let html = "";
    if (state.type === "type1") html = field("Jalur awal loks", "type1Origin", serviceOptions()) + field("Jalur masuk DAO", "type1Entry", DB.daoTracks) + field("Gandeng jalur DAO", "type1Coupling", DB.daoTracks) + field("Kembali ke jalur JAKK", "type1Exit", serviceOptions());
    if (state.type === "type2") html = field("Jalur awal loks", "type2Origin", DB.jakkTracks) + `<label>Sinyal depan kabin<select data-key="type2Cabin">${DB.cabinSignals.map((x) => `<option ${x === state.type2Cabin ? "selected" : ""}>${x}</option>`).join("")}</select></label>` + field("Jalur gandeng", "type2Target", serviceOptions());
    if (state.type === "type3") html = field("Jalur awal JAKK", "type3Origin", serviceOptions()) + field("Jalur tujuan DAO", "type3Dao", DB.daoTracks) + field("Jalur kembali JAKK", "type3Exit", serviceOptions());
    if (state.type === "type4") html = `<label>Nomor KRL<input data-key="krlNumber" value="${state.krlNumber}" placeholder="Nomor KRL"></label>` + field("Jalur awal KRL", "type4Origin", DB.jakkTracks) + field("Jalur tujuan KRL", "type4Target", DB.jakkTracks);
    $("routeControls").innerHTML = html;
    $("routeControls").querySelectorAll("[data-key]").forEach((el) => el.addEventListener("input", (e) => { state[e.target.dataset.key] = e.target.value; render(); }));
  }

  function stageHtml(stage, index) {
    const list = (x) => x.length ? x.join(" · ") : "Tidak dilalui";
    return `<article class="stage-card"><div class="stage-title"><i>${index + 1}</i><span>Tahap ${index + 1} · ${stage.code}<br><small>${stage.route.origin} → ${stage.route.destination}</small></span></div><div class="stage-body"><div class="command">${stage.sentence}</div><div class="devices"><div class="device"><small>SINYAL</small><b>${list(stage.route.signals)}</b></div><div class="device"><small>WESEL JAKK</small><b>${list(stage.route.jakk)}</b></div><div class="device"><small>WESEL DAO</small><b>${list(stage.route.dao)}</b></div></div></div></article>`;
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
      <td><span class="stage-number">Tahap ${index + 1}</span>${escapeHtml(stage.code)}</td>
      <td>${escapeHtml(stage.route.origin)}</td>
      <td>${escapeHtml(stage.route.destination)}</td>
      <td><strong>${escapeHtml(stage.sentence)}</strong><span>Sinyal: ${escapeHtml(stage.route.signals.join(", ") || "-")}</span><span>Wesel JAKK: ${escapeHtml(stage.route.jakk.join(", ") || "-")}</span><span>Wesel DAO: ${escapeHtml(stage.route.dao.join(", ") || "-")}</span></td>
    </tr>`).join("");
    const signatures = signatureData().map((person) => `<div class="print-signature-cell"><strong>${escapeHtml(person.role)}</strong><img class="print-signature-image" src="${person.image}" alt=""><p>Nama: ${escapeHtml(person.name)}</p><p>NIPP: ${escapeHtml(person.nipp)}</p></div>`).join("");
    const emplacement = state.type === "type1" || state.type === "type3" ? "JAKK–DAO" : "JAKK";
    return `<article class="print-form-copy">
      <header class="print-form-header"><div class="print-brand">KAI</div><div class="print-title"><strong>FORM PERINTAH LANGSIR</strong><span>STASIUN JAKARTA KOTA</span><b>Nomor: ${escapeHtml(order)}</b></div><div class="print-emplacement"><span>Emplasemen:</span><b>${emplacement}</b></div></header>
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
    const titles = { type1:"Loks Dinas Masuk DAO", type2:"Loks Depan Kabin", type3:"Rangkaian JAKK–DAO", type4:"Langsir KRL" };
    $("typeTitle").textContent = titles[state.type];
    const date = state.date ? new Date(`${state.date}T00:00:00`) : new Date();
    const order = String(state.orderNumber || "1").replace(/\D/g,"").padStart(3,"0").slice(-3);
    $("fullOrder").textContent = `${order}/${ROMAN[date.getMonth()]}/JAKK/${date.getFullYear()}`;
    $("metaMovement").textContent = state.type === "type4" ? (state.krlNumber || "KRL") : (state.movementNumber || "-");
    $("metaDate").textContent = state.date || "-"; $("metaStart").textContent = state.start || "-"; $("metaEnd").textContent = state.end || "-";
    const stageData = stages();
    $("stageList").innerHTML = stageData.map(stageHtml).join("");
    renderPrintPair(stageData, titles[state.type], $("fullOrder").textContent);
  }

  function initInputs() {
    const now = new Date(), local = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10); state.date = local; $("orderDate").value = local;
    [["orderNumber","orderNumber"],["movementNumber","movementNumber"],["orderDate","date"],["startTime","start"],["endTime","end"]].forEach(([id,key]) => $(id).addEventListener("input",(e) => { state[key]=e.target.value; render(); }));
    $("typeTabs").addEventListener("click",(e) => { const button=e.target.closest("button[data-type]"); if(!button)return; state.type=button.dataset.type; document.querySelectorAll("#typeTabs button").forEach((x)=>x.classList.toggle("active",x===button)); renderControls(); render(); });
    $("printButton").addEventListener("click",()=>{ render(); window.print(); });
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
