// Einstiegspunkt für `node --test tests/`.
// Node ≥ 21 löst ein Verzeichnis-Argument wie ein Modul auf (→ tests/index.js),
// Node ≤ 20 durchsucht das Verzeichnis selbst nach *.test.mjs. Beides führt dieselben Tests aus.
import('./rules.test.mjs');
