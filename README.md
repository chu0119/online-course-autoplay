# Online Course Auto-Play Assistant

A Tampermonkey userscript that provides a floating control panel for online learning platforms, enabling automatic sequential playback of course videos with progress tracking.

## Features

- **Sequential Auto-Play** - Automatically plays the next episode when the current one finishes
- **Floating Control Panel** - Draggable GUI showing real-time playback progress for all episodes
- **Cross-Course Navigation** - Automatically proceeds to the next unfinished course after completing one
- **Dialog Auto-Dismiss** - Automatically handles session timeout dialogs
- **Progress Tracking** - Visual progress bar and per-episode completion status

## Supported Platforms

- China Education Cadre Network College (study.enaea.edu.cn)

## Prerequisites

- A modern browser (Chrome / Edge / Firefox)
- [Tampermonkey](https://www.tampermonkey.net/) browser extension installed

## Installation

1. Install the Tampermonkey extension for your browser:
   - [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   - [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)

2. Click on the Tampermonkey icon in your browser toolbar, then click "Create a new script"

3. Delete the default template content, then copy and paste the contents of `enaea-auto-play.js`

4. Press `Ctrl+S` to save

5. Visit the learning platform and refresh the page

## Usage

1. Navigate to a course video page on the learning platform
2. A dark floating panel will appear in the top-left corner showing:
   - Course name
   - List of all episodes with progress
   - Current playback time
   - Overall completion progress bar
3. The panel is draggable - drag the header to reposition it
4. Click the `−` button to minimize the panel

### How It Works

```
Episode playing → Episode ends → Auto-switch to next unfinished episode
                                     ↓
                              All episodes done → Return to course list
                                     ↓
                              Auto-select next unfinished course → Continue
```

## Configuration

Edit these constants at the top of the script to customize behavior:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `SPEED` | `1` | Video playback speed multiplier (1/2/4) |
| `CHECK_MS` | `5000` | Progress check interval in milliseconds |
| `SWITCH_DELAY` | `2000` | Delay before switching episodes in milliseconds |

## Disclaimer

This project is intended **solely for educational and research purposes**.

- Users are responsible for complying with the terms of service of any platform they use
- The author does not encourage or endorse any violation of platform policies
- Use at your own discretion and risk
- Please respect the spirit of continuous learning and complete your coursework diligently

## License

[MIT](LICENSE)
