# Cloth & Form — Fabric Studio

A browser-based fabric and outfit reference tool. Upload or paste fabric photos, crop them, create quick or hand-arranged fabric samples, apply selected regions to clothing panels, pose a 3D mannequin, and keep local pattern, photo, and pose histories.

## Run locally

Open `index.html` in a modern browser with an internet connection. Choose Man or Woman in the top bar. The woman page is also available at `woman.html`. The 3D preview loads Three.js from jsDelivr and the fonts load from Google Fonts.

## Publish with GitHub Pages

Place these files at the repository root, then in GitHub open **Settings → Pages** and choose **Deploy from a branch**, branch `main`, folder `/(root)`. The site will be served at `https://<your-account>.github.io/<repository>/`.

Fabric photos, pattern history, and pose history are stored in the visitor's browser using IndexedDB. They are not uploaded to the repository or shared between visitors.