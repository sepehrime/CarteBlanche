# Carte Blanche 🇫🇷🃏

> A postcard a day from Paris. A game-like French flashcard app that brings you back every day.

## 🌟 Overview

**Carte Blanche** helps you learn 1,000 everyday French expressions, idioms and phrases. Each card is a postcard with a French phrase on the front and the English meaning on the back.

Each day you get a short round of cards. Some are new, and some are cards you are due to review. Play every day to keep your streak, earn XP, level up and collect stamps.

Everything runs in your browser. There's no account, no server and nothing to install.

## 🎮 How to play

1. Open the **Play** tab to start today's round.
2. Read the French phrase, then flip the card (tap it or press <kbd>Space</kbd>).
3. Mark the card **✓ Got it** if you knew it, or **↺ Again** if you didn't. On a phone you can swipe right or left instead.
4. Reach your daily goal to finish the round and keep your streak going.

## ✨ Features

### Daily round with spaced repetition
- Each day's round mixes cards you are due to review with new cards (about a third of each round is new).
- Cards move through review boxes (Leitner system). A card you know comes back after 1, 2, 4, 7, 15, then 30 days. A card you miss goes back to the start and shows up again in the same round.
- New cards start with the easier phrases.
- After you reach your goal, you can play a 10-card bonus round.

### Progress and rewards
- **Daily streak 🔥**: reach your goal each day to grow your streak. The flame turns to an outline when your streak is at risk today.
- **Daily goal ring**: shows how far you are through today's goal (10, 20, 30 or 50 cards).
- **XP and levels**: a card you know earns 10 XP, and a card you mark "Again" still earns 3 XP. Levels have French titles, from *Touriste* up to *Immortel*.
- **Combo multiplier**: know 5 cards in a row for ×2 XP, and 10 in a row for ×3.
- **13 collectible stamps**: for example *Premier pas* (your first card), *Une semaine* (a 7-day streak), *En feu* (10 in a row), *Globe-trotteur* (cards from 10 topics), and *Oiseau de nuit* (study after 10 pm).
- **Celebrations**: a rubber-stamp "CONNU" / "ENCORE" slam on each answer, XP pop-ups, confetti and a goal-complete screen.
- **Welcome back**: when you return on a new day, a message tells you how many cards are due and whether your streak needs saving.

### Three tabs
- **Play**: today's round, one card at a time on a stacked deck.
- **Explore**: browse all 1,000 cards freely. Filter by difficulty, topic and status (new, learning, known), and shuffle the deck.
- **Carnet** (your notebook): your level and XP, day streak, best streak, phrases known and cards played. It also shows a 12-week practice calendar, the phrase of the day and your stamp collection.

### Settings
- Card direction: French → English or English → French.
- Daily goal: 10, 20, 30 or 50 cards.
- Sound effects on or off. The sounds are generated in the browser, with no audio files.
- A list of keyboard shortcuts.
- Reset all progress, with a confirmation step.

### Listen
- Press the speaker button, or <kbd>S</kbd>, to hear the French phrase read aloud with your device's text-to-speech.

### Accessibility
- Full keyboard support, with visible focus.
- Screen readers announce answers and progress, and never read the hidden side of a card.
- Light and dark mode follow your system setting.
- Animations are turned off when your system asks for reduced motion.

## ⌨️ Keyboard shortcuts

| Key | Action |
| --- | --- |
| <kbd>Space</kbd> | Flip the card |
| <kbd>K</kbd> | Got it |
| <kbd>L</kbd> | Again |
| <kbd>S</kbd> | Listen to the phrase |
| <kbd>←</kbd> / <kbd>→</kbd> | Previous / next card (Explore) |
| <kbd>Esc</kbd> | Close settings or the celebration screen |

## 🛠️ Tech Stack

- **Frontend:** plain HTML, CSS and JavaScript, with no frameworks and no build step.
- **Backend:** none.
- **Storage:** your browser's localStorage. Progress is saved under `french-flashcards-v2`, and progress from the older version is carried over automatically.
- **Fonts:** Bodoni Moda for the French phrases and Bricolage Grotesque for the interface (Google Fonts).

## 📁 Project Structure

| File | What it holds |
| --- | --- |
| `index.html` | Page layout: top stats bar, Play / Explore / Carnet screens, settings and celebration panels |
| `styles.css` | All styles, including light and dark themes and the mobile layout |
| `app.js` | App logic: daily rounds, spaced repetition, XP, streaks, stamps, sounds, swipes and confetti |
| `data.js` | The 1,000 expressions loaded by the app (`window.FRENCH_EXPRESSIONS`) |
| `french_expressions.json` | The same expressions as plain JSON |

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/sepehrime/CarteBlanche.git

# Navigate to the project directory
cd CarteBlanche
```

Then open `index.html` in any modern browser.
