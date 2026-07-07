(() => {
  const $ = (id) => document.getElementById(id);
  let currentUser = null;
  let selectedPdf = null;
  let currentRecord = null;
  let currentData = null;

  const identity = window.netlifyIdentity;

  function showLogin() {
    $('loginScreen').classList.remove('hidden');
    $('shell').classList.add('hidden');
  }

  async function showPanel(user) {
    currentUser = user;
    $('userEmail').textContent = user?.email || '';
    $('loginScreen').classList.add('hidden');
    $('shell').classList.remove('hidden');
    await loadQuoteList();
  }

  identity.on('init', (user) => user ? showPanel(user) : showLogin());
  identity.on('login', (user) => { identity.close(); showPanel(user); });
  identity.on('logout', () => { currentUser = null; showLogin(); });
  identity.init();

  $('loginBtn').addEventListener('click', () => identity.open('login'));
  $('logoutBtn').addEventListener('click', () => identity.logout());

  async function authFetch(url, options = {}) {
    if (!currentUser) throw new Error('Tu sesión terminó. Vuelve a ingresar.');
    const token = await currentUser.jwt();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  }

  const dropZone = $('dropZone');
  $('pdfInput').addEventListener('change', (event) => setPdf(event.target.files?.[0]));
  ['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('drag'); }));
  dropZone.addEventListener('drop', (event) => setPdf(event.dataTransfer.files?.[0]));

  function setPdf(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setStatus('extractStatus', 'Selecciona un archivo PDF.', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setStatus('extractStatus', 'El PDF supera el límite de 4 MB de este MVP.', 'error');
      return;
    }
    selectedPdf = file;
    $('uploadName').textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB`;
    setStatus('extractStatus', 'PDF listo para analizar.', 'info');
  }

  $('extractBtn').addEventListener('click', async () => {
    if (!selectedPdf) return setStatus('extractStatus', 'Primero selecciona un PDF.', 'warn');
    try {
      busy(true, 'Leyendo la cotización con IA…');
      const dataBase64 = await fileToDataUrl(selectedPdf);
      const response = await authFetch('/api/parse-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedPdf.name, mimeType: selectedPdf.type || 'application/pdf', dataBase64 })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No fue posible analizar el PDF.');
      currentRecord = null;
      loadIntoForm(payload.data);
      setStatus('extractStatus', 'Datos extraídos. Revisa y corrige antes de publicar.', 'ok');
      markStep(2);
    } catch (error) {
      setStatus('extractStatus', error.message, 'error');
    } finally {
      busy(false);
    }
  });

  $('demoBtn').addEventListener('click', async () => {
    try {
      busy(true, 'Cargando el ejemplo MAPFRE…');
      const response = await fetch('/data/demo-vancho.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('No fue posible cargar el ejemplo.');
      currentRecord = null;
      loadIntoForm(await response.json());
      setStatus('extractStatus', 'Ejemplo MAPFRE cargado. Puedes editarlo, previsualizarlo y guardarlo.', 'ok');
      markStep(2);
    } catch (error) {
      setStatus('extractStatus', error.message, 'error');
    } finally {
      busy(false);
    }
  });

  $('newBtn').addEventListener('click', resetAll);
  $('refreshListBtn').addEventListener('click', loadQuoteList);
  $('addPremiumBtn').addEventListener('click', () => addPremiumRow({ year: nextRowYear('premiumRows'), age: null, premium: null }));
  $('addMilestoneBtn').addEventListener('click', () => addMilestoneRow({ year: nextRowYear('milestoneRows', 3), age: null, sumAssured: numValue('sumAssured'), annualPremium: null, rescue: null, paidUp: null }));
  $('fillPremiumsBtn').addEventListener('click', fillMissingPremiums);
  $('previewBtn').addEventListener('click', preview);
  $('saveDraftBtn').addEventListener('click', () => save('draft'));
  $('publishBtn').addEventListener('click', () => save('published'));
  $('copyUrlBtn').addEventListener('click', copyPublicUrl);
  $('restoreVersionBtn').addEventListener('click', restoreVersion);

  function loadIntoForm(inputData) {
    currentData = structuredClone(inputData);
    const d = currentData;
    $('quoteForm').classList.remove('hidden');
    $('prospectName').value = d.prospect?.name || '';
    $('prospectAge').value = valueOrBlank(d.prospect?.age);
    $('prospectSex').value = d.prospect?.sex || '';
    $('insurer').value = d.quote?.insurer || '';
    $('product').value = d.quote?.product || '';
    $('planType').value = d.quote?.planType || '';
    $('quoteNumber').value = d.quote?.quoteNumber || '';
    $('quoteDate').value = normalizeDateInput(d.quote?.quoteDate);
    setSelectValue($('currency'), d.quote?.currency || 'UDI');
    $('termYears').value = valueOrBlank(d.quote?.termYears);
    $('paymentTermYears').value = valueOrBlank(d.quote?.paymentTermYears);
    $('baseUnitValue').value = valueOrBlank(d.projection?.baseUnitValue);
    $('annualGrowthRate').value = Number(d.projection?.annualGrowthRate || 0) * 100;
    $('manualUnitRate').value = valueOrBlank(d.projection?.manualUnitRate);
    $('manualUnitLabel').value = d.projection?.manualUnitLabel || '';

    $('sumAssured').value = valueOrBlank(d.benefits?.sumAssured);
    $('waiverIncluded').checked = Boolean(d.benefits?.disabilityWaiver?.included);
    $('waiverTitle').value = d.benefits?.disabilityWaiver?.title || '';
    $('waiverExplanation').value = d.benefits?.disabilityWaiver?.explanation || '';
    $('disabilityIncluded').checked = Boolean(d.benefits?.disabilityPayment?.included);
    $('disabilityTitle').value = d.benefits?.disabilityPayment?.title || '';
    $('disabilityAmount').value = valueOrBlank(d.benefits?.disabilityPayment?.amount);
    $('disabilityExplanation').value = d.benefits?.disabilityPayment?.explanation || '';
    $('accidentIncluded').checked = Boolean(d.benefits?.accidentalDeathAdditional?.included);
    $('accidentTitle').value = d.benefits?.accidentalDeathAdditional?.title || '';
    $('accidentAmount').value = valueOrBlank(d.benefits?.accidentalDeathAdditional?.amount);
    $('accidentExplanation').value = d.benefits?.accidentalDeathAdditional?.explanation || '';

    $('firstYearAnnual').value = valueOrBlank(d.payments?.firstYearAnnual);
    $('firstReceipt').value = valueOrBlank(d.payments?.firstReceipt);
    $('regularReceipt').value = valueOrBlank(d.payments?.regularReceipt);
    $('regularReceiptCount').value = valueOrBlank(d.payments?.regularReceiptCount);
    $('fractionalLoadFactor').value = valueOrBlank(d.payments?.fractionalLoadFactor ?? 1);
    $('premiumRows').innerHTML = '';
    (d.payments?.annualPremiums || []).forEach(addPremiumRow);
    $('milestoneRows').innerHTML = '';
    (d.milestones || []).forEach(addMilestoneRow);

    $('advisorName').value = d.advisor?.name || 'Pepe Leyva';
    $('advisorSubtitle').value = d.advisor?.subtitle || 'Especialista en Planes de Vida';
    $('advisorWhatsapp').value = d.advisor?.whatsapp || '5588048778';
    $('advisorCta').value = d.advisor?.cta || 'Mándame WHA';
    $('slug').value = currentRecord?.slug || '';
    $('slug').disabled = Boolean(currentRecord?.slug);
    $('status').value = currentRecord?.status || 'draft';

    showExtractionFeedback(d.extraction || {});
    populateVersions(currentRecord?.versions || []);
    updatePublicUrl(currentRecord?.slug, currentRecord?.status);
    $('quoteForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function collectForm() {
    const previous = currentData || {};
    return {
      advisor: {
        name: $('advisorName').value.trim(),
        subtitle: $('advisorSubtitle').value.trim(),
        whatsapp: $('advisorWhatsapp').value.trim(),
        cta: $('advisorCta').value.trim()
      },
      prospect: {
        name: $('prospectName').value.trim(),
        age: numValue('prospectAge'),
        sex: $('prospectSex').value.trim(),
        smoker: previous.prospect?.smoker || ''
      },
      quote: {
        insurer: $('insurer').value.trim(),
        product: $('product').value.trim(),
        planType: $('planType').value.trim(),
        quoteNumber: $('quoteNumber').value.trim(),
        quoteDate: $('quoteDate').value || null,
        currency: $('currency').value,
        termYears: numValue('termYears'),
        paymentTermYears: numValue('paymentTermYears')
      },
      projection: {
        baseUnitValue: numValue('baseUnitValue'),
        annualGrowthRate: (numValue('annualGrowthRate') || 0) / 100,
        manualUnitLabel: $('manualUnitLabel').value.trim() || null,
        manualUnitRate: numValue('manualUnitRate')
      },
      benefits: {
        sumAssured: numValue('sumAssured'),
        disabilityWaiver: {
          included: $('waiverIncluded').checked,
          title: $('waiverTitle').value.trim(),
          explanation: $('waiverExplanation').value.trim()
        },
        disabilityPayment: {
          included: $('disabilityIncluded').checked,
          amount: numValue('disabilityAmount'),
          title: $('disabilityTitle').value.trim(),
          explanation: $('disabilityExplanation').value.trim()
        },
        accidentalDeathAdditional: {
          included: $('accidentIncluded').checked,
          amount: numValue('accidentAmount'),
          title: $('accidentTitle').value.trim(),
          explanation: $('accidentExplanation').value.trim()
        },
        otherCoverages: previous.benefits?.otherCoverages || []
      },
      payments: {
        firstYearAnnual: numValue('firstYearAnnual'),
        firstReceipt: numValue('firstReceipt'),
        regularReceipt: numValue('regularReceipt'),
        regularReceiptCount: numValue('regularReceiptCount'),
        fractionalLoadFactor: numValue('fractionalLoadFactor') || 1,
        annualPremiums: collectTable('premiumRows', ['year', 'age', 'premium'])
      },
      milestones: collectTable('milestoneRows', ['year', 'age', 'sumAssured', 'annualPremium', 'rescue', 'paidUp']),
      extraction: previous.extraction || { confidence: 0, warnings: [], sourcePages: [] }
    };
  }

  function addPremiumRow(item = {}) {
    const row = document.createElement('tr');
    row.innerHTML = `<td><input data-field="year" type="number" min="1" value="${safeAttr(item.year)}"></td><td><input data-field="age" type="number" value="${safeAttr(item.age)}"></td><td><input data-field="premium" type="number" step="0.01" value="${safeAttr(item.premium)}"></td><td><button type="button" class="btn btn-danger btn-sm">×</button></td>`;
    row.querySelector('button').addEventListener('click', () => row.remove());
    $('premiumRows').appendChild(row);
  }

  function addMilestoneRow(item = {}) {
    const row = document.createElement('tr');
    const fields = ['year', 'age', 'sumAssured', 'annualPremium', 'rescue', 'paidUp'];
    row.innerHTML = fields.map((field) => `<td><input data-field="${field}" type="number" step="0.01" value="${safeAttr(item[field])}"></td>`).join('') + '<td><button type="button" class="btn btn-danger btn-sm">×</button></td>';
    row.querySelector('button').addEventListener('click', () => row.remove());
    $('milestoneRows').appendChild(row);
  }

  function collectTable(tbodyId, fields) {
    return [...$(tbodyId).querySelectorAll('tr')].map((row) => {
      const item = {};
      fields.forEach((field) => {
        const value = row.querySelector(`[data-field="${field}"]`)?.value;
        item[field] = value === '' ? null : Number(value);
      });
      return item;
    }).filter((item) => Number(item.year) > 0).sort((a, b) => a.year - b.year);
  }

  function fillMissingPremiums() {
    const term = Math.max(1, numValue('paymentTermYears') || numValue('termYears') || 1);
    const existing = collectTable('premiumRows', ['year', 'age', 'premium']);
    const byYear = new Map(existing.map((item) => [item.year, item]));
    let lastPremium = numValue('firstYearAnnual') || numValue('regularReceipt') * 12 || null;
    const baseAge = numValue('prospectAge');
    $('premiumRows').innerHTML = '';
    for (let year = 1; year <= term; year += 1) {
      const found = byYear.get(year);
      if (found?.premium != null) lastPremium = found.premium;
      addPremiumRow({ year, age: found?.age ?? (baseAge != null ? baseAge + year - 1 : null), premium: found?.premium ?? lastPremium });
    }
  }

  function preview() {
    try {
      currentData = collectForm();
      validateMinimum(currentData);
      localStorage.setItem('quote-preview', JSON.stringify(currentData));
      markStep(3);
      window.open('/cotizacion/?preview=1', '_blank', 'noopener');
      $('saveHint').textContent = 'Vista previa generada. Corrige cualquier detalle antes de publicar.';
    } catch (error) {
      alert(error.message);
    }
  }

  async function save(status) {
    try {
      currentData = collectForm();
      validateMinimum(currentData);
      busy(true, status === 'published' ? 'Publicando la herramienta…' : 'Guardando el borrador…');
      const response = await authFetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingSlug: currentRecord?.slug || '',
          slug: $('slug').value.trim(),
          status,
          data: currentData
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No fue posible guardar.');
      currentRecord = payload.record;
      $('slug').value = currentRecord.slug;
      $('slug').disabled = true;
      $('status').value = currentRecord.status;
      updatePublicUrl(currentRecord.slug, currentRecord.status);
      populateVersions(currentRecord.versions || []);
      markStep(status === 'published' ? 4 : 3);
      $('saveHint').textContent = status === 'published' ? `Publicada · versión ${currentRecord.version}` : `Borrador guardado · versión ${currentRecord.version}`;
      await loadQuoteList();
      alert(status === 'published' ? 'La herramienta quedó publicada.' : 'El borrador quedó guardado.');
    } catch (error) {
      alert(error.message);
    } finally {
      busy(false);
    }
  }

  function validateMinimum(d) {
    const missing = [];
    if (!d.prospect.name) missing.push('nombre del prospecto');
    if (!d.quote.insurer) missing.push('aseguradora');
    if (!d.quote.product) missing.push('producto');
    if (!d.quote.termYears) missing.push('plazo');
    if (!d.benefits.sumAssured) missing.push('suma asegurada');
    if (!d.payments.firstReceipt) missing.push('primer recibo');
    if (missing.length) throw new Error(`Confirma: ${missing.join(', ')}.`);
  }

  async function loadQuoteList() {
    if (!currentUser) return;
    $('quoteList').innerHTML = '<div class="small muted">Cargando…</div>';
    try {
      const response = await authFetch('/api/quotes');
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No fue posible cargar.');
      if (!payload.items.length) {
        $('quoteList').innerHTML = '<div class="small muted">Todavía no hay cotizaciones guardadas.</div>';
        return;
      }
      $('quoteList').innerHTML = '';
      payload.items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'quote-item';
        card.innerHTML = `<strong>${escapeHtml(item.prospectName)}</strong><div class="small">${escapeHtml(item.insurer)} · ${escapeHtml(item.product)}</div><div class="quote-meta"><span class="badge ${item.status}">${item.status === 'published' ? 'Publicada' : 'Borrador'}</span> · v${item.version} · ${formatDate(item.updatedAt)}</div><button class="btn btn-soft btn-sm" style="margin-top:9px">Editar</button>`;
        card.querySelector('button').addEventListener('click', () => loadRecord(item.slug));
        $('quoteList').appendChild(card);
      });
    } catch (error) {
      $('quoteList').innerHTML = `<div class="status error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadRecord(slug) {
    try {
      busy(true, 'Abriendo la cotización…');
      const response = await authFetch(`/api/quotes?slug=${encodeURIComponent(slug)}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No fue posible abrirla.');
      currentRecord = payload.record;
      loadIntoForm(currentRecord.data);
      markStep(currentRecord.status === 'published' ? 4 : 2);
    } catch (error) {
      alert(error.message);
    } finally {
      busy(false);
    }
  }

  function populateVersions(versions) {
    const select = $('versionSelect');
    select.innerHTML = '<option value="">Selecciona una versión</option>';
    versions.slice().reverse().forEach((version, reverseIndex) => {
      const originalIndex = versions.length - 1 - reverseIndex;
      const option = document.createElement('option');
      option.value = String(originalIndex);
      option.textContent = `v${version.version} · ${formatDate(version.savedAt)} · ${version.status}`;
      select.appendChild(option);
    });
    $('restoreVersionBtn').disabled = !versions.length;
  }

  function restoreVersion() {
    const index = Number($('versionSelect').value);
    if (!currentRecord || !Number.isInteger(index) || !currentRecord.versions?.[index]) return;
    const version = currentRecord.versions[index];
    if (!confirm(`¿Cargar los datos de la versión ${version.version}? Después podrás guardarlos como una nueva versión.`)) return;
    currentData = structuredClone(version.data);
    loadIntoForm(currentData);
    $('saveHint').textContent = `Versión ${version.version} restaurada en el formulario. Aún no está guardada.`;
  }

  function updatePublicUrl(slug, status) {
    if (!slug) {
      $('publicUrlBox').classList.add('hidden');
      return;
    }
    const url = `${location.origin}/cotizacion/${slug}`;
    $('publicUrl').value = url;
    $('openPublicBtn').href = url;
    $('openPublicBtn').textContent = status === 'published' ? 'Abrir' : 'Abrir al publicar';
    $('openPublicBtn').style.pointerEvents = status === 'published' ? 'auto' : 'none';
    $('openPublicBtn').style.opacity = status === 'published' ? '1' : '.55';
    $('publicUrlBox').classList.remove('hidden');
  }

  async function copyPublicUrl() {
    await navigator.clipboard.writeText($('publicUrl').value);
    $('copyUrlBtn').textContent = 'Copiado';
    setTimeout(() => $('copyUrlBtn').textContent = 'Copiar', 1400);
  }

  function showExtractionFeedback(extraction) {
    const confidence = Math.round(Number(extraction.confidence || 0) * 100);
    $('confidenceBox').innerHTML = `<span>Confianza ${confidence}%</span><span class="bar"><span style="width:${confidence}%"></span></span>`;
    const warnings = extraction.warnings || [];
    $('warningBox').innerHTML = warnings.length
      ? `<div class="status warn"><strong>Revisa estos puntos:</strong><ul style="margin:8px 0 0;padding-left:18px">${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
      : '<div class="status ok">No se detectaron advertencias. Aun así, confirma cada cantidad.</div>';
  }

  function resetAll() {
    selectedPdf = null;
    currentRecord = null;
    currentData = null;
    $('pdfInput').value = '';
    $('uploadName').textContent = '';
    $('quoteForm').classList.add('hidden');
    $('extractStatus').innerHTML = '';
    $('publicUrlBox').classList.add('hidden');
    $('versionSelect').innerHTML = '<option value="">Sin versiones anteriores</option>';
    $('slug').disabled = false;
    markStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function markStep(number) {
    for (let i = 1; i <= 4; i += 1) {
      const step = $(`step${i}`);
      step.classList.toggle('active', i === number);
      step.classList.toggle('done', i < number);
    }
  }

  function setStatus(id, message, type) {
    $(id).innerHTML = `<div class="status ${type}">${escapeHtml(message)}</div>`;
  }

  function busy(active, text = 'Procesando…') {
    $('busyText').textContent = text;
    $('busyOverlay').classList.toggle('hidden', !active);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }

  function nextRowYear(tbodyId, increment = 1) {
    const years = [...$(tbodyId).querySelectorAll('[data-field="year"]')].map((input) => Number(input.value || 0));
    return years.length ? Math.max(...years) + increment : increment;
  }

  function numValue(id) {
    const value = $(id).value;
    return value === '' ? null : Number(value);
  }

  function valueOrBlank(value) { return value == null ? '' : value; }
  function safeAttr(value) { return value == null ? '' : String(value).replace(/"/g, '&quot;'); }
  function normalizeDateInput(value) {
    if (!value) return '';
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }
  function setSelectValue(select, value) {
    const normalized = String(value || '').toUpperCase();
    if (![...select.options].some((option) => option.value === normalized)) {
      const option = new Option(normalized, normalized);
      select.add(option);
    }
    select.value = normalized;
  }
  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }
})();
