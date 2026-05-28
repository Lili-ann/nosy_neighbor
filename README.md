# NOSY NEIGHBOR - Multiplayer Game

Nosy Neighbor is a real-time multiplayer game built with React, Flask-SocketIO, Redis, RabbitMQ, and Docker.

## Description

- Frontend: React + Vite
- Backend: Flask + Flask-SocketIO
- Game state: Redis
- Audit logging: RabbitMQ
- Deployment: Docker Compose on Google Compute Engine

## Project Structure

```text
nosy_neighbor/
|-- backend/
|   |-- app.py
|   |-- audit.py
|   |-- Dockerfile
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |-- Dockerfile
|   |-- package.json
|   `-- .env
|-- docker-compose.yml
`-- README.md
```

## Required Ports

The VM must allow these public ports:

```text
5173 - React frontend
5000 - Flask backend
```

## Open Google Compute Engine VM

## I assume you have your VM  instances and firewall policy and docker already set up

On the VM, run:

Check Docker version:

```bash
docker --version
docker-compose --version
```

If Docker gives a permission error, use `sudo`:

```bash
sudo docker ps
```

## Then Clone the Project From GitHub

On the VM:

```bash
git clone YOUR_GITHUB_REPO_URL
cd nosy_neighbor
```

Example:

```bash
git clone https://github.com/your-username/nosy_neighbor.git
cd nosy_neighbor
```

You should see:

```text
backend
frontend
docker-compose.yml
README.md
```

## Set the Backend IP for the Frontend

Edit the frontend .env file:

```bash
nano frontend/.env
```

Set it to your VM external IP:

```env
VITE_SERVER_ID=YOUR_VM_EXTERNAL_IP
``` 

Do not include `http://` and do not include `:5000`.

## Start the Project

From the project root:

```bash
sudo docker-compose up --build -d
```

Check the containers:

```bash
sudo docker-compose ps
```

You should see containers like:

```text
nosy-frontend
nosy-backend
nosy-redis
nosy-rabbitmq
nosy-audit-worker
```

## Open the Game

Frontend:

```text
http://YOUR_VM_EXTERNAL_IP:5173
```

Backend health check:

```text
http://YOUR_VM_EXTERNAL_IP:5000
```

The backend should show:

```text
Nosy Neighbor Backend is running
```

## Then You are ready to play