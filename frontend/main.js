import "./style.css";

const $ = (sel) => document.querySelector(sel);

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

function setBtnLoading(btn, loading, labelWhenDone) {
  btn.disabled = loading;
  btn.dataset._label ??= btn.textContent;
  btn.textContent = loading ? "Aguarde..." : (labelWhenDone || btn.dataset._label);
}

function prettyMoney(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2);
}

function showKV(el, obj) {
  el.innerHTML = `
    <div>eventType</div><div>${obj.eventType ?? "-"}</div>
    <div>orderId</div><div>${obj.orderId ?? "-"}</div>
    <div>customerId</div><div>${obj.customerId ?? "-"}</div>
    <div>total</div><div>${obj.total != null ? prettyMoney(obj.total) : "-"}</div>
    <div>timestamp</div><div>${obj.createdAt ?? obj.at ?? "-"}</div>
    ${obj.status ? `<div>status</div><div>${obj.status}</div>` : ""}
  `;
}

function setBadge(kind, text, state) {
  const badge = kind === "create" ? $("#createBadge") : $("#statusBadge");
  const badgeText = kind === "create" ? $("#createBadgeText") : $("#statusBadgeText");

  badge.style.display = "inline-flex";
  badge.classList.remove("ok", "err");
  if (state === "ok") badge.classList.add("ok");
  if (state === "err") badge.classList.add("err");
  badgeText.textContent = text;
}

let lastOrderId = "";
let pollTimer = null;

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function fetchStatusOnce(orderId) {
  const r = await fetch(`/api/status/${encodeURIComponent(orderId)}`);
  const j = await r.json().catch(() => ({}));
  return { r, j };
}

async function pollStatus(orderId, seconds = 10) {
  stopPolling();

  let attempt = 0;
  setBadge("status", `Aguardando status... (0/${seconds})`, ""); // estado neutro
  $("#statusBox").style.display = "none";

  return new Promise((resolve) => {
    pollTimer = setInterval(async () => {
      attempt++;

      try {
        const { r, j } = await fetchStatusOnce(orderId);

        if (r.ok && j?.status) {
          stopPolling();
          setBadge("status", "Status encontrado em order_status.v1", "ok");
          const box = $("#statusBox");
          box.style.display = "grid";
          showKV(box, j.status);
          toast(`Status: ${j.status.status || "OK"}`);
          return resolve(true);
        }

        // 404 é esperado enquanto o consumidor ainda não processou
        if (attempt >= seconds) {
          stopPolling();
          setBadge("status", "Não apareceu em 10s (normal em labs com falha/rebalance). Tente de novo.", "err");
          toast("Status ainda não disponível");
          return resolve(false);
        }

        setBadge("status", `Aguardando status... (${attempt}/${seconds})`, "");
      } catch (e) {
        if (attempt >= seconds) {
          stopPolling();
          setBadge("status", `Falha ao consultar: ${e.message}`, "err");
          toast("Erro consultando status");
          return resolve(false);
        }
      }
    }, 1000);
  });
}

function render() {
  $("#app").innerHTML = `
    <div class="wrap">
      <div class="topbar">
        <div class="brand">
          <div class="logo" aria-hidden="true"></div>
          <div>
            <h1>Pedidos e Estoque</h1>
            <div class="subtitle">Tráfego real no Kafka (orders.v1 → order_status.v1)</div>
          </div>
        </div>

        <div class="chips">
          <div class="chip"><b>/orders</b> → orders-api:8081</div>
          <div class="chip"><b>/api</b> → status-api:8082</div>
        </div>
      </div>

      <div class="grid">
        <section class="card">
          <header class="card-h">
            <h2>Criar pedido</h2>
            <p>Gera um evento em <code>orders.v1</code> via HTTP.</p>
          </header>

          <div class="card-b">
            <div class="row">
              <div class="form two">
                <div>
                  <label>orderId (opcional)</label>
                  <input id="orderId" placeholder="ex.: o-123 (deixe vazio para aleatório)" />
                </div>
                <div>
                  <label>customerId (opcional)</label>
                  <input id="customerId" placeholder="ex.: c-42 (deixe vazio para aleatório)" />
                </div>
              </div>

              <div class="form">
                <div>
                  <label>total (opcional)</label>
                  <input id="total" placeholder="ex.: 99.90 (deixe vazio para aleatório)" />
                </div>
              </div>

              <div class="actions">
                <button class="btn primary" id="btnCreate">Criar pedido</button>
                <button class="btn" id="btnCopy" disabled>Copiar orderId</button>
              </div>

              <div id="createBadge" class="badge" style="display:none;">
                <span class="dot"></span><span id="createBadgeText">—</span>
              </div>

              <div id="createdBox" style="display:none;" class="kv"></div>
            </div>
          </div>
        </section>

        <section class="card">
          <header class="card-h">
            <h2>Consultar status</h2>
            <p>Busca o status por <code>orderId</code> (cache do status-api). Em labs, pode demorar por rebalance/failover.</p>
          </header>

          <div class="card-b">
            <div class="row">
              <div class="form two">
                <div>
                  <label>orderId</label>
                  <input id="oid" placeholder="cole aqui o orderId" />
                </div>
                <div style="display:flex; align-items:end; gap:10px; flex-wrap:wrap;">
                  <button class="btn good" id="btnStatus">Buscar 1x</button>
                  <button class="btn" id="btnWait">Aguardar 10s</button>
                  <button class="btn" id="btnPrefill">Usar último</button>
                </div>
              </div>

              <div id="statusBadge" class="badge" style="display:none;">
                <span class="dot"></span><span id="statusBadgeText">—</span>
              </div>

              <div id="statusBox" style="display:none;" class="kv"></div>
            </div>
          </div>
        </section>
      </div>

      <section class="card" style="margin-top:14px;">
        <header class="card-h">
          <h2>Ferramentas do LAB</h2>
          <p>Links úteis (Kafka UI entra aqui). Ajuste pelo <code>VITE_KAFKA_UI_URL</code> quando subir a UI.</p>
        </header>
        <div class="card-b">
          <div class="actions">
            <a class="btn" href="/orders-health" target="_blank" rel="noreferrer">Orders API /health</a>
            <a class="btn" href="/status-health" target="_blank" rel="noreferrer">Status API /health</a>
            <a class="btn primary" href="${import.meta.env.VITE_KAFKA_UI_URL || "#"}" target="_blank" rel="noreferrer" id="kuiLink">Kafka UI</a>
          </div>
        </div>
      </section>
    </div>

    <div id="toast" class="toast"></div>
  `;
}

async function createOrder() {
  const btn = $("#btnCreate");
  setBtnLoading(btn, true);

  try {
    const body = {};
    const orderId = $("#orderId").value.trim();
    const customerId = $("#customerId").value.trim();
    const total = $("#total").value.trim();

    if (orderId) body.orderId = orderId;
    if (customerId) body.customerId = customerId;
    if (total) body.total = Number(total);

    const r = await fetch(`/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

    const ev = j.event || {};
    lastOrderId = ev.orderId || "";
    $("#btnCopy").disabled = !lastOrderId;

    setBadge("create", "Pedido criado e enviado para orders.v1", "ok");

    const box = $("#createdBox");
    box.style.display = "grid";
    showKV(box, ev);

    $("#oid").value = lastOrderId;
    toast(`Pedido criado: ${lastOrderId}`);

    // ⭐ auto-retry: após criar, aguarda status até 10s
    if (lastOrderId) await pollStatus(lastOrderId, 10);
  } catch (e) {
    setBadge("create", `Falha ao criar pedido: ${e.message}`, "err");
    toast("Erro ao criar pedido");
  } finally {
    setBtnLoading(btn, false, "Criar pedido");
  }
}

async function getStatusOnce() {
  const btn = $("#btnStatus");
  setBtnLoading(btn, true);

  try {
    stopPolling();
    const id = $("#oid").value.trim();
    if (!id) {
      setBadge("status", "Informe um orderId para buscar", "err");
      return;
    }

    const { r, j } = await fetchStatusOnce(id);

    if (!r.ok) {
      if (r.status === 404) {
        setBadge("status", "Ainda não há status para esse orderId (tente Aguardar 10s)", "err");
        $("#statusBox").style.display = "none";
        return;
      }
      throw new Error(j?.error || `HTTP ${r.status}`);
    }

    setBadge("status", "Status encontrado em order_status.v1", "ok");
    const box = $("#statusBox");
    box.style.display = "grid";
    showKV(box, j.status || {});
    toast("Status encontrado");
  } catch (e) {
    setBadge("status", `Falha ao consultar: ${e.message}`, "err");
    toast("Erro ao consultar status");
  } finally {
    setBtnLoading(btn, false, "Buscar 1x");
  }
}

function wire() {
  $("#btnCreate").onclick = createOrder;
  $("#btnStatus").onclick = getStatusOnce;

  $("#btnWait").onclick = async () => {
    const id = $("#oid").value.trim();
    if (!id) return toast("Informe um orderId");
    await pollStatus(id, 10);
  };

  $("#btnPrefill").onclick = () => {
    if (!lastOrderId) return toast("Ainda não há pedido criado nesta sessão");
    $("#oid").value = lastOrderId;
    toast("Preenchido com o último orderId");
  };

  $("#btnCopy").onclick = async () => {
    if (!lastOrderId) return;
    try {
      await navigator.clipboard.writeText(lastOrderId);
      toast("orderId copiado!");
    } catch {
      toast(`Copie manualmente: ${lastOrderId}`);
    }
  };

  // Links de health via proxy do Vite (evita CORS e “localhost” confuso)
  // (config do proxy está no vite.config.js)
  const kui = $("#kuiLink");
  if (kui.getAttribute("href") === "#") {
    kui.classList.remove("primary");
    kui.onclick = (e) => {
      e.preventDefault();
      toast("Kafka UI (defina VITE_KAFKA_UI_URL)");
    };
  }
}

render();
wire();
