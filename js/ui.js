// DOM-Helfer.

// el('div.card', { onclick }, child1, 'Text', …)
export function el(spec, attrs = {}, ...children) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  // Keine Rechtschreibprüfung in Eingabefeldern: Antippen eines unterringelten Worts öffnete sonst
  // Korrekturvorschläge und schloss dabei die Tastatur. (Notizen-Felder behalten sie.)
  if (tag === 'input') {
    node.spellcheck = false;
    node.setAttribute('autocorrect', 'off');
  }
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, v);
        else node.style[prop] = v;
      }
    } else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...clean(children));
  return node;
}

const clean = (children) => children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);

// Ersetzt den Inhalt eines Elements; null/false-Einträge werden übersprungen.
export function mount(node, ...children) {
  node.replaceChildren(...clean(children));
}

export function toast(message, isError = false) {
  const box = document.getElementById('toast');
  // Ein offener <dialog> liegt über allem – der Hinweis muss dann darin stehen.
  const dialog = document.getElementById('dialog');
  (dialog.open ? dialog : document.body).append(box);
  box.textContent = message;
  box.classList.toggle('error', isError);
  box.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove('visible'), 3000);
}

// Führt eine Änderung aus und zeigt Fehler als Hinweis an. Gibt true bei Erfolg zurück.
export function attempt(action) {
  try {
    action();
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

// Öffnet den gemeinsamen <dialog> mit Inhalt; gibt eine Funktion zum Schließen zurück.
export function openDialog(title, ...content) {
  const dialog = document.getElementById('dialog');
  const close = () => dialog.close();
  document.body.append(document.getElementById('toast')); // nicht mit dem alten Inhalt wegwerfen
  mount(dialog,
    el('header.dialog-head', {}, el('h2', {}, title),
      el('button.icon', { type: 'button', 'aria-label': 'Schließen', onclick: close }, '×')),
    el('div.dialog-body', {}, content));
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('.dialog-body').scrollTop = 0;
  return close;
}

export function closeDialog() {
  document.getElementById('dialog').close();
}

// Formularfelder

export function field(label, input, hint) {
  return el('label.field', {}, el('span.field-label', {}, label), input, hint ? el('small.muted', {}, hint) : null);
}

export function select(name, options, value) {
  return el('select', { name }, options.map(([v, text]) =>
    el('option', { value: v, selected: String(v) === String(value ?? '') }, text)));
}

export function formData(form) {
  const data = {};
  for (const element of form.elements) {
    if (!element.name) continue;
    if (element.type === 'checkbox') data[element.name] = element.checked;
    else if (element.type === 'radio') { if (element.checked) data[element.name] = element.value; }
    else data[element.name] = element.value;
  }
  return data;
}
