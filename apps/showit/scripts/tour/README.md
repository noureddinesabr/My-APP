# Screen tour

Visits every page of the app (customer and driver) in the browser preview and saves a screenshot of each in Arabic, French and English, light and dark, plus `report.json` with automatic checks: text cut off with "…", text running off the screen, Latin words left in the Arabic app.

```
npx expo export --platform web --output-dir /tmp/web
python3 scripts/build-preview.py /tmp/web /tmp/xapp.html
node scripts/tour/tour.js /tmp/xapp.html /tmp/tour 640        # phone height 640
node scripts/tour/tour-driver.js /tmp/xapp.html /tmp/tour 640 # second request, driver job pages
```

The AI's photo reading is replaced by a fixed example (the tour needs no key). Language and colours are switched with `window.__xapp` (browser preview only, set in `App.tsx`). Run it before every preview and APK, and look at the Arabic light pictures first.
