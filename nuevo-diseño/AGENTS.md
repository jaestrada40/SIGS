<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- All backend calls go through the typed client in src/lib/api.ts against the external REST API (VITE_API_URL); no Lovable Cloud/Supabase, per the user contract.
- Session token lives in localStorage and protected pages are wrapped in AppShell, which redirects to / client-side.
- Demo mode (token "demo") is served by src/lib/demo.ts and persisted to localStorage so changes survive reloads.
- AI features run in createServerFn (*.functions.ts) calling Lovable AI Gateway via src/lib/ai-gateway.server.ts; keys never reach the browser.
- package.json overrides @ai-sdk/provider to one version so ai and @ai-sdk/openai share types.
