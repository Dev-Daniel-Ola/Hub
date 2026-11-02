/**
 * =============================================================
 * AutoOrders Hub: Landing Page Behaviour
 * Linked from index.html with:
 *   <script src="script.js" defer></script>
 *
 * `defer` makes the browser run this file after the page has
 * been read, so every element looked up below already exists.
 *
 * What this file does
 *   1. ROI calculator: works out the hours lost to manual order
 *      handling and updates the result as sliders move.
 *   2. Count-up: the "3,800+" number counts up when seen.
 *   3. Sticky call to action: shows a "Book a free demo" bar on
 *      phones while the visitor is between sections.
 *   4. Demo form: opens an email with the visitor's details.
 * =============================================================
 */

'use strict';

/* -------------------------------------------------------------
   Settings. Change these in one place.
   ------------------------------------------------------------- */
const SETTINGS = {
  // Demo requests are sent to this address (see initDemoForm).
  demoRequestEmail: '21315959d9259f70eccde337a26a7c7f',

  // A full working day, used to turn hours into working days.
  hoursPerWorkingDay: 8,

  minutesPerHour: 60
};

// Holds the latest calculator result once the visitor has used it,
// so the demo form can include it in the request.
let calculatorEstimate = null;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('DOMContentLoaded', () => {
  initRoiCalculator();
  initCountUp();
  initStickyCta();
  initDemoForm();
});


/* =============================================================
   1. ROI CALCULATOR
   ============================================================= */

/**
 * Works out how many hours a month go on manual order handling.
 *
 *   owner hours = orders per day x minutes per order x days / 60
 *   team hours  = orders per day x team minutes per order x days / 60
 */
function calculateEstimate({ orders, ownerMinutes, teamMinutes, people, days }) {
  const ownerHours = (orders * ownerMinutes * days) / SETTINGS.minutesPerHour;
  const teamHours = (orders * teamMinutes * days) / SETTINGS.minutesPerHour;
  const totalHours = ownerHours + teamHours;

  return {
    ownerHours,
    teamHours,
    totalHours,
    hoursEach: teamHours / people,
    workingDays: totalHours / SETTINGS.hoursPerWorkingDay,
    people
  };
}

function initRoiCalculator() {
  const form = document.getElementById('calculator-form');
  if (!form) {
    return;
  }

  const inputs = {
    orders: document.getElementById('in-orders'),
    ownerMinutes: document.getElementById('in-owner'),
    teamMinutes: document.getElementById('in-team'),
    people: document.getElementById('in-people'),
    days: document.getElementById('in-days')
  };

  // The value shown next to each slider.
  const sliderReadouts = {
    orders: document.getElementById('out-orders'),
    ownerMinutes: document.getElementById('out-owner'),
    teamMinutes: document.getElementById('out-team'),
    people: document.getElementById('out-people'),
    days: document.getElementById('out-days-input')
  };

  // The result panel.
  const results = {
    total: document.getElementById('res-total'),
    days: document.getElementById('res-days'),
    owner: document.getElementById('res-owner'),
    team: document.getElementById('res-team'),
    each: document.getElementById('res-each'),
    live: document.getElementById('live-total')
  };

  // Last number shown in each animated element, so changes can count smoothly.
  const shownValues = new WeakMap();

  function readInputs() {
    return {
      orders: Number(inputs.orders.value),
      ownerMinutes: Number(inputs.ownerMinutes.value),
      teamMinutes: Number(inputs.teamMinutes.value),
      people: Number(inputs.people.value),
      days: Number(inputs.days.value)
    };
  }

  function paintSliderFill(slider) {
    const min = Number(slider.min);
    const max = Number(slider.max);
    const percent = ((Number(slider.value) - min) / (max - min)) * 100;
    slider.style.setProperty('--fill', `${percent}%`);
  }

  function render() {
    const values = readInputs();
    const estimate = calculateEstimate(values);

    Object.keys(inputs).forEach((key) => {
      sliderReadouts[key].textContent = values[key];
      paintSliderFill(inputs[key]);
    });

    const totalHours = Math.round(estimate.totalHours);
    const workingDays = roundToOneDecimal(estimate.workingDays);

    animateNumber(results.total, totalHours, (n) => formatNumber(n));
    animateNumber(results.owner, Math.round(estimate.ownerHours), (n) => formatNumber(n));
    animateNumber(results.team, Math.round(estimate.teamHours), (n) => formatNumber(n));

    results.days.textContent = `${formatNumber(workingDays)} full working ${workingDays === 1 ? 'day' : 'days'}`;
    results.each.textContent =
      `About ${formatNumber(Math.round(estimate.hoursEach))} ${Math.round(estimate.hoursEach) === 1 ? 'hour' : 'hours'} each across ` +
      `${estimate.people} ${estimate.people === 1 ? 'person' : 'people'}`;
    results.live.textContent = `${formatNumber(totalHours)} ${totalHours === 1 ? 'hour' : 'hours'}`;

    return { values, estimate, totalHours, workingDays };
  }

  /** Counts a number from its last value to a new one over a short time. */
  function animateNumber(element, target, format) {
    const start = shownValues.has(element) ? shownValues.get(element) : target;
    shownValues.set(element, target);

    if (prefersReducedMotion || start === target) {
      element.textContent = format(target);
      return;
    }

    const duration = 300;
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      element.textContent = format(Math.round(start + (target - start) * progress));
      if (progress < 1 && shownValues.get(element) === target) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  // Show the starting numbers straight away.
  render();

  // Update whenever any slider moves, and remember the result for the form.
  form.addEventListener('input', () => {
    const { values, totalHours, workingDays } = render();
    calculatorEstimate = {
      orders: values.orders,
      totalHours,
      workingDays
    };
  });
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en').format(value);
}


/* =============================================================
   2. COUNT-UP NUMBER
   ============================================================= */

/**
 * Counts any element with data-count-to up from zero the first
 * time at least half of it is on screen.
 */
function initCountUp() {
  const counters = document.querySelectorAll('[data-count-to]');
  if (counters.length === 0 || prefersReducedMotion || !('IntersectionObserver' in window)) {
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }
      observer.unobserve(entry.target);
      countUp(entry.target);
    });
  }, { threshold: 0.5 });

  counters.forEach((counter) => observer.observe(counter));
}

function countUp(element) {
  const target = Number(element.dataset.countTo);
  const suffix = element.dataset.suffix || '';
  const duration = 1200;
  const startTime = performance.now();

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    // Ease out so the number slows as it lands.
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = `${formatNumber(Math.round(target * eased))}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}


/* =============================================================
   3. STICKY CALL TO ACTION (phones)
   ============================================================= */

/**
 * Shows the sticky "Book a free demo" bar only when the visitor
 * is not already looking at a booking button, the calculator,
 * the demo form or the footer.
 */
function initStickyCta() {
  const bar = document.querySelector('[data-sticky-cta]');
  if (!bar || !('IntersectionObserver' in window)) {
    document.getElementById('pricing');
    return;
  }

  const watched = [
    document.querySelector('[data-hero-cta]'),
    document.getElementById('calculator'),
    document.getElementById('demo'),
    document.querySelector('.site-footer')
  ].filter(Boolean);

  const visibleNow = new Set();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        visibleNow.add(entry.target);
      } else {
        visibleNow.delete(entry.target);
      }
    });
    bar.classList.toggle('is-visible', visibleNow.size === 0);
  });

  watched.forEach((element) => observer.observe(element));
}


/* =============================================================
   4. DEMO FORM
   ============================================================= */

/**
 * There is no server behind this page yet, so submitting the form
 * opens the visitor's email app with a ready-written message to
 * SETTINGS.demoRequestEmail. If the visitor used the calculator,
 * the result is added so the first conversation can start there.
 *
 * To send requests to a form service instead, replace the
 * `window.location.href = ...` line with a fetch() call.
 */
function initDemoForm() {
  const form = document.getElementById('demo-form');
  const status = document.getElementById('form-status');
  if (!form || !status) {
    return;
  }

  document.querySelectorAll('[data-plan]').forEach((link) => {
    link.addEventListener('click', () => {
      document.getElementById('f-plan').value = link.dataset.plan;
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const contact = String(data.get('contact')).trim();
    const orders = String(data.get('orders') || '').trim();
    const plan = String(data.get('plan'));
    const business = String(data.get('business') || '').trim();

    const lines = [
      'Hello, I would like to book a free demo of AutoOrders Hub.',
      '',
      `Name: ${name}`,
      `Email or WhatsApp: ${contact}`
    ];

    if (orders) {
      lines.push(`Orders per day: ${orders}`);
    }

    if (calculatorEstimate) {
      lines.push(
        '',
        'From the calculator on your site:',
        `${calculatorEstimate.orders} orders a day, about ${formatNumber(calculatorEstimate.totalHours)} hours a month ` +
        `(${formatNumber(calculatorEstimate.workingDays)} working days) spent on order admin.`
      );
    }

    const calculatorSummary = calculatorEstimate
      ? `${calculatorEstimate.orders} orders a day, about ${formatNumber(calculatorEstimate.totalHours)} hours a month (${formatNumber(calculatorEstimate.workingDays)} working days)`
      : 'Not used';

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    status.textContent = 'Sending...';

    try {
      const response = await fetch(`https://formsubmit.co/ajax/${SETTINGS.demoRequestEmail}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: `Order request from ${name} (${plan})`,
          'Plan': plan,
          _template: 'table',
          _captcha: 'false',
          'Name': name,
          'Email or WhatsApp': contact,
          'Orders per day': orders || 'Not given',
          'About the business': business || 'Not given',
          'Calculator result': calculatorSummary
        })
      });

    // Read and verify FormSubmit's response.
    const result = await response.json();

    if (!response.ok || String(result.success).toLowerCase() !== 'true') {
      throw new Error(result.message || 'Request failed');
    }

    // Record a Lead only after FormSubmit confirms success.
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead');
    }

    form.reset();

    status.textContent =
      'Thank you. Your request has been sent. We will be in touch to agree a time.';

    } catch (error) {
      status.textContent = `Something went wrong. Please email ${SETTINGS.demoRequestEmail} directly.`;
    } finally {
      submitButton.disabled = false;
    }
  });
}
