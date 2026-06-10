<p align="center">
  <a href="https://december.phasehumans.com">
    <img src="web/public/logo.png" alt="December Logo" height="200">
  </a>
</p>

December is a unified, AI-driven development workspace and platform for generating, managing, and interacting with applications. Fusing design-focused frontend generation (similar to Lovable and v0) with code-focused engineering environments (similar to Codex), December bridges the gap between natural language intent and functional, production-ready codebases. It serves as a comprehensive AI-powered workspace capable of planning, visual building, and command-line execution.

## Key Workspaces

- **Web Workspace (Visual Client)**: A design and frontend-oriented visual workspace (similar to Lovable and v0) where you can build layout blocks, manipulate elements, and preview live, hot-reloaded react bundles. (Fully operational)
- **CLI Workspace (`december-cli`)**: A technical, terminal-focused workspace (similar to Codex) designed for focused command-line workflows and heavy-duty code engineering. (Development in progress)

## Features

- **AI-Powered Code Generation**: Translate user intents into structured project plans and automatically generate runnable React applications using specialized Build and Plan agents.
- **Visual Canvas Interface**: A rich, interactive web client for previewing and manipulating the state of your generated projects in real-time.
- **Robust Monorepo Structure**: Fully typed TypeScript backend and frontend combined with a lightweight, high-performance Rust runtime for heavy lifting.
- **Seamless Integrations**: Integrated with external AI models and built-in template sharing capabilities for a collaborative ecosystem.
- **Self-Hosting Ready**: Containerized local dependencies (PostgreSQL, MinIO) for easy, reproducible deployment and testing.
- **Extensible Architecture**: Designed from the ground up to support new AI models, frameworks, and deployment targets.

## Architecture

December is organized into three primary environments, working in harmony to deliver a seamless experience:

- **Web Client (`web/src`)**: A React-based frontend providing the visual canvas, code editor, and project management interfaces. It utilizes modern state management and responsive design.
- **CLI Client (`december-cli`)**: A Rust-based terminal interface designed for focused developers.
- **API Server (`server/src`)**: A Bun/Express backend handling database persistence, AI agent orchestration, and complex business logic. It securely manages user projects and templates.
- **Runtime (`runtime/src`)**: A Rust-based execution environment for secure, isolated code execution and fast validation of generated applications.

For an in-depth look at our architecture, module boundaries, and system diagrams, please read the [Architecture Documentation](ARCHITECTURE.md).

## Prerequisites

Before setting up the project, ensure you have the following installed on your local machine:

- **[Bun](https://bun.sh/)**: Required for installing dependencies, running the API server, and building the web client.
- **[Rust & Cargo](https://www.rust-lang.org/)**: Required for compiling and running the runtime execution environment.
- **[Docker Desktop](https://www.docker.com/)**: Required for running the local Postgres database and MinIO object storage containers. Ensure the Docker daemon is actively running before proceeding.

## Setup & Installation

1. **Install Dependencies**
   Run the following command at the root of the repository. This will resolve and install dependencies for both the `web` and `server` packages.

    ```bash
    bun install
    ```

2. **Start Local Infrastructure**
   Initialize the local PostgreSQL and MinIO S3 containers. This step requires Docker to be running in the background.

    ```bash
    ./scripts/containers.sh start
    ```

3. **Initialize the Database**
   Apply the Prisma migrations to set up the database schema for the server. This ensures your local database matches the current application state.

    ```bash
    cd server
    bunx prisma migrate dev
    ```

4. **Start the Application Stack**
   Launch the web client, the API server, and the Rust runtime together. This script uses a tmux session to manage the processes cleanly.

    ```bash
    ./scripts/start.sh
    ```

    Alternatively, you can run them manually in separate terminals if you prefer:
    - **Server**: `cd server && bun run dev` (Runs on port 3000 by default)
    - **Web**: `cd web && bun run dev` (Runs on port 5173 by default)
    - **Runtime**: `cd runtime && cargo run`

## Testing

December uses Bun's built-in test runner for the API server and Cargo for the Rust runtime, ensuring fast and reliable test execution.

**Running Server Unit Tests:**
To verify the integrity of the server modules without relying on the database:

```bash
cd server
bun test tests/unit
```

**Running Integration Tests:**
Integration tests validate the API routes and database interactions. Ensure your local Docker containers are running before executing these.

```bash
./scripts/test.sh
```

**Running Runtime Tests:**
To test the Rust runtime components:

```bash
cd runtime
cargo test
```

## Contributing

We welcome contributions! Please follow the coding style and naming conventions outlined in our repository guidelines. Ensure you run `bun run format:check` and all relevant tests before submitting a pull request.

## Contact

For questions, feedback, or support, please contact us at [phasehumans@gmail.com](mailto:phasehumans@gmail.com). Let's build the future of AI-driven development together!
