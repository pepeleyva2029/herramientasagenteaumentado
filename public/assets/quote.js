(() => {
  const $ = (id) => document.getElementById(id);
  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const mxn2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
  const unitFmt = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const dateFmt = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  let data;
  let unitRate = 1;
  let unitSource = '';
  let unitOfficial = false;

  function parseSlug() {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts[0] === 'cotizacion' && parts[1] ? decodeURIComponent(parts[1]) : new URLSearchParams(location.search).get('slug');
  }

  async function loadData() {
    const params = new URLSearchParams(location.search);
    if (params.get('preview') === '1') {
      const stored = localStorage.getItem('quote-preview');
      if (!stored) throw new Error('No hay una vista previa disponible. Regresa al panel y vuelve a generarla.');
      $('previewRibbon').classList.remove('hidden');
      return JSON.parse(stored);
    }
    if (params.get('demo') === 'vancho') {
      const response = await fetch('/data/demo-vancho.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('No fue posible abrir la demostración.');
      return response.json();
    }
    const slug = parseSlug();
    if (!slug) throw new Error('Falta la dirección de esta cotización.');
    const response = await fetch(`/api/public-quote?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'No fue posible abrir la cotización.');
    $('footerMeta').textContent = `Cotización ${slug} · versión ${payload.version} · actualizada ${formatDate(payload.updatedAt)}`;
    return payload.data;
  }

  async function resolveUnitRate() {
    const currency = String(data.quote?.currency || 'UDI').toUpperCase();
    if (currency === 'MXN') {
      unitRate = 1;
      unitSource = 'Valores expresados directamente en pesos';
      unitOfficial = true;
      return;
    }
    if (currency === 'UDI') {
      const fallback = Number(data.projection?.baseUnitValue || 0);
      try {
        const response = await fetch(`/api/udi?fallback=${encodeURIComponent(fallback || '')}`, { cache: 'no-store' });
        const payload = await response.json();
        if (payload.value) {
          unitRate = Number(payload.value);
          unitSource = [payload.source, payload.date].filter(Boolean).join(' · ');
          unitOfficial = Boolean(payload.official);
          return;
        }
      } catch (_) {}
      unitRate = fallback || 1;
      unitSource = fallback ? 'Valor capturado en la cotización' : 'Valor no disponible';
      unitOfficial = false;
      return;
    }
    unitRate = Number(data.projection?.manualUnitRate || data.projection?.baseUnitValue || 1);
    unitSource = data.projection?.manualUnitLabel || 'Tipo de cambio capturado manualmente';
    unitOfficial = false;
  }

  function growthRate() {
    const rate = Number(data.projection?.annualGrowthRate || 0);
    return Number.isFinite(rate) ? rate : 0;
  }

  function rateAtMonth(month) {
    const currency = String(data.quote?.currency || '').toUpperCase();
    if (currency === 'MXN') return 1;
    return unitRate * Math.pow(1 + growthRate(), month / 12);
  }

  function rateAtYear(year) {
    return rateAtMonth(year * 12);
  }

  function termYears() {
    return Math.max(1, Number(data.quote?.termYears || 1));
  }

  function paymentTermYears() {
    return Math.max(1, Number(data.quote?.paymentTermYears || termYears()));
  }

  function annualPremiumForYear(year) {
    const row = (data.payments?.annualPremiums || []).find((item) => Number(item.year) === Number(year));
    if (row?.premium != null) return Number(row.premium);
    if (year === 1 && data.payments?.firstYearAnnual != null) return Number(data.payments.firstYearAnnual);
    return null;
  }

  function receiptUnitsForMonth(month) {
    const year = Math.floor(month / 12) + 1;
    if (year > paymentTermYears()) return 0;
    if (month === 0 && data.payments?.firstReceipt != null) return Number(data.payments.firstReceipt);
    if (year === 1 && data.payments?.regularReceipt != null) return Number(data.payments.regularReceipt);
    const annual = annualPremiumForYear(year);
    if (annual != null) return annual * Number(data.payments?.fractionalLoadFactor || 1) / 12;
    return Number(data.payments?.regularReceipt || 0);
  }

  function formatUnit(value) {
    const currency = String(data.quote?.currency || 'UDI').toUpperCase();
    if (value == null || !Number.isFinite(Number(value))) return '—';
    if (currency === 'MXN') return mxn.format(Number(value));
    return `${num.format(Number(value))} ${currency}`;
  }

  function equivalent(value, atRate = unitRate) {
    if (value == null || !Number.isFinite(Number(value))) return null;
    return Number(value) * Number(atRate || 1);
  }

  function hydrateText() {
    const advisor = data.advisor || {};
    const quote = data.quote || {};
    const prospect = data.prospect || {};
    const currency = String(quote.currency || 'UDI').toUpperCase();
    const sumAssured = Number(data.benefits?.sumAssured || 0);
    const years = termYears();
    const firstReceipt = Number(data.payments?.firstReceipt || 0);
    const regularReceipt = Number(data.payments?.regularReceipt || 0);
    const maturity = equivalent(sumAssured, rateAtYear(years));

    document.title = `${prospect.name ? `${prospect.name} · ` : ''}${quote.product || 'Tu cotización'} | ${advisor.name || 'Pepe Leyva'}`;
    $('brandText').textContent = `${advisor.name || 'Pepe Leyva'} · ${advisor.subtitle || 'Especialista en Planes de Vida'}`;
    $('quotePill').textContent = `Cotización personalizada${quote.quoteDate ? ` · ${formatDate(quote.quoteDate)}` : ''}`;
    $('heroEyebrow').textContent = [quote.insurer, quote.product || quote.planType, `${years} años`].filter(Boolean).join(' · ');
    $('prospectGreeting').textContent = prospect.name ? `Preparado especialmente para ${prospect.name}` : '';
    $('heroProjectionNote').textContent = currency === 'UDI'
      ? `● Valor oficial actual de la UDI y proyección anual estimada de ${(growthRate() * 100).toFixed(1)}%`
      : `● Proyección anual estimada de ${(growthRate() * 100).toFixed(1)}%`;
    $('heroSumAssured').textContent = formatUnit(sumAssured);
    $('heroSaPesos').textContent = sumAssured ? mxn.format(equivalent(sumAssured)) : '—';
    $('heroTerm').textContent = `${years} años`;
    $('heroAge').textContent = prospect.age != null ? `${num.format(prospect.age)} años` : 'No indicada';
    $('heroCurrency').textContent = currency;
    $('heroEquivalentLabel').textContent = currency === 'MXN' ? 'Capital contratado en moneda nacional.' : 'Equivalente estimado en moneda nacional al valor actual.';

    $('firstReceiptUnit').textContent = formatUnit(firstReceipt);
    $('firstReceiptNow').textContent = firstReceipt ? `${mxn2.format(equivalent(firstReceipt))} al valor actual` : 'No indicado';
    $('regularReceiptUnit').textContent = formatUnit(regularReceipt);
    $('regularReceiptNow').textContent = regularReceipt ? `${mxn2.format(equivalent(regularReceipt))} al valor actual` : 'No indicado';
    $('maturityLabel').textContent = `Al finalizar ${years} años`;
    $('maturityUnit').textContent = formatUnit(sumAssured);
    $('maturityEstimate').textContent = maturity ? `Proyección: ${mxn.format(maturity)}` : 'No disponible';

    const initialPayment = equivalent(firstReceipt);
    const initialProtection = equivalent(sumAssured);
    const ratio = initialPayment > 0 ? initialProtection / initialPayment : 0;
    $('impactFirstPayment').textContent = initialPayment ? mxn.format(initialPayment) : '—';
    $('impactInitialProtection').textContent = initialProtection ? mxn.format(initialProtection) : '—';
    $('impactUnitNote').textContent = `Equivalente de ${formatUnit(sumAssured)} al valor actual.`;
    $('impactRatio').textContent = ratio ? `≈ ${Math.round(ratio)} veces tu primer recibo` : 'Protección desde el inicio';
    $('chartTermLabel').textContent = `Proyección a ${years} años`;

    hydrateUnitSection(currency);
    hydrateBenefits(sumAssured, currency);
    hydrateComparison(sumAssured);
    hydrateMilestones(sumAssured);

    $('finalCopy').textContent = `Si la póliza permanece vigente y se cumplen las condiciones, al concluir ${years} años el capital principal proyectado sería:`;
    $('finalCapital').textContent = maturity ? mxn.format(maturity) : '—';
    $('finalUnitAmount').textContent = formatUnit(sumAssured);
    $('finalUdi').textContent = currency === 'MXN' ? 'No aplica' : `${mxn2.format(rateAtYear(years))} por ${currency}`;

    $('advisorName').textContent = advisor.name || 'Pepe Leyva';
    $('advisorSubtitle').textContent = advisor.subtitle || 'Especialista en Planes de Vida';
    const phone = String(advisor.whatsapp || '5588048778').replace(/\D/g, '');
    const fullPhone = phone.startsWith('52') ? phone : `52${phone}`;
    const message = encodeURIComponent(`Hola ${advisor.name || 'Pepe'}, tengo una duda sobre la cotización ${quote.product || ''}.`);
    const wa = `https://wa.me/${fullPhone}?text=${message}`;
    $('whatsappCta').href = wa;
    $('stickyWhatsapp').href = wa;
    $('whatsappCta').textContent = advisor.cta || 'Mándame WHA';
    $('stickyWhatsapp').textContent = advisor.cta || 'Mándame WHA';

    renderProtectionChart(sumAssured, firstReceipt);
    setupSlider();
  }

  function hydrateUnitSection(currency) {
    if (currency === 'UDI') {
      $('unitTitle').textContent = 'La UDI, explicada sin complicaciones';
      $('unitExplanation').innerHTML = '<strong>Una UDI es una unidad de valor que se ajusta con la inflación.</strong> Por eso, aunque la cantidad en UDI no cambie, su equivalente en pesos puede aumentar.';
      $('currentUnitLabel').textContent = 'Valor actual de la UDI';
      $('currentUdi').textContent = `${mxn2.format(unitRate)} / UDI`;
      $('sliderUnitLabel').textContent = 'Valor proyectado de la UDI';
      $('unitBadge').textContent = unitOfficial ? 'Fuente oficial' : 'Valor de respaldo';
    } else if (currency === 'MXN') {
      $('unitTitle').textContent = 'Valores expresados en pesos';
      $('unitExplanation').innerHTML = '<strong>Esta cotización ya está expresada en moneda nacional.</strong> No es necesario convertirla desde otra unidad.';
      $('currentUnitLabel').textContent = 'Factor de conversión';
      $('currentUdi').textContent = '$1.00 / MXN';
      $('sliderUnitLabel').textContent = 'Factor de conversión';
      $('unitBadge').textContent = 'Sin conversión';
    } else {
      $('unitTitle').textContent = `Conversión de ${currency} a pesos`;
      $('unitExplanation').innerHTML = `<strong>Las cantidades están expresadas en ${currency}.</strong> La equivalencia usa el tipo de cambio configurado en la cotización.`;
      $('currentUnitLabel').textContent = `Valor actual de ${currency}`;
      $('currentUdi').textContent = `${mxn2.format(unitRate)} / ${currency}`;
      $('sliderUnitLabel').textContent = `Valor proyectado de ${currency}`;
      $('unitBadge').textContent = 'Tipo de cambio configurado';
    }
    $('currentUdiDate').textContent = unitSource || 'Sin fuente disponible';
    $('officialIndicator').innerHTML = `<span class="pulse"></span> ${unitOfficial ? 'Dato oficial o moneda nacional' : 'Revisa este valor antes de publicar'}`;
    $('formulaText').textContent = growthRate() > 0
      ? `Tomamos el valor actual y aplicamos un crecimiento anual estimado de ${(growthRate() * 100).toFixed(1)}%, distribuido mes a mes.`
      : 'Mantenemos constante el valor actual durante la proyección.';
  }

  function hydrateBenefits(sumAssured, currency) {
    const waiver = data.benefits?.disabilityWaiver || {};
    $('waiverCard').classList.toggle('hidden-card', !waiver.included);
    $('waiverTitle').textContent = waiver.title || 'Exención de primas por invalidez';
    $('waiverText').textContent = waiver.explanation || '';

    const disability = data.benefits?.disabilityPayment || {};
    $('disabilityCard').classList.toggle('hidden-card', !disability.included);
    $('disabilityTitle').textContent = disability.title || 'Pago por invalidez';
    $('disabilityText').textContent = disability.explanation || '';
    $('disabilityUnit').textContent = formatUnit(disability.amount);
    $('disabilityNow').textContent = disability.amount != null ? `Equivalente actual: ${mxn.format(equivalent(disability.amount))}` : '';

    const accident = data.benefits?.accidentalDeathAdditional || {};
    $('accidentCard').classList.toggle('hidden', !accident.included);
    $('accidentTitle').textContent = accident.title || 'Beneficio adicional por muerte accidental';
    const total = Number(sumAssured || 0) + Number(accident.amount || 0);
    $('accidentText').textContent = `${accident.explanation || ''}${accident.amount != null ? ` Total potencial: ${formatUnit(total)}.` : ''}`;
    $('doubleNow').textContent = total ? `Equivalente actual: ${mxn.format(equivalent(total))}` : '';

    const extras = data.benefits?.otherCoverages || [];
    $('otherCoverages').innerHTML = extras.map((item) => `
      <article class="benefit">
        <div class="icon" aria-hidden="true">+</div>
        <h3>${escapeHtml(item.name || 'Cobertura adicional')}</h3>
        <p>${escapeHtml(item.description || '')}</p>
        ${item.amount != null ? `<div class="benefit-amount">${escapeHtml(formatUnit(item.amount))}</div><div class="mini gold-money">Equivalente actual: ${escapeHtml(mxn.format(equivalent(item.amount)))}</div>` : ''}
      </article>`).join('');
  }

  function hydrateComparison(sumAssured) {
    const months = paymentTermYears() * 12;
    let total = 0;
    for (let month = 0; month < months; month += 1) {
      total += receiptUnitsForMonth(month) * rateAtMonth(month);
    }
    const received = equivalent(sumAssured, rateAtYear(termYears()));
    $('comparisonContributed').textContent = total ? mxn.format(total) : 'No disponible';
    $('comparisonReceived').textContent = received ? mxn.format(received) : 'No disponible';
    if (total > 0 && received > 0) {
      const percentage = received / total * 100;
      const difference = percentage - 100;
      $('comparisonPercent').textContent = `El capital equivale a ${percentage.toFixed(1)}% de lo aportado`;
      $('comparisonGain').textContent = difference >= 0
        ? `${difference.toFixed(1)}% más en términos nominales proyectados.`
        : `${Math.abs(difference).toFixed(1)}% menos en términos nominales; recuerda que el plan también incluye protección durante el plazo.`;
    } else {
      $('comparisonPercent').textContent = 'Faltan datos para calcular la comparación';
      $('comparisonGain').textContent = 'Confirma las primas y el capital final.';
    }
  }

  function hydrateMilestones(defaultSumAssured) {
    const milestones = Array.isArray(data.milestones) ? data.milestones : [];
    if (!milestones.length) {
      $('milestones').innerHTML = '<div class="empty-state" style="grid-column:1/-1">La cotización no incluye valores por año o todavía no se han confirmado.</div>';
      return;
    }
    $('milestones').innerHTML = milestones.map((item) => {
      const year = Number(item.year || 0);
      const rate = rateAtYear(year);
      const sum = Number(item.sumAssured ?? defaultSumAssured ?? 0);
      return `<article class="mile">
        <div class="mile-year">Año ${year}${item.age != null ? ` · Edad ${num.format(item.age)}` : ''}</div>
        <div class="mile-main">${sum ? mxn.format(equivalent(sum, rate)) : '—'}</div>
        <div class="mini">Protección proyectada</div>
        <div class="mile-row"><span>Valor unidad</span><strong>${mxn2.format(rate)}</strong></div>
        <div class="mile-row"><span>Prima anual</span><strong>${formatUnit(item.annualPremium)}</strong></div>
        <div class="mile-row"><span>Rescate</span><strong>${item.rescue != null ? mxn.format(equivalent(item.rescue, rate)) : '—'}</strong></div>
        <div class="mile-row"><span>Seguro saldado</span><strong>${item.paidUp != null ? mxn.format(equivalent(item.paidUp, rate)) : '—'}</strong></div>
      </article>`;
    }).join('');
  }

  function setupSlider() {
    const slider = $('monthSlider');
    const max = Math.max(0, termYears() * 12 - 1);
    slider.max = String(max);
    slider.value = '0';
    $('sliderHelp').textContent = `Desliza para ver cualquier mes de los ${termYears()} años.`;
    const update = () => {
      const month = Number(slider.value);
      const year = Math.floor(month / 12) + 1;
      const rate = rateAtMonth(month);
      const receipt = receiptUnitsForMonth(month);
      $('selectedMonthLabel').textContent = `Mes ${month + 1} · Año ${year}`;
      $('sliderUdi').textContent = String(data.quote?.currency || '').toUpperCase() === 'MXN' ? '$1.00' : `${mxn2.format(rate)} / ${String(data.quote?.currency || 'UDI').toUpperCase()}`;
      $('sliderPayment').textContent = receipt ? mxn2.format(receipt * rate) : '$0.00';
      $('sliderPaymentUdi').textContent = receipt ? formatUnit(receipt) : 'Sin pago programado';
    };
    slider.addEventListener('input', update);
    update();
  }

  function renderProtectionChart(sumAssured, firstReceipt) {
    const years = termYears();
    const initialPayment = equivalent(firstReceipt);
    const dataPoints = Array.from({ length: years + 1 }, (_, year) => ({ year, value: equivalent(sumAssured, rateAtYear(year)) || 0 }));
    const maximum = Math.max(...dataPoints.map((item) => item.value), initialPayment || 0, 1);
    const roundUnit = maximum > 5000000 ? 1000000 : maximum > 1000000 ? 500000 : maximum > 250000 ? 100000 : 50000;
    const maxY = Math.ceil(maximum / roundUnit) * roundUnit;
    const width = 900;
    const height = 380;
    const pad = { left: 82, right: 28, top: 58, bottom: 68 };
    const x = (year) => pad.left + (year / years) * (width - pad.left - pad.right);
    const y = (value) => height - pad.bottom - (value / maxY) * (height - pad.top - pad.bottom);
    const points = dataPoints.map((item) => `${x(item.year).toFixed(1)},${y(item.value).toFixed(1)}`).join(' ');
    const area = `${pad.left},${height - pad.bottom} ${points} ${x(years)},${height - pad.bottom}`;
    const yTicks = Array.from({ length: 5 }, (_, index) => maxY * index / 4);
    const step = years <= 6 ? 1 : years <= 12 ? 3 : 3;
    const xTicks = [];
    for (let year = 0; year <= years; year += step) xTicks.push(year);
    if (!xTicks.includes(years)) xTicks.push(years);
    const grid = yTicks.map((value) => `<line x1="${pad.left}" y1="${y(value)}" x2="${width - pad.right}" y2="${y(value)}" stroke="rgba(255,255,255,.13)"/><text x="${pad.left - 12}" y="${y(value) + 4}" text-anchor="end" fill="#b9c8d7" font-size="13">${value === 0 ? '$0' : compactMoney(value)}</text>`).join('');
    const labels = xTicks.map((value) => `<text x="${x(value)}" y="${height - 20}" text-anchor="middle" fill="#b9c8d7" font-size="13">${value === 0 ? 'Inicio' : `Año ${value}`}</text>`).join('');
    const dots = xTicks.map((value) => {
      const item = dataPoints[value];
      return `<circle cx="${x(value)}" cy="${y(item.value)}" r="5" fill="#D4AF37" stroke="#fff" stroke-width="2"><title>Año ${value}: ${mxn.format(item.value)}</title></circle>`;
    }).join('');
    const initialProtection = dataPoints[0]?.value || 0;
    const finalProtection = dataPoints[dataPoints.length - 1]?.value || 0;
    const ratio = initialPayment > 0 ? initialProtection / initialPayment : 0;
    const paymentX = x(Math.min(0.6, years / 5));
    const paymentY = Math.max(y(initialPayment || 0), height - pad.bottom - 2);
    $('protectionChart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="La protección comienza en ${mxn.format(initialProtection)} frente a un pago inicial de ${mxn.format(initialPayment || 0)}">
      <defs>
        <linearGradient id="protectArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#D4AF37" stop-opacity=".42"/><stop offset="100%" stop-color="#D4AF37" stop-opacity=".03"/></linearGradient>
        <filter id="paymentGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      ${ratio ? `<rect x="${pad.left}" y="10" width="338" height="31" rx="15.5" fill="rgba(24,121,78,.25)" stroke="rgba(139,235,191,.65)"/><text x="${pad.left + 15}" y="31" fill="#d9ffeb" font-size="14" font-weight="800">${Math.round(ratio)}× más protección que el pago inicial</text>` : ''}
      ${grid}
      <polygon points="${area}" fill="url(#protectArea)"/>
      <polyline points="${points}" fill="none" stroke="#D4AF37" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${labels}
      ${initialPayment ? `<line x1="${paymentX}" y1="${paymentY}" x2="${paymentX}" y2="${height - pad.bottom - 45}" stroke="#8BEBBF" stroke-width="2" stroke-dasharray="5 5"/><circle cx="${paymentX}" cy="${paymentY}" r="8" fill="#8BEBBF" stroke="#fff" stroke-width="3" filter="url(#paymentGlow)"><title>Pago inicial: ${mxn.format(initialPayment)}</title></circle><rect x="${paymentX + 12}" y="${height - pad.bottom - 70}" width="220" height="42" rx="12" fill="rgba(24,121,78,.92)" stroke="rgba(255,255,255,.35)"/><text x="${paymentX + 25}" y="${height - pad.bottom - 53}" fill="#d9ffeb" font-size="12" font-weight="700">PAGO INICIAL</text><text x="${paymentX + 25}" y="${height - pad.bottom - 36}" fill="#fff" font-size="16" font-weight="900">${mxn.format(initialPayment)}</text>` : ''}
      <text x="${x(0) + 10}" y="${y(initialProtection) - 15}" fill="#fff" font-size="12" font-weight="700">TU PROTECCIÓN DESDE EL INICIO</text>
      <text x="${x(0) + 10}" y="${y(initialProtection) + 4}" fill="#D4AF37" font-size="17" font-weight="900">${mxn.format(initialProtection)}</text>
      <text x="${x(years) - 8}" y="${y(finalProtection) - 14}" text-anchor="end" fill="#D4AF37" font-size="16" font-weight="900">${mxn.format(finalProtection)}</text>
    </svg>`;
  }

  function compactMoney(value) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)} M`;
    if (value >= 1000) return `$${Math.round(value / 1000)} mil`;
    return mxn.format(value);
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? value : dateFmt.format(date);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  async function init() {
    try {
      data = await loadData();
      await resolveUnitRate();
      hydrateText();
      $('loading').classList.add('hidden');
      $('app').classList.remove('hidden');
    } catch (error) {
      $('loadError').textContent = error.message || 'No fue posible abrir esta cotización.';
      $('loadError').classList.remove('hidden');
      document.querySelector('.spinner')?.classList.add('hidden');
    }
  }

  init();
})();
