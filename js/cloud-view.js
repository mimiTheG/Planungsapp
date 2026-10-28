// Bereich „Cloud-Sync“ (auf der Seite Themen): verbinden, anmelden, Sync-Passwort, Status.

import { el, field, mount, toast } from './ui.js';
import { formatDate, formatTime } from './dates.js';
import { cloud } from './cloud.js';

const GUIDE = 'https://github.com/mimiTheG/Planungsapp/blob/main/supabase/ANLEITUNG.md';

// Führt eine Cloud-Aktion aus: Knopf solange gesperrt, Fehler als Hinweis.
async function run(button, action, done) {
  button.disabled = true;
  const label = button.textContent;
  button.textContent = '…';
  try {
    const result = await action();
    done?.(result);
  } catch (err) {
    toast(err.message, true);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

const password = (name, label, autocomplete) => field(label, el('input', {
  type: 'password', name, required: true, autocomplete, minlength: name === 'sync' || name === 'sync2' ? 8 : 6,
}));

export function cloudSection(refresh) {
  const box = el('div.card.cloud');
  const status = cloud.status();

  if (status.phase === 'off') {
    const form = el('form.form-grid', {
      onsubmit: (e) => {
        e.preventDefault();
        try {
          cloud.setConnection(form.elements.url.value, form.elements.key.value);
          refresh();
        } catch (err) {
          toast(err.message, true);
        }
      },
    },
    el('p.muted', {}, 'Deine Daten verschlüsselt in der Cloud (Supabase) speichern und zwischen Geräten abgleichen. ',
      'Dafür einmal ein kostenloses Supabase-Projekt anlegen – ',
      el('a', { href: GUIDE, target: '_blank', rel: 'noopener' }, 'zur Anleitung'), '.'),
    field('Projekt-URL', el('input', { name: 'url', type: 'url', required: true, placeholder: 'https://xxxx.supabase.co', autocomplete: 'off' })),
    field('Schlüssel (anon / publishable key)', el('input', { name: 'key', required: true, autocomplete: 'off' })),
    el('div.buttons', {}, el('button.primary', { type: 'submit' }, 'Verbinden')));
    mount(box, form);
    return box;
  }

  if (status.phase === 'setup') {
    const form = el('form.form-grid', { onsubmit: (e) => e.preventDefault() },
      el('p.muted', {}, 'Mit deinem Supabase-Konto anmelden (oder einmalig eins erstellen). ',
        'Das ist noch nicht das Sync-Passwort – das kommt im nächsten Schritt.'),
      field('E-Mail', el('input', { name: 'email', type: 'email', required: true, autocomplete: 'email', value: status.email || '' })),
      password('password', 'Konto-Passwort', 'current-password'),
      el('div.buttons', {},
        el('button.primary', {
          type: 'submit',
          onclick: (e) => {
            if (!form.reportValidity()) return;
            run(e.currentTarget, () => cloud.signIn(form.elements.email.value.trim(), form.elements.password.value), refresh);
          },
        }, 'Anmelden'),
        el('button', {
          type: 'button',
          onclick: (e) => {
            if (!form.reportValidity()) return;
            run(e.currentTarget, () => cloud.signUp(form.elements.email.value.trim(), form.elements.password.value), (result) => {
              if (result === 'confirm-email') toast('Fast geschafft: Bitte den Link in der E-Mail bestätigen, dann hier anmelden.');
              refresh();
            });
          },
        }, 'Konto erstellen')),
      cloud.hasFixedConfig() ? null : el('button.link', {
        type: 'button',
        onclick: () => { cloud.clearConnection(); refresh(); },
      }, 'Andere Projekt-URL eintragen'));
    mount(box, form);
    return box;
  }

  if (status.phase === 'locked') {
    mount(box, el('p.muted', {}, `Angemeldet als ${status.email || '…'} – prüfe die Cloud …`));
    cloud.hasVault().then((exists) => mount(box, exists ? unlockForm(refresh, status) : createForm(refresh, status)))
      .catch((err) => mount(box, el('p.error-text', {}, err.message), signOutButton(refresh)));
    return box;
  }

  // Verbunden.
  const when = status.lastSync
    ? `${formatDate(new Date(status.lastSync), { day: '2-digit', month: '2-digit' })}, ${formatTime(new Date(status.lastSync))}`
    : 'noch nie';
  mount(box,
    el('p', {}, el('strong', {}, '☁ Verschlüsselter Sync ist an'), el('br'), el('span.muted', {}, `Konto: ${status.email}`)),
    el('p.muted.cloud-last', {}, `Zuletzt abgeglichen: ${when}`),
    status.error ? el('p.error-text', {}, status.error) : null,
    el('div.buttons', {},
      el('button.primary', {
        type: 'button',
        onclick: (e) => run(e.currentTarget, () => cloud.sync(), () => { toast('Abgeglichen'); refresh(); }),
      }, '⟳ Jetzt abgleichen'),
      signOutButton(refresh)),
    el('p.muted.small', {}, 'Änderungen werden automatisch abgeglichen, sobald Internet da ist. ',
      'In der Cloud liegen nur verschlüsselte Daten – ohne dein Sync-Passwort kann sie niemand lesen.'));
  return box;
}

function signOutButton(refresh) {
  return el('button', {
    type: 'button',
    onclick: () => {
      if (!window.confirm('Vom Cloud-Sync abmelden? Die Daten bleiben auf diesem Gerät und in der Cloud.')) return;
      cloud.disconnect();
      toast('Abgemeldet');
      refresh();
    },
  }, 'Abmelden');
}

// Erstes Gerät: Sync-Passwort festlegen.
function createForm(refresh, status) {
  const form = el('form.form-grid', { onsubmit: (e) => e.preventDefault() },
    el('p', {}, el('strong', {}, 'Sync-Passwort festlegen'), el('br'),
      el('span.muted', {}, `Angemeldet als ${status.email}. Mit diesem Passwort werden deine Daten verschlüsselt, bevor sie `,
        'das Gerät verlassen. Auf jedem weiteren Gerät gibst du es einmal ein.')),
    el('p.warning', {}, '⚠ Merk es dir gut (am besten aufschreiben): Ohne dieses Passwort lassen sich die Daten in der Cloud ',
      'nicht mehr lesen – niemand kann es zurücksetzen.'),
    password('sync', 'Sync-Passwort (mind. 8 Zeichen)', 'new-password'),
    password('sync2', 'Sync-Passwort wiederholen', 'new-password'),
    el('div.buttons', {},
      el('button.primary', {
        type: 'submit',
        onclick: (e) => {
          if (!form.reportValidity()) return;
          if (form.elements.sync.value !== form.elements.sync2.value) {
            toast('Die beiden Passwörter sind verschieden', true);
            return;
          }
          run(e.currentTarget, () => cloud.createVault(form.elements.sync.value), () => {
            toast('Verschlüsselt hochgeladen – der Sync ist an');
            refresh();
          });
        },
      }, '🔒 Verschlüsseln & hochladen'),
      signOutButton(refresh)));
  return form;
}

// Weiteres Gerät: mit dem Sync-Passwort entsperren.
function unlockForm(refresh, status) {
  const form = el('form.form-grid', { onsubmit: (e) => e.preventDefault() },
    el('p', {}, el('strong', {}, 'Sync-Passwort eingeben'), el('br'),
      el('span.muted', {}, `Angemeldet als ${status.email}. In der Cloud liegen schon verschlüsselte Daten.`)),
    el('p.warning', {}, 'Die Daten auf diesem Gerät werden dabei durch die aus der Cloud ersetzt. ',
      'Wenn hier etwas Wichtiges steht, vorher unten eine Sicherung speichern.'),
    password('sync', 'Sync-Passwort', 'current-password'),
    el('div.buttons', {},
      el('button.primary', {
        type: 'submit',
        onclick: (e) => {
          if (!form.reportValidity()) return;
          run(e.currentTarget, () => cloud.unlockVault(form.elements.sync.value), () => {
            toast('Daten aus der Cloud übernommen – der Sync ist an');
            refresh();
          });
        },
      }, '🔓 Entsperren'),
      signOutButton(refresh)));
  return form;
}
