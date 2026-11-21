# Rule checks (owner's rules 1–13)

One check per rule (the rules are written in `src/rules.ts` and in the document «Xapp Freight — How the whole app works», section 8).

    cd apps/showit/scripts/rules-test
    npm i --no-save esbuild@0.24.0   # once
    node build.js && node out.js

Phone-only modules (react-native, expo, storage) are replaced by `stub.js`; the rules themselves run as in the app.
