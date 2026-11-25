/* ==========================================================
   ECOFFEE · Controle de Avaliadores
   JavaScript puro (Vanilla JS), sem dependências externas.
   ========================================================== */

(function () {
  'use strict';

  /* ---------- Constantes e estado ---------- */
  const STORAGE_KEY = 'ecoffee_avaliadores_v1';

  // Cada registro: { id, date: 'AAAA-MM-DD', createdAt: 'ISO' }
  let records = [];

  // Datas que estão com a lista de registros expandida
  const expandedDates = new Set();

  // Controle de animação do último item adicionado
  let lastAddedDate = null;

  /* ---------- Referências aos elementos ---------- */
  const $ = (id) => document.getElementById(id);

  const totalNumber = $('totalNumber');
  const dateInput = $('dateInput');
  const addBtn = $('addBtn');
  const undoBtn = $('undoBtn');
  const resetBtn = $('resetBtn');
  const daysList = $('daysList');
  const emptyState = $('emptyState');

  const modal = $('modal');
  const modalTitle = $('modalTitle');
  const modalMessage = $('modalMessage');
  const modalCancel = $('modalCancel');
  const modalConfirm = $('modalConfirm');

  const toast = $('toast');

  /* ---------- Armazenamento (localStorage) ---------- */
  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Mantém apenas registros válidos
      return parsed.filter(
        (r) => r && typeof r.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
      );
    } catch (e) {
      return [];
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      // Safari em modo privado pode bloquear o armazenamento
      showToast('Não foi possível salvar no navegador.');
    }
  }

  /* ---------- Utilidades ---------- */

  // Data de hoje no fuso local (formato AAAA-MM-DD)
  function todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  // 'AAAA-MM-DD' → 'DD/MM/AAAA' (sem usar Date, evita erros de fuso)
  function formatDate(iso) {
    const [y, m, d] = iso.split('-');
    return d + '/' + m + '/' + y;
  }

  // Hora local do registro (HH:MM)
  function formatTime(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function pluralize(n) {
    return n + (n === 1 ? ' avaliador' : ' avaliadores');
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Reinicia uma animação CSS no elemento
  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth; // força reflow
    el.classList.add('bump');
  }

  /* ---------- Aviso rápido (toast) ---------- */
  let toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  /* ---------- Modal de confirmação ---------- */
  // Retorna uma Promise: true se confirmou, false se cancelou
  function confirmDialog(title, message, confirmText) {
    return new Promise((resolve) => {
      modalTitle.textContent = title;
      modalMessage.textContent = message;
      modalConfirm.textContent = confirmText || 'Confirmar';
      modal.hidden = false;

      function close(result) {
        modal.hidden = true;
        modalConfirm.removeEventListener('click', onConfirm);
        modalCancel.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        resolve(result);
      }
      function onConfirm() { close(true); }
      function onCancel() { close(false); }
      function onBackdrop(e) { if (e.target === modal) close(false); }

      modalConfirm.addEventListener('click', onConfirm);
      modalCancel.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
    });
  }

  /* ---------- Ações ---------- */

  // Adiciona exatamente 1 avaliador à data selecionada
  function addEvaluator() {
    const date = dateInput.value;
    if (!date) {
      showToast('Selecione uma data primeiro.');
      return;
    }

    records.push({
      id: generateId(),
      date: date,
      createdAt: new Date().toISOString(),
    });

    lastAddedDate = date;
    saveRecords();
    render();
    showToast('Avaliador adicionado ✓ (' + formatDate(date) + ')');
  }

  // Exclui um registro individual (com confirmação)
  async function deleteRecord(id) {
    const rec = records.find((r) => r.id === id);
    if (!rec) return;

    const ok = await confirmDialog(
      'Excluir registro?',
      'Este avaliador do dia ' + formatDate(rec.date) + ' será removido.',
      'Excluir'
    );
    if (!ok) return;

    records = records.filter((r) => r.id !== id);
    saveRecords();
    render();
    showToast('Registro excluído.');
  }

  // Remove o último registro da data selecionada (com confirmação)
  async function undoLast() {
    const date = dateInput.value;
    if (!date) {
      showToast('Selecione uma data primeiro.');
      return;
    }

    const ofDay = records.filter((r) => r.date === date);
    if (ofDay.length === 0) {
      showToast('Não há registros em ' + formatDate(date) + '.');
      return;
    }

    const last = ofDay[ofDay.length - 1];
    const ok = await confirmDialog(
      'Desfazer último?',
      'O último avaliador registrado em ' + formatDate(date) + ' será removido.',
      'Desfazer'
    );
    if (!ok) return;

    records = records.filter((r) => r.id !== last.id);
    saveRecords();
    render();
    showToast('Último registro removido.');
  }

  // Zera tudo (com confirmação)
  async function resetAll() {
    if (records.length === 0) {
      showToast('Não há registros para zerar.');
      return;
    }

    const ok = await confirmDialog(
      'Zerar todos os registros?',
      'Todos os ' + records.length + ' avaliadores de todos os dias serão apagados. Esta ação não pode ser desfeita.',
      'Zerar tudo'
    );
    if (!ok) return;

    records = [];
    expandedDates.clear();
    saveRecords();
    render();
    showToast('Todos os registros foram zerados.');
  }

  /* ---------- Renderização ---------- */

  // Agrupa registros por data e ordena cronologicamente
  function groupByDate() {
    const groups = {};
    records.forEach((r) => {
      if (!groups[r.date]) groups[r.date] = [];
      groups[r.date].push(r);
    });
    return Object.keys(groups)
      .sort()
      .map((date) => ({ date: date, items: groups[date] }));
  }

  function render() {
    // Total geral
    const previousTotal = parseInt(totalNumber.textContent, 10) || 0;
    totalNumber.textContent = records.length;
    if (records.length !== previousTotal) bump(totalNumber);

    // Histórico
    const groups = groupByDate();
    daysList.innerHTML = '';
    emptyState.hidden = groups.length > 0;
    emptyState.style.display = groups.length > 0 ? 'none' : '';

    groups.forEach((group) => {
      daysList.appendChild(buildDayCard(group));
    });

    lastAddedDate = null;
  }

  function buildDayCard(group) {
    const isOpen = expandedDates.has(group.date);

    const card = document.createElement('article');
    card.className = 'day-card' + (isOpen ? ' open' : '');
    // Evita reanimar o card inteiro quando só o contador mudou
    if (!(lastAddedDate === group.date)) card.style.animation = 'none';

    // Cabeçalho (toque para ver/ocultar registros individuais)
    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'day-header';
    header.setAttribute('aria-expanded', String(isOpen));

    const dateEl = document.createElement('span');
    dateEl.className = 'day-date';
    dateEl.textContent = formatDate(group.date);

    const countWrap = document.createElement('span');
    countWrap.className = 'day-count-wrap';

    const countEl = document.createElement('span');
    countEl.className = 'day-count';
    countEl.textContent = pluralize(group.items.length);
    if (lastAddedDate === group.date) {
      // Anima o contador do dia que acabou de receber um registro
      requestAnimationFrame(() => bump(countEl));
    }

    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = '▼';

    countWrap.appendChild(countEl);
    countWrap.appendChild(chevron);
    header.appendChild(dateEl);
    header.appendChild(countWrap);

    header.addEventListener('click', () => {
      const nowOpen = !card.classList.contains('open');
      card.classList.toggle('open', nowOpen);
      header.setAttribute('aria-expanded', String(nowOpen));
      if (nowOpen) expandedDates.add(group.date);
      else expandedDates.delete(group.date);
    });

    // Lista de registros individuais
    const list = document.createElement('div');
    list.className = 'records';

    group.items.forEach((rec, index) => {
      const row = document.createElement('div');
      row.className = 'record-row';

      const info = document.createElement('span');
      info.className = 'record-info';
      info.textContent = 'Avaliador ' + (index + 1);

      const time = document.createElement('span');
      time.className = 'record-time';
      time.textContent = formatTime(rec.createdAt);
      info.appendChild(time);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'delete-btn';
      del.textContent = 'Excluir';
      del.setAttribute('aria-label', 'Excluir avaliador ' + (index + 1) + ' de ' + formatDate(group.date));
      del.addEventListener('click', () => deleteRecord(rec.id));

      row.appendChild(info);
      row.appendChild(del);
      list.appendChild(row);
    });

    card.appendChild(header);
    card.appendChild(list);
    return card;
  }

  /* ---------- Inicialização ---------- */
  function init() {
    records = loadRecords();
    dateInput.value = todayISO(); // data de hoje como padrão (pode ser alterada)

    addBtn.addEventListener('click', addEvaluator);
    undoBtn.addEventListener('click', undoLast);
    resetBtn.addEventListener('click', resetAll);

    render();
  }

  init();
})();
