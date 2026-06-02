# December

December is an advanced, AI-driven platform for generating, managing, and interacting with web applications. Powered by a robust Bun/TypeScript monorepo and a fast Rust runtime, December bridges the gap between natural language intent and functional, runnable frontend code.

## Features

- **AI-Powered Code Generation**: Translate user intents into structured project plans and automatically generate runnable React applications using specialized Build and Plan agents.
- **Visual Canvas Interface**: A rich, interactive web client for previewing and manipulating the state of your generated projects.
- **Robust Monorepo Structure**: Fully typed TypeScript backend and frontend combined with a lightweight, high-performance Rust runtime.
- **Seamless Integrations**: Integrated with external AI models and built-in template sharing capabilities.
- **Self-Hosting Ready**: Containerized local dependencies (PostgreSQL, MinIO) for easy deployment and testing.

## Architecture

December is organized into three primary environments:

- **Web Client**: A React-based frontend providing the visual canvas, code editor, and project management interfaces.
- **API Server**: A Bun/Express backend handling database persistence, AI agent orchestration, and business logic.
- **Runtime**: A Rust-based execution environment for secure execution and validation.

For an in-depth look at our architecture, module boundaries, and system diagrams, please read the [Architecture Documentation](ARCHITECTURE.md).

## Prerequisites

Before setting up the project, ensure you have the following installed on your machine:

- **[Bun](https://bun.sh/)**: Required for installing dependencies, running the server, and building the web client.
- **[Rust & Cargo](https://www.rust-lang.org/)**: Required for running and compiling the runtime environment.
- **[Docker Desktop](https://www.docker.com/)**: Required for running the local Postgres database and MinIO object storage containers. Ensure the Docker daemon is actively running.

## Setup

1. **Install Dependencies**
   Run the following command at the root of the repository. This will install dependencies for both the `web` and `server` packages.

    ```bash
    bun install
    ```

2. **Start Local Infrastructure**
   Initialize the local PostgreSQL and MinIO S3 containers. This step requires Docker to be running.

    ```bash
    ./scripts/containers.sh start
    ```

3. **Initialize the Database**
   Apply the Prisma migrations to set up the database schema for the server.

    ```bash
    cd server
    bunx prisma migrate dev
    ```

4. **Start the Application Stack**
   Launch the web client, the API server, and the Rust runtime together. This script uses a tmux session to manage the processes.

    ```bash
    ./scripts/start.sh
    ```

    Alternatively, you can run them manually in separate terminals:
    - **Server**: `cd server && bun run dev`
    - **Web**: `cd web && bun run dev`
    - **Runtime**: `cd runtime && cargo run`

## Testing

December uses Bun's built-in test runner for the server and Cargo for the Rust runtime.

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

## Contact

For questions, feedback, or support, please contact us at phasehumans@gmail.com.
