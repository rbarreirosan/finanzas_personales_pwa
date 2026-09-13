// Hub de ajustes: accesos a Cuentas, Categorías, Meta de ahorro y Presupuestos.
export function AjustesView() {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <header class="app-header">
      <div class="bar">
        <div class="hdr-left">
          <a class="back-btn" href="#/dashboard" aria-label="Volver">‹</a>
          <h1 class="large-title">Ajustes</h1>
        </div>
      </div>
    </header>
    <div class="screen-body">
      <a class="hub-item" href="#/cuentas">
        <span class="emoji">🏦</span>
        <span class="grow">
          <span class="h-title">Cuentas</span>
          <span class="h-sub">Débito, efectivo, crédito y ahorro</span>
        </span>
        <span class="chev">›</span>
      </a>
      <a class="hub-item" href="#/categorias">
        <span class="emoji">🏷️</span>
        <span class="grow">
          <span class="h-title">Categorías</span>
          <span class="h-sub">Ingresos y gastos (esencial / discrecional)</span>
        </span>
        <span class="chev">›</span>
      </a>
      <a class="hub-item" href="#/presupuestos">
        <span class="emoji">🎯</span>
        <span class="grow">
          <span class="h-title">Presupuestos</span>
          <span class="h-sub">Límites por categoría del mes</span>
        </span>
        <span class="chev">›</span>
      </a>
      <a class="hub-item" href="#/meta">
        <span class="emoji">💰</span>
        <span class="grow">
          <span class="h-title">Meta de ahorro</span>
          <span class="h-sub">Cuánto quieres ahorrar cada mes</span>
        </span>
        <span class="chev">›</span>
      </a>

      <button class="btn-danger" data-action="logout" style="margin-top:8px">
        Cerrar sesión
      </button>
    </div>
  `;
  return el;
}
