# Frontend For Cram Project

## Requirements

- `npm 11.4.2`
- `node 24.4.1 LTS`

## Quick Start

* Install `pnpm` ([recommended](https://nextjs.org/learn/dashboard-app/getting-started) by Next.js)
    ```bash
    npm install -g pnpm
    ```
* Install dependencies into the `node_modules/`
    ```bash
    pnpm install
    ```
* Set `NEXT_PUBLIC_CRAM_BACKEND_URL` in `.env`:
    ```bash
    echo 'NEXT_PUBLIC_CRAM_BACKEND_URL=http://localhost:8080' >> .env
    ```
* Build artifacts
    ```bash
    pnpm run build
    ```
* Run project on `http://localhost:3000`
    ```bash
    pnpm run dev
    ```

## Structure

* `app` - root of all source files
    * nested folders with `page.tsx` are used for routing:
        * `/` - home http://localhost:3000/
        * `/login` - implementation of login page http://localhost:3000/login
        * `/profile` - user's profile page http://localhost:3000/profile
    * `layout.tsx` - entry point (~ `main()`)
    * `lib/client.ts` - Axios-based client for Cram Backend REST API
* `package.json` - contains list of dependencies and run configs (~ `pom.xml`)
* `node_modules` - contains libraries, on which this project is dependant (do not commit)
* `pnpm-lock.yaml` - contains strict list of dependencies with versions
* `tailwind.config.ts` - CSS magic
* `jest.config.ts` - Jest (test framework) magic
* `__tests__` - snapshot and BD tests

## Development

* Run tests

    ```bash
    pnpm run test
    ```