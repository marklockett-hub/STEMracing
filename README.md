# STEM Racing VR Design Lab

A playable, browser-based **Meta Quest 2 / WebXR** engineering game. Race two miniature CO₂-style cars on a simulated **20-metre drag strip** while exploring mass, aerodynamic drag, wheel losses, and reaction time. The game works in desktop browsers for classroom testing, then enters immersive VR in the Quest Browser.

## Files

- `index.html` — game entry point and desktop control panel
- `game.js` — Three.js WebXR world, virtual reality controller interactions, game logic and simplified vehicle physics
- `styles.css` — desktop user interface
- `README.md` — these instructions

## Playing on a computer

1. Ensure you have an internet connection. The game's Three.js library loads from jsDelivr.
2. Open this folder in a terminal and run `python3 -m http.server 8000`.
3. Visit **http://localhost:8000** in Chrome, Firefox, Edge, or a current Chromium-based browser.
4. Choose chassis mass, body profile and wheel/axle setup.
5. Click **STAGE NEXT RACE** and watch the countdown. At the green light, hit **Space** or **LAUNCH CAR**. Pressing early gives a false start.
6. Compare both car times and the player's reaction time. Change one variable, then run the next race.

Use the mouse to orbit the camera, and the wheel to zoom.

## Playing in a Meta Quest 2

WebXR requires a **secure HTTPS address** (ordinary HTTP from another device on your home network is normally not enough). A straightforward option is GitHub Pages:

1. Create a new GitHub repository.
2. Upload `index.html`, `game.js`, and `styles.css` into the repository root.
3. In repository Settings > Pages, set **Build and deployment** to **Deploy from a branch**, choose `main` and `/ (root)`, then save.
4. Once GitHub Pages provides an `https://...github.io/...` address, open it with **Meta Quest Browser** on your Quest 2.
5. Select **ENTER VR**. A gold-and-navy **TSS STEM RACING** 3D garage console should appear directly in front of your headset. The regular desktop panels deliberately disappear in immersive VR.
6. Point either Quest controller at the **MASS − / MASS +**, **AERO ◀ / ▶**, and **WHEELS ◀ / ▶** buttons and press its **index-finger trigger** to change the car.
7. Select **RACE CONTROL >>** above the garage console, then point and trigger **STAGE RACE**. After the green light, use **LAUNCH / TRIGGER**, or press the trigger while aiming away from the race board.
8. Select **<< DESIGN GARAGE** to return to car adjustments and rerun the experiment. If the console is out of view, **press either controller's grip button** to recenter it in front of your headset.

**Quest troubleshooting:** If the old boards or generic STEM Racing sign still appear, close the VR session and reload the site in Quest Browser (or open the URL with `?v=tss-vr2`). When using the headset, point and press the **trigger**, rather than using the A/B buttons.

The **ENTER VR** button is only offered when the browser supports immersive WebXR. Meta Quest Browser supports WebXR on Quest 2. If the button isn't available, check that the address uses HTTPS and that you're using the headset's browser. The app runs as a website and is not a native `.apk` install.

## Classroom engineering challenge

Students investigate the effects of three variables and collect measurements over multiple runs:

| Variable | Options | Simulated trade-off |
| --- | --- | --- |
| Chassis mass | 45–70 g | Lighter cars accelerate faster |
| Aero profile | Standard / Streamlined / Race | Lower drag comes with modest added mass |
| Wheels | Standard / Low-friction / Precision | Lower rolling resistance comes with added bearing mass |

Suggested task: keep two variables fixed, run three trials with different values of the third variable, then compare *car time* rather than total time. Next, compare total time to see the influence of reaction time. Ask students to explain why the two are different.

### Important modeling note

The effective aerodynamic drag area in the design panel is *CdA* (drag coefficient multiplied by frontal area), not an independent measurement of frontal area. The physics is a simplified educational model with a decaying propulsion force, speed-squared aerodynamic drag and a constant rolling resistance. It uses **illustrative, not measured**, force and drag values. It has **not** been calibrated against official STEM Racing competition cars or timing equipment. Official rules and engineering constraints may vary by class, region and season. This is not a compliance checker or a replacement for physical prototype testing.

## Technical notes

- Built with Three.js WebXR, not Unity. No Quest developer mode needed for the hosted browser version.
- The desktop interface overlays the track; in VR, a single TSS-branded 3D console switches between the Design Garage and Race Control views, with trigger-based selections and grip recentering.
- The best **car time** is stored in that browser's local storage (if allowed).
- The opponent has slightly variable simulated reaction time.
- The default track length is set in `game.js` using `TRACK_LENGTH = 20`.
- Three.js is pinned to `0.180.0` through the HTML importmap.
- A reliable internet connection is needed to load the hosted library unless you vendor it locally yourself. When deployed on GitHub Pages, the files in this folder remain your project and are editable.

## Ideas for version 2

A real-world data mode importing CSV times from track timing gear, CAD/GLB custom car uploads, a leaderboard for multiple classroom teams, and a display that compares trial runs with a mass/drag/rolling-resistance graph.

## References

- Meta developers: https://developers.meta.com/vr/documentation/web/webxr-overview/
- Meta WebXR HTTPS requirements: https://developers.meta.com/vr/documentation/web/port-vr-xr/
- Three.js VRButton: https://threejs.org/docs/pages/VRButton.html
- Official STEM Racing competition guidance: check the current guidebooks and regulations for your own class/region.