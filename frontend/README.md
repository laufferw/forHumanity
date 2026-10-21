# forHumanity frontend

React app built with [Vite](https://vite.dev/) and tested with [Vitest](https://vitest.dev/).

| Command           | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `npm start`       | Dev server on http://localhost:3000 with hot reload |
| `npm run build`   | Production build into `build/`                      |
| `npm run preview` | Serve the production build locally                  |
| `npm test`        | Unit tests (Vitest + Testing Library, jsdom)        |
| `npm run lint`    | ESLint                                              |
| `npm run format`  | Prettier                                            |

`REACT_APP_API_URL` sets the API base URL at build time (default `http://localhost:5000/api`).
The `REACT_APP_` prefix is kept from Create React App so existing env files and Docker build args
keep working; Vite also accepts `VITE_`-prefixed variables.
