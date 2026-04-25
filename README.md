# 🌾 Hay Day Scammer List

> Eine Community-gepflegte Liste bekannter Scammer aus dem Hay Day Discord.

[![GitHub Pages](https://img.shields.io/badge/Website-Live-brightgreen?style=flat-square&logo=github)](https://maxknuff.github.io/HaydayScammerlist/)

---

## 🚀 Nutzung

### Online (empfohlen)
Öffne einfach die GitHub Pages Website:  
👉 **[maxknuff.github.io/HaydayScammerlist](https://maxknuff.github.io/HaydayScammerlist/)**

Die Seite lädt automatisch immer die neueste Scammer-Liste direkt von GitHub.

### Offline / Lokal
1. Klicke auf **Code → Download ZIP** oder klone das Repo:
   ```bash
   git clone https://github.com/Maxknuff/HaydayScammerlist.git
   ```
2. Öffne `index.html` in deinem Browser — fertig! (Doppelklick reicht)

> **Hinweis:** Für das automatische Laden der Liste wird eine Internetverbindung benötigt.

---

## 📋 Scammer-Liste aktualisieren

Editiere `scammerlist.txt`. Das Format ist simpel:

```
# Kommentar (wird ignoriert)
Name#Tag | Grund | Status
```

**Felder:**
| Feld | Beschreibung | Pflicht |
|------|-------------|---------|
| `Name#Tag` | Discord-Name mit optionalem Tag | ✅ |
| `Grund` | Warum ist die Person gelistet? | ❌ |
| `Status` | `confirmed` oder `suspected` | ❌ (Standard: confirmed) |

**Beispiele:**
```
MaxScammer#1234 | Diamanten gestohlen | confirmed
FakeFarmer | Tausch nicht gesendet
VerdächtigerUser#5678 | Schlechte Erfahrungen gemeldet | suspected
```

### JSON-Format (alternativ)
Du kannst die Liste auch als `scammerlist.json` speichern:

```json
[
  { "name": "MaxScammer", "tag": "#1234", "reason": "Diamanten gestohlen", "status": "confirmed" },
  { "name": "FakeFarmer", "tag": "#5678", "reason": "Tausch nicht gesendet" }
]
```

Ändere dann in `app.js` die Zeile:
```js
GITHUB_FILE: 'scammerlist.json',
```

---

## ⚙️ GitHub Pages aktivieren

1. Gehe zu **Settings → Pages**
2. Wähle **Branch: main** und **Folder: / (root)**
3. Speichere — die Seite ist in wenigen Minuten live

---

## 🛡️ Haftungsausschluss

Diese Liste wird von der Community gepflegt und erhebt keinen Anspruch auf Vollständigkeit. Kein offizielles Supercell-Produkt.
