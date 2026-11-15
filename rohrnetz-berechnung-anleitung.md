# Performante Rohrnetzberechnung für Kälteverbundanlagen

Anleitung für Architektur und Umsetzung (CoolProp + TypeScript/JavaScript)
Geltungsbereich: CO2 (R744), R458A, R513A · bis ~50 Kühlstellen und mehr · Ziel: kleinstmögliche Rohre bei eingehaltenem Druckverlust

---

## 1. Die fünf Grundregeln

1. **Das Rohrnetz ist ein Baum, kein Maschennetz.** Massenströme ergeben sich per Summation, Druckverluste per Pfadsumme. Kein Hardy-Cross, kein Gleichungssystem, keine großen Iterationen.
2. **CoolProp läuft nie in der Berechnungsschleife.** Stoffdaten werden einmal offline in Tabellen gegossen. Zur Laufzeit gibt es nur Interpolation (O(1), Nanosekunden bis Mikrosekunden).
3. **Hydraulik und Optimierung sind getrennt.** Erst wird für jedes Segment und jede mögliche Nennweite der Druckverlust berechnet (kleine Tabelle). Danach wählt ein Optimierer nur noch aus dieser Tabelle aus.
4. **Daten im Speicher flach halten.** Typed Arrays (Struct of Arrays), topologisch sortierte Knoten, keine Rekursion, keine Objekte oder Maps in der heißen Schleife.
5. **Rechnen im Web Worker.** Die UI bleibt flüssig, Berechnung läuft bei jeder Änderung neu (entprellt). Bei richtiger Architektur dauert eine volle Neuberechnung nur wenige Millisekunden.

> Richtwerte als Ziel, nicht als Garantie: 100 Segmente komplett optimiert in < 10 ms, 5.000 Segmente in < 0,5 s. Immer mit dem eigenen Benchmark prüfen (Abschnitt 9).

---

## 2. Gesamtarchitektur

```
OFFLINE (einmalig, Python + CoolProp)
  gen_tables.py  ->  R744.sat.bin / R513A.sat.bin / R458A.sat.bin (+ .json Metadaten)
                     Gastabellen (2D) für überhitzten Dampf / CO2 Hochdruck

LADEN (App-Start)
  Tabellen als ArrayBuffer laden -> Float64Array-Views (kein Parsing)

LAUFZEIT (Web Worker)
  Netz (Editor) --> Netz-Kompilierung (SoA, topologisch sortiert)
                --> Pass 1: Massenströme (bottom-up)
                --> Pass 2: Druckverlust-Tabelle  dp[segment][DN]
                --> Pass 3: Optimierung (Pareto-DP oder Greedy)
                --> Pass 4: Rückrechnung mit realen Zuständen (2-3 Fixpunkt-Runden)
                --> Ergebnis (Typed Arrays, transferiert) --> UI
```

---

## 3. Stoffdaten mit CoolProp

### 3.1 Welche Stoffe

| Stoff | CoolProp-Name | Hinweis |
|---|---|---|
| CO2 | `R744` | Kritischer Punkt ~31 °C / 73,8 bar. Unterkritisch (Saug-/Flüssigleitung) per Sättigungstabelle, transkritisch (Hochdruckseite) per 2D-Tabelle in (p, T) |
| R513A | `R513A` | Azeotrop-ähnlich, praktisch kein Gleit. Verfügbarkeit in der installierten CoolProp-Version prüfen |
| R458A | evtl. nicht vorhanden | Zeotrop mit Temperaturgleit. Prüfen mit `CP.FluidsList()`. Falls nicht enthalten: als Mixture aus den Reinstoffen mit Zusammensetzung laut ASHRAE 34 definieren oder Herstellerdaten verwenden |

Wichtig: Nicht für jeden Blend liefert CoolProp Transporteigenschaften (Viskosität). Vorab für jeden Stoff testen. Fehlende Werte aus Herstellerdaten ergänzen und die Quelle dokumentieren.

### 3.2 Konvention bei Gleit

Tabellen werden über die **Taupunkttemperatur** indexiert (üblich für t0 und tc). Flüssigkeitseigenschaften werden beim gleichen Druck an der Siedelinie gespeichert. Für die Flüssigleitung sind Dichte und Enthalpie der Flüssigkeit, für die Saugleitung die des Dampfs relevant.

### 3.3 Offline-Generator (Python)

```python
# tools/gen_tables.py
import json
import numpy as np
import CoolProp.CoolProp as CP

COLS = ["p", "rhoL", "rhoV", "muL", "muV", "hL", "hV", "dTdp"]

def gen_sat(fluid: str, t_min: float, t_max: float, dt: float = 0.5):
    T = np.arange(t_min, t_max + 1e-9, dt)
    data = {k: [] for k in COLS if k != "dTdp"}
    for t in T:
        tk = t + 273.15
        p = CP.PropsSI("P", "T", tk, "Q", 1, fluid)            # Taupunktdruck
        data["p"].append(p)
        data["rhoV"].append(CP.PropsSI("D", "P", p, "Q", 1, fluid))
        data["rhoL"].append(CP.PropsSI("D", "P", p, "Q", 0, fluid))
        data["muV"].append(CP.PropsSI("V", "P", p, "Q", 1, fluid))
        data["muL"].append(CP.PropsSI("V", "P", p, "Q", 0, fluid))
        data["hV"].append(CP.PropsSI("H", "P", p, "Q", 1, fluid))
        data["hL"].append(CP.PropsSI("H", "P", p, "Q", 0, fluid))
    arr = {k: np.asarray(v, dtype="<f8") for k, v in data.items()}
    arr["dTdp"] = np.gradient(T, arr["p"]).astype("<f8")        # K/Pa, für Δp -> ΔT
    return T, arr

def write(fluid: str, t_min: float, t_max: float, dt: float = 0.5):
    T, arr = gen_sat(fluid, t_min, t_max, dt)
    with open(f"data/{fluid}.sat.bin", "wb") as f:
        for k in COLS:
            f.write(arr[k].tobytes())
    meta = {"fluid": fluid, "t0": t_min, "dt": dt, "n": len(T), "cols": COLS}
    with open(f"data/{fluid}.sat.json", "w") as f:
        json.dump(meta, f)

write("R744",  -60.0, 30.0)     # CO2 unterkritisch
write("R513A", -60.0, 70.0)
# write("R458A", -60.0, 70.0)   # erst nach Verfügbarkeitsprüfung
```

Größenordnung: 261 Stützstellen × 8 Spalten × 8 Byte ≈ 17 kB pro Stoff. Das kann man bedenkenlos komplett laden.

### 3.4 Überhitzter Dampf und CO2-Hochdruckseite

Die Saugleitung führt überhitzten Dampf, die Druckgasleitung heißes Gas. Dichte und Viskosität hängen dort von Druck und Temperatur ab. Lösung: eine **2D-Tabelle** und bilineare Interpolation.

- Saugleitung: Achsen = Taupunkttemperatur t0 und Überhitzung ΔT_sh (z. B. 0 bis 40 K in 2-K-Schritten). Ausgabe: ρ, μ.
- Druckgas / CO2 transkritisch: Achsen = Druck p und Temperatur T. Ausgabe: ρ, μ, h. Nahe dem kritischen Punkt ist die Dichte stark nichtlinear, dort das Raster verfeinern.

Größe: z. B. 261 × 21 × 3 Werte × 8 Byte ≈ 130 kB pro Stoff. Unkritisch.

### 3.5 Interpolation (die einzige Stoffdaten-Funktion in der Schleife)

```ts
export interface SatTable {
  t0: number; dt: number; invDt: number; n: number;
  p: Float64Array; rhoL: Float64Array; rhoV: Float64Array;
  muL: Float64Array; muV: Float64Array;
  hL: Float64Array; hV: Float64Array; dTdp: Float64Array;
}

/** Lineare Interpolation auf gleichmäßigem Raster, O(1), ohne Allokation. */
export function lerp(col: Float64Array, tab: SatTable, t: number): number {
  let x = (t - tab.t0) * tab.invDt;
  const xmax = tab.n - 1.000001;
  if (x < 0) x = 0; else if (x > xmax) x = xmax;   // Bereichsprüfung ggf. separat melden
  const i = x | 0;
  const f = x - i;
  return col[i] + f * (col[i + 1] - col[i]);
}

export function bilerp(
  grid: Float64Array, nx: number, ny: number,
  x0: number, dx: number, y0: number, dy: number,
  x: number, y: number
): number {
  let u = (x - x0) / dx, v = (y - y0) / dy;
  u = Math.min(Math.max(u, 0), nx - 1.000001);
  v = Math.min(Math.max(v, 0), ny - 1.000001);
  const i = u | 0, j = v | 0, fu = u - i, fv = v - j;
  const a = grid[j * nx + i],       b = grid[j * nx + i + 1];
  const c = grid[(j + 1) * nx + i], d = grid[(j + 1) * nx + i + 1];
  return (a + fu * (b - a)) * (1 - fv) + (c + fu * (d - c)) * fv;
}
```

Raster 0,5 K reicht bei linearer Interpolation für ρ, μ und p in der Regel auf deutlich unter 0,1 % Abweichung. Das wird in Abschnitt 8 gegen CoolProp getestet. Wo der Fehler größer ist (nahe dem kritischen Punkt), Raster verfeinern oder kubisch interpolieren.

### 3.6 CoolProp zur Laufzeit?

Nur wenn nötig (z. B. benutzerdefinierte Gemische). Dann ausschließlich im Worker, einmalig beim Projektstart zum Erzeugen eigener Tabellen, nie pro Segment oder pro Iteration. CoolProp-Aufrufe (besonders Gemisch-Flash-Rechnungen) sind um Größenordnungen teurer als ein Tabellenzugriff. Genau das ist der häufigste Grund für lahme Skripte.

---

## 4. Datenmodell: Struct of Arrays, topologisch sortiert

Jeder Knoten außer dem Wurzelknoten (Maschine) besitzt genau **ein Segment zum Elternknoten**. Das Netz wird vor der Berechnung so sortiert, dass immer `parent[i] < i` gilt (Breitensuche ab der Maschine). Dann genügen einfache `for`-Schleifen vorwärts (Wurzel → Blätter) und rückwärts (Blätter → Wurzel).

```ts
export const MACHINE = 0, JUNCTION = 1, LEAF = 2;

export interface Net {
  n: number;
  parent: Int32Array;     // parent[0] = -1, sonst parent[i] < i
  kind: Uint8Array;       // MACHINE | JUNCTION | LEAF
  len: Float64Array;      // Länge des Segments zum Parent [m] (aus Plan * Maßstab)
  dz: Float64Array;       // Höhenversatz zum Parent [m] (+ = steigend)
  zeta: Float64Array;     // Summe Einzelwiderstände (Bögen, T-Stücke, Armaturen)
  riser: Uint8Array;      // 1 = Steigleitung (Mindestgeschwindigkeit Ölrückführung)
  q: Float64Array;        // Kälteleistung an Blättern [W]
  budgetK: Float64Array;  // zulässiger Druckverlust-Budget je Blatt [K], optional
  // Ergebnisse (vorab allozieren, nicht pro Lauf neu erzeugen)
  mdot: Float64Array;     // Massenstrom [kg/s]
  dn: Int16Array;         // gewählter Index in der DN-Liste
  dpSeg: Float64Array;    // Druckverlust Segment [Pa]
  dTSeg: Float64Array;    // Äquivalent in K
  dTPath: Float64Array;   // Pfadsumme Wurzel -> Knoten [K]
}
```

Hinweise:

- **Editor-Modell und Rechenmodell trennen.** Der Editor darf Objekte, IDs und Strings nutzen. Beim Berechnen wird einmal in `Net` kompiliert (O(n)). Rückabbildung über einen `ids: string[]`-Array.
- **Automatische T-Stücke:** Endet eine Linie auf einer bestehenden, wird die Kante in zwei Kanten geteilt und ein `JUNCTION`-Knoten erzeugt. Das passiert im Editor, die Berechnung sieht nur den fertigen Baum.
- **Höhen sind Pflichtdaten.** Ein 2D-Plan liefert keine `dz`. Pro Segment ist eine Höheneingabe nötig (Steigleitung, Fallleitung), sonst sind Ölrückführung und Flüssigleitung (Flashgas) nicht korrekt prüfbar.
- **Mehrere Kreise** (z. B. Normalkühlung und Tiefkühlung, CO2-Sauggas, Flüssigkeit, Heißgas) sind getrennte Bäume mit gleicher Topologie, aber anderen Massenströmen, Fluidzuständen und Grenzwerten. Jeder Kreis ist eine eigene `Net`-Instanz und kann parallel in eigenen Workern laufen.

---

## 5. Berechnungskern

### 5.1 Pass 1: Massenströme (Blätter → Wurzel)

```ts
export function massFlows(net: Net, dhEvap: number /* J/kg */) {
  const { n, parent, kind, q, mdot } = net;
  for (let i = 0; i < n; i++) mdot[i] = kind[i] === LEAF ? q[i] / dhEvap : 0;
  for (let i = n - 1; i > 0; i--) mdot[parent[i]] += mdot[i];
}
```

`dhEvap` ist die nutzbare Enthalpiedifferenz im Verdampfer (je Kreis und Kühlstelle ggf. eigener Wert, dann Array statt Skalar). Für die Druckgasleitung kommt die Verdichterleistung hinzu. Für Teillast wird ein zweiter Massenstromvektor mit Faktor (z. B. 0,3 bis 0,5) gerechnet.

### 5.2 Pass 2: Druckverlust-Tabelle `dp[segment][DN]`

Das ist der eigentliche Rechenaufwand: n × K Auswertungen (z. B. 100 Segmente × 15 Nennweiten = 1.500 Stück). Jede ist ein paar Dutzend Gleitkommaoperationen.

```ts
const G = 9.80665;

/** Darcy-Reibungsbeiwert, explizit (Haaland). Abweichung ggü. Colebrook ca. 1-2 %. */
export function frictionFactor(re: number, relRough: number): number {
  if (re < 2300) return 64 / re;
  const a = -1.8 * Math.log10(Math.pow(relRough / 3.7, 1.11) + 6.9 / re);
  return 1 / (a * a);
}

/** Druckverlust [Pa] eines Segments bei Innendurchmesser d [m]. */
export function segmentDp(
  m: number, d: number, len: number, zeta: number,
  rho: number, mu: number, rough: number
): number {
  const area = Math.PI * d * d * 0.25;
  const v = m / (rho * area);
  const re = rho * v * d / mu;
  const f = frictionFactor(re, rough / d);
  const dyn = 0.5 * rho * v * v;
  return (f * len / d + zeta) * dyn;
}
```

Zusätze je Kreis:

- **Statischer Anteil** `ρ·g·dz` bei Flüssigleitung (und bei Saugleitung mit Flüssigkeitsanteil vernachlässigbar, bei Gas meist ebenfalls klein, aber konsistent mitführen).
- **Umrechnung Pa → K:** `dT = dp * dTdp(t)` mit dTdp aus der Tabelle. In der Kältetechnik werden Saugleitungs-Verluste üblich in K Sättigungstemperaturdifferenz angegeben. Bei CO2 transkritisch ist die Angabe in bar sinnvoller, dann Budget in bar führen.
- **Verfeinerung (optional):** Colebrook mit 2-3 Newton-Schritten, gestartet bei Haaland, wenn höhere Genauigkeit nötig ist.
- **Formteile:** T-Stück-Beiwerte hängen vom Mengenverhältnis ab. Für die Auslegung reichen feste Zuschläge je Abzweig. Eine genauere Variante kann den Beiwert aus dem Massenstromverhältnis `m_branch / m_total` berechnen, weiterhin als reiner Zuschlag in `zeta`.

```ts
export interface DnOption {
  id: string;
  di: number;        // Innendurchmesser [m]
  da: number;        // Außendurchmesser [m]
  wall: number;      // Wandstärke [m]
  rough: number;     // Rauheit [m]
  psMax: number;     // zulässiger Druck [Pa] (wichtig für CO2)
  costPerM: number;  // Preis pro Meter inkl. Montage
  material: string;
}

export function buildDpTable(
  net: Net, dns: DnOption[], rho: Float64Array, mu: Float64Array,
  dTdp: Float64Array, out: Float64Array /* n*K [K] */
) {
  const K = dns.length;
  for (let i = 1; i < net.n; i++) {
    for (let k = 0; k < K; k++) {
      const dp = segmentDp(net.mdot[i], dns[k].di, net.len[i], net.zeta[i],
                           rho[i], mu[i], dns[k].rough);
      out[i * K + k] = dp * dTdp[i];
    }
  }
}
```

### 5.3 Zulässige Nennweiten je Segment (Filter)

Vor der Optimierung wird je Segment die Menge erlaubter DN bestimmt. Nur diese kommen in den Optimierer.

- `v_max` (Volllast) nicht überschritten (Geräusch, Erosion, ggf. Grenzwerte je Leitungsart).
- `v_min` in Steigleitungen **auch bei Teillast** erreicht (Ölrückführung bei Gas-/Druckgasleitungen).
- `PS` der Leitung ≥ Auslegungsdruck (CO2: Rohrklassen 40 / 60 / 120 bar beachten, Werkstoff und Wandstärke).
- Werkstoff wählbar (Kupfer, Stahl, Edelstahl, Mehrschicht). Pro Werkstoff eigene DN-Liste.
- Flüssigleitung: lokaler Druck nach Verlust und Steighöhe muss über dem Sättigungsdruck der Flüssigkeitstemperatur bleiben (kein Flashgas). Dieses Kriterium wird in Pass 4 mit realen Zuständen geprüft.

### 5.4 Pass 4: Zustände zurückrechnen (Fixpunkt)

Dichte und Viskosität hängen vom lokalen Druck ab, der Druck hängt wiederum vom Druckverlust ab. Lösung ohne Aufwand:

1. Runde 0: alle Segmente mit dem Zustand am Startpunkt (z. B. t0 an der Maschine) rechnen.
2. Optimieren.
3. Zustand an jedem Knoten aus `dTPath` bestimmen, Tabellenwerte (ρ, μ) je Segment neu ziehen.
4. Wiederholen, bis sich die DN-Wahl nicht mehr ändert. Praktisch 2 bis 3 Runden.

```ts
// Pfadsumme Wurzel -> Blatt (vorwärts, kein Rekursionsstack)
net.dTPath[0] = 0;
for (let i = 1; i < net.n; i++) {
  net.dTPath[i] = net.dTPath[net.parent[i]] + net.dTSeg[i];
}
```

---

## 6. Optimierung: kleinstes Rohr, Druckverlust eingehalten

Problem: Wähle je Segment eine Nennweite, sodass die Summe der Kosten minimal ist und für **jeden** Pfad Wurzel → Blatt die Druckverlustsumme ≤ Budget bleibt. Die Nennweiten sind diskret.

### 6.1 Option A: Greedy (schnell zu bauen, sehr gut in der Praxis)

1. Starte mit der kleinsten erlaubten DN je Segment.
2. Solange ein Pfad das Budget überschreitet: Auf dem verletzenden Pfad die Segmente betrachten und das Upgrade auswählen mit maximalem `ΔdT / Δkosten` (größte Verlustminderung pro Mehrpreis). Ausführen.
3. Pfadsummen nur im Teilbaum des geänderten Segments aktualisieren.

Nicht garantiert optimal (ein gemeinsamer Stammabschnitt wirkt auf viele Pfade, das fängt die Heuristik meist, aber nicht immer ab). Dafür trivial zu implementieren und ein guter Vergleichswert.

### 6.2 Option B: Exakt per Pareto-Dynamic-Programming (empfohlen)

Weil das Netz ein Baum ist und die Kosten additiv sind, ist das Problem exakt lösbar.

Definition: Für jeden Knoten `v` ist `F_v` die Menge nicht dominierter Paare `(Kosten, d)`. Dabei sind `Kosten` die Gesamtkosten des Segments zu `v` plus aller Segmente darunter, und `d` der größte Druckverlust (in K) vom Elternknoten von `v` bis zu irgendeinem Blatt im Teilbaum.

Ablauf (Knoten rückwärts durchlaufen, Kinder vor Eltern):

1. **Kinder zusammenführen:** Für jeden Schwellwert `D` (alle `d`-Werte der Kinder) wählt jedes Kind die billigste Option mit `d ≤ D`. Kosten summieren sich, `D` ist der gemeinsame Max-Wert. Ergebnis: Pareto-Front `G_v`. Mit einem Zeiger je Kind in sortierten Fronten ist das ein linearer Merge.
2. **Eigenes Segment hinzufügen:** Für jede erlaubte DN `k` und jeden Punkt `(c, D)` aus `G_v` entsteht `(c + kosten(v,k), dp(v,k) + D)`.
3. **Dominierte Punkte entfernen:** Nach `d` aufsteigend sortieren, nur Punkte behalten, deren Kosten strikt fallen. Optional `d` auf ein Raster runden (z. B. 0,005 K), um die Frontgröße zu begrenzen.
4. **Wurzel:** Billigsten Punkt mit `D ≤ Budget` wählen.
5. **Rekonstruktion (top-down):** Je Knoten den billigsten Punkt mit `d ≤ Schwelle` wählen, Schwelle für die Kinder = Schwelle − `dp(v, gewählte DN)`. Keine Back-Pointer nötig.

```ts
interface Pt { cost: number; d: number; dn: number }   // Front: d aufsteigend, cost strikt fallend

function prune(pts: Pt[], quant: number): Pt[] {
  pts.sort((a, b) => a.d - b.d || a.cost - b.cost);
  const out: Pt[] = [];
  let best = Infinity, lastBucket = NaN;
  for (const p of pts) {
    const bucket = Math.round(p.d / quant);
    if (p.cost < best && bucket !== lastBucket) { out.push(p); best = p.cost; lastBucket = bucket; }
    else if (p.cost < best && out.length) {      // gleicher Bucket, aber billiger: ersetzen
      out[out.length - 1] = p; best = p.cost;
    }
  }
  return out;
}

/** Billigster Punkt mit d <= limit (Front nach d aufsteigend, Kosten fallend). */
function pick(front: Pt[], limit: number): Pt | null {
  let res: Pt | null = null;
  for (const p of front) { if (p.d <= limit + 1e-12) res = p; else break; }
  return res;
}

function mergeChildren(fronts: Pt[][]): Pt[] {
  if (fronts.length === 0) return [{ cost: 0, d: 0, dn: -1 }];      // Blatt
  const thresholds = [...new Set(fronts.flatMap(f => f.map(p => p.d)))].sort((a, b) => a - b);
  const out: Pt[] = [];
  for (const D of thresholds) {
    let cost = 0, ok = true;
    for (const f of fronts) {
      const p = pick(f, D);
      if (!p) { ok = false; break; }
      cost += p.cost;
    }
    if (ok) out.push({ cost, d: D, dn: -1 });
  }
  return out;
}

export function optimize(
  net: Net, K: number, allowed: Uint8Array /* n*K */, dT: Float64Array /* n*K */,
  costSeg: Float64Array /* n*K */, budgetK: number, quant = 0.005
): Int16Array | null {
  const children: number[][] = Array.from({ length: net.n }, () => []);
  for (let i = 1; i < net.n; i++) children[net.parent[i]].push(i);

  const fronts: Pt[][] = new Array(net.n);
  for (let v = net.n - 1; v >= 1; v--) {
    const G = mergeChildren(children[v].map(c => fronts[c]));
    const cand: Pt[] = [];
    for (let k = 0; k < K; k++) {
      if (!allowed[v * K + k]) continue;
      for (const g of G) {
        cand.push({ cost: g.cost + costSeg[v * K + k], d: g.d + dT[v * K + k], dn: k });
      }
    }
    fronts[v] = prune(cand, quant);
    if (fronts[v].length === 0) return null;     // Segment ohne zulässige DN -> Eingabe prüfen
  }

  // Wurzel + Rekonstruktion
  const choice = new Int16Array(net.n).fill(-1);
  const rootG = mergeChildren(children[0].map(c => fronts[c]));
  const rootPt = pick(rootG, budgetK);
  if (!rootPt) return null;                      // Budget nicht erreichbar -> Meldung an Nutzer

  const stack: Array<[number, number]> = children[0].map(c => [c, rootPt.d]);
  while (stack.length) {
    const [v, limit] = stack.pop()!;
    const p = pick(fronts[v], limit)!;
    choice[v] = p.dn;
    const childLimit = limit - dT[v * K + p.dn];
    for (const c of children[v]) stack.push([c, childLimit]);
  }
  return choice;
}
```

Hinweise zur Größe: Pro Knoten entstehen höchstens `K × |G|` Kandidaten, nach Pruning (und Quantisierung) bleiben Fronten klein. Typisch: 15 Nennweiten, Fronten mit 50 bis 500 Punkten, 100 Segmente → unter einer Million Elementaroperationen. Das sind Millisekunden.

Erweiterungen:

- **Eigenes Budget je Kühlstelle:** Für jedes Blatt den Startwert `d0 = Budget_global − Budget_blatt` setzen (statt 0). Dann gilt weiterhin ein einziges globales Budget.
- **Mehrere Randbedingungen** (z. B. Druckverlust in K *und* v_max): v_max und PS sind reine Filter (`allowed`), nur Druckverlust braucht das DP.
- **Teillast:** Nur als Filter für `v_min` (und ggf. zweite Budgetprüfung nachgelagert).
- **Praxis-Nebenbedingungen:** Mindestens gleiche Nennweite wie das Kind-Segment aufwärts (Querschnitt darf zur Maschine hin nicht kleiner werden) als zusätzlicher Filter oder per Nachbearbeitung. Als Option anbieten, nicht fest verdrahten.

### 6.3 Fixpunkt-Schleife außen

```ts
let choice = null, prev = null;
for (let round = 0; round < 4; round++) {
  fluidStatePerSegment(net, prev);            // rho, mu, dTdp aus Tabellen für aktuellen Zustand
  buildDpTable(net, dns, rho, mu, dTdp, dT);
  choice = optimize(net, K, allowed, dT, costSeg, budgetK);
  if (!choice || equalInt16(choice, prev)) break;
  prev = choice;
}
```

---

## 7. Performance-Techniken im Detail

| Maßnahme | Wirkung |
|---|---|
| Stoffdaten als Tabellen statt CoolProp-Aufruf | Größter Hebel, meist Faktor 100 bis 10.000 |
| `dp[segment][DN]` einmal berechnen, Optimierer nutzt nur Lookup | Optimierung enthält keine Hydraulik mehr |
| Typed Arrays, vorab alloziert, wiederverwendet | Keine GC-Pausen, gute Cache-Nutzung |
| Topologisch sortiert, `for`-Schleifen statt Rekursion | Kein Stack-Overflow bei tiefen Netzen, schnell |
| Haaland statt Colebrook-Iteration | Keine Iteration je Segment; genau genug für die Auslegung |
| Web Worker, Ergebnisse per `postMessage` mit Transfer | UI bleibt flüssig |
| Entprellen (z. B. 50 bis 100 ms) | Nicht bei jedem Mausziehen neu rechnen |
| Kreise parallel in mehreren Workern | Skaliert mit CPU-Kernen |
| Varianten/Szenarien als Worker-Pool | Vergleich mehrerer Auslegungen parallel |

Skalierung nach oben:

- Komplexität insgesamt etwa O(n · K · S) mit S = maximale Frontgröße (per Quantisierung deckelbar). Linear in der Netzgröße.
- Inkrementelles Rechnen (nur geänderten Teilbaum) lohnt sich erst jenseits von einigen tausend Segmenten. Vorher ist die komplette Neuberechnung schnell genug und viel einfacher zu testen.
- Ergebnis-Cache über Hash der Eingaben (Netz + Parameter), falls dieselben Varianten oft wiederkehren.

---

## 8. Validierung und Tests

1. **Stoffdaten:** Zufällige Stichprobe (z. B. 10.000 Punkte) gegen direkte CoolProp-Aufrufe vergleichen. Zielwert: relative Abweichung von ρ, μ, p unter 0,1 %. Bei Überschreitung Raster verfeinern.
2. **Hydraulik:** Einzelsegmente gegen Handrechnung und Herstellerangaben (Rohrberechnungsprogramme der Komponentenhersteller) abgleichen.
3. **Gesamtnetz:** Mehrere reale, bereits ausgelegte Anlagen nachrechnen und die Ergebnisse vergleichen.
4. **Eigenschaftstests (Property-based):**
   - Größere DN ⇒ niedrigerer Druckverlust (monoton).
   - Mehr Kälteleistung ⇒ nie kleinere Nennweite im Stamm.
   - Budget erhöhen ⇒ Kosten sinken oder bleiben gleich.
   - DP-Ergebnis ≤ Greedy-Ergebnis (Kosten).
5. **Regression:** Referenznetze mit gespeicherten Ergebnissen im CI.
6. **Grenzfälle:** Netz mit nur einem Blatt, sehr langer Strang, sehr breiter Verteiler (z. B. 50 Abzweige an einem Knoten), nicht erreichbares Budget (klare Fehlermeldung statt Absturz).

---

## 9. Benchmark-Gerüst

```ts
function bench(name: string, fn: () => void, runs = 200) {
  for (let i = 0; i < 20; i++) fn();                 // Warm-up für den JIT
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const ms = (performance.now() - t0) / runs;
  console.log(`${name}: ${ms.toFixed(3)} ms pro Lauf`);
}

bench("Netz 100 Segmente", () => solve(net100));
bench("Netz 1000 Segmente", () => solve(net1000));
bench("Netz 5000 Segmente", () => solve(net5000));
```

Dazu synthetische Netze erzeugen (Zufallsbaum mit definierter Tiefe und Verzweigung) und die Laufzeit gegen die Netzgröße auftragen. Sie sollte annähernd linear wachsen. Wenn nicht, zuerst die Frontgrößen (S) und danach unnötige Allokationen im Profiler prüfen.

---

## 10. Projektstruktur (Vorschlag)

```
pipenet/
  tools/
    gen_tables.py              # CoolProp -> Tabellen (offline)
  data/
    R744.sat.bin / .json
    R513A.sat.bin / .json
    dn/                        # Rohrlisten je Werkstoff (JSON): di, da, Wand, PS, Preis
  src/
    props/                     # Tabellenlader, lerp/bilerp, Stoffzustände
    hydraulics/                # Reibung, Formteile, Geschwindigkeit, Filter
    net/                       # Net (SoA), Kompilierung aus Editor-Modell, Sortierung
    opt/                       # Greedy, Pareto-DP, Fixpunkt
    worker/                    # Worker-Einstieg, Messaging, Pool
    editor/                    # PDF (pdf.js), Maßstab, Linien/Knoten, T-Stücke
    ui/
  test/
    props.test.ts  hydraulics.test.ts  opt.test.ts  regression/
```

Empfohlen: TypeScript (strikt), Vitest für Tests, Vite für den Build. `pdf.js` für die Planansicht, SVG oder Konva für Overlay-Zeichnen.

---

## 11. Umsetzungsreihenfolge

1. **Kernbibliothek ohne UI:** Tabellen-Generator, Lader, Interpolation, Massenstrom, Hydraulik, Test gegen CoolProp.
2. **Optimierer:** Zuerst Greedy als Vergleichswert, danach Pareto-DP.
3. **Netz-Eingabe als JSON** und Kommandozeilentest mit realen Anlagen, Benchmark.
4. **Worker-Hülle** und Ergebnisformat.
5. **Editor:** PDF laden, Maßstab, Maschine und Kühlstellen setzen, Linien, T-Stück-Logik, Höhen je Segment.
6. **Ausbau:** Weitere Kältemittel, Werkstoffe, Teillastfälle, Varianten, Berichte/Export (PDF, Stückliste).

---

## 12. Verdachtsliste für das bestehende Skript

Wenn das aktuelle JavaScript lahm ist, in dieser Reihenfolge prüfen:

- [ ] Werden Stoffdaten (CoolProp oder eine andere Zustandsgleichung) **innerhalb** von Schleifen über Segmente oder Nennweiten berechnet?
- [ ] Werden alle DN-Kombinationen durchprobiert (K^n)? Das ist bei 50 Kühlstellen nicht berechenbar. Baumstruktur nutzen (Abschnitt 6).
- [ ] Rekursive Baumdurchläufe mit Objekten, `Map`, Strings als Schlüssel in der heißen Schleife?
- [ ] Wird bei jeder Änderung das gesamte Netz inklusive UI neu aufgebaut?
- [ ] Läuft alles im Hauptthread?
- [ ] Werden Arrays in Schleifen kopiert (`slice`, Spread, `JSON.parse(JSON.stringify(...))`)?
- [ ] Wird pro Segment iterativ (Colebrook bis Konvergenz) gerechnet, obwohl der Wert für die Auslegung nur einmal pro (Segment, DN) gebraucht wird?

---

## 13. Annahmen und offene Punkte

- Grenzwerte (zulässiger Druckverlust in K je Leitungsart, v_min/v_max, Teillastfaktor) kommen aus Norm, Herstellervorgabe oder Firmenstandard und müssen konfigurierbar sein. Sie sind hier bewusst nicht fest vorgegeben.
- Rauheiten, Wandstärken, Druckklassen und Preise je Werkstoff müssen aus den Datenblättern der verwendeten Rohre stammen.
- Zusammensetzung und Stoffdaten von R458A sind vor Verwendung zu verifizieren (CoolProp-Verfügbarkeit, Herstellerdaten).
- CO2 transkritisch (Gaskühlerseite) ist ein eigener Betriebsfall mit 2D-Tabellen und eigenen Auslegungskriterien. Für den ersten Ausbau empfiehlt sich, mit Saug-, Flüssigkeits- und Heißgasleitung im unterkritischen Bereich zu starten.
- Alle Leistungsangaben sind Zielwerte und müssen mit dem Benchmark aus Abschnitt 9 auf dem Zielgerät bestätigt werden.
