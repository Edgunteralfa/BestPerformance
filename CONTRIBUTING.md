# Working on BestPerformance

Patches, bug notes, and ideas are welcome. Please read this before opening an issue or a pull request.

## How to behave

Talk about the change, not the person. Keep reviews short and specific.

## What belongs here

BestPerformance is a local notes window for talks, calls, and rehearsals. It stays on top of other programs and stays out of screen capture.

We will close pull requests that add generated answers, help with tests or interviews, or try to slip past exam monitoring. Those are outside the product.

## Bugs

Look through open issues first. If yours is new, use the bug template and include:

- a title that says what broke
- the clicks or keys that lead to it
- what you expected and what you saw
- your Windows version and the BestPerformance version
- a screenshot when the picture explains it faster than words

## Ideas

Search existing requests, then open a feature request. Say what you are trying to do, why the current window gets in the way, and, if you have one, a rough approach.

## Pull requests

1. Fork the repo and branch from `main`.
2. Match the style already in the file you touch.
3. Try the path you changed, including the locked window if you touched clicks or hotkeys.
4. Update `readme.md` when a person using the app would notice the change.
5. Describe the result in the pull request, not only the diff.

## Running it locally

You need [Node.js](https://nodejs.org/) 20 or newer and [Rust](https://rustup.rs/) 1.77 or newer.

```bash
git clone https://github.com/Edgunteralfa/BestPerformance.git
cd BestPerformance/hidescreen-edhunter
npm install
npm run tauri dev
```

A release installer:

```bash
npm run tauri build
```

The Windows setup file lands in `src-edhunter/target/release/bundle/nsis/`.

## Style

Write code, comments, and docs in English.

The window is TypeScript and React. Run `npm run lint` before you push. The native side is Rust 2021: `cargo fmt`, then `cargo clippy`. Keep lines near 100 characters.

TypeScript uses `camelCase` for values, `PascalCase` for components and types, and `UPPER_SNAKE_CASE` for constants. Rust uses `snake_case`, `PascalCase` for types, and `SCREAMING_SNAKE_CASE` for constants.

Comment a public function when its name does not already say what it returns. Skip comments that repeat the next line.

## Check before you ask for review

- The window opens and the title bar still moves it.
- Settings open, apply, and are still there after a restart.
- A share or recording in OBS or Zoom does not show the notes.
- Hotkeys still fire while the window is locked.
- Lock can be turned off again, including with Escape.
- The terminal shows no new errors from your change.

If you touched capture exclusion, also try the Windows Snipping Tool and the Teams desktop app.

## Where the code lives

```
BestPerformance/
├── hidescreen-edhunter/
│   ├── src/                 # the window (React)
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   └── src-edhunter/src/    # native side
│       ├── lib.rs
│       ├── windows_api.rs
│       ├── keyboard_hook.rs
│       └── mouse_hook.rs
├── readme.md
└── CONTRIBUTING.md
```

Questions can go in an issue labeled `question`.
