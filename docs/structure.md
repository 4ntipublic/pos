# Project Structure (Proposed)

root/
  app/
    main/
      main.js
      preload.js
      services/
        database.js
        printerService.js
        siiService.js
      ipc/
        channels.js
        handlers/
    renderer/
      index.html
      src/
        App.jsx
        main.jsx
        components/
        pages/
          POS.jsx
          Inventory.jsx
      styles/
        tailwind.css
    shared/
      constants/
      schemas/
      utils/
  assets/
    icons/
    images/
  build/
  scripts/
  package.json
  README.md
  .env
  .gitignore

Notes:
- main/ contains Electron main process, preload, and backend services.
- renderer/ contains React UI and static assets.
- shared/ contains cross-process schemas, constants, and utilities.
- build/ is reserved for build resources (icons, installer config).
