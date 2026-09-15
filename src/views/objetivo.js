import { getObjetivo, setObjetivo, DEFAULT_OBJETIVO } from '../lib/objetivo.js';
import { money, currentMonth, monthLabel } from '../lib/format.js';
import { escapeHtml } from '../lib/dom.js';

// Ajuste del objetivo mensual de "libre para dirigir" (medidor de Presupuestos).
// Se puede fijar un valor distinto para cada mes.
export function ObjetivoView() {
  const el = document.createElement('div');
  el.className = 'screen';
  const mes = currentMonth();

  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="#/ajustes" aria-label="Volver">‹</a>
          <h1 class="large-title">Objetivo para dirigir</h1>
        </div>
      </div>
    </header>
    <div class="screen-body">
      <div id="msg"></div>
      <div class="card">
        <div class="field">
          <span class="f-label">Mes</span>
          <input id="mes" type="month" value="${mes}" />
        </div>
        <div class="field">
          <span class="f-label">Objetivo de libre para dirigir</span>
          <div class="amount-input-wrap">
            <span class="sign">$</span>
            <input id="obj" class="amount-input t-ingreso" type="number"
                   step="0.01" min="0" inputmode="decimal" placeholder="0.00" />
          </div>
        </div>
        <p class="hint">
          En Presupuestos, el medidor se llena de <b>verde</b> cuando lo que te
          queda libre para dirigir alcanza este objetivo, y de <b>rojo</b> cuando
          es $0 o menos. Puedes poner un objetivo distinto cada mes.
          Por defecto es ${money(DEFAULT_OBJETIVO)}.
        </p>
        <button class="btn btn-block" id="save">Guardar objetivo</button>
      </div>
    </div>
  `;

  const body = el.querySelector('.screen-body');
  const mesInp = body.querySelector('#mes');
  const objInp = body.querySelector('#obj');
  const msg = body.querySelector('#msg');
  const save = body.querySelector('#save');

  // Carga el valor guardado del mes seleccionado.
  function loadMes() {
    objInp.value = getObjetivo(mesInp.value || mes);
    msg.innerHTML = '';
  }
  loadMes();
  mesInp.addEventListener('change', loadMes);

  save.addEventListener('click', () => {
    const m = mesInp.value || mes;
    setObjetivo(m, objInp.value);
    const etiqueta = /^\d{4}-\d{2}$/.test(m) ? monthLabel(m) : m;
    msg.innerHTML = `<div class="msg ok">✅ Objetivo de ${money(
      getObjetivo(m)
    )} guardado para ${escapeHtml(etiqueta)}.</div>`;
  });

  return el;
}
