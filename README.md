# Sistema Psicossocial Sealab

MVP para gestão do ciclo DRPS e AEP-PS: cadastros organizacionais, importação de respostas, cálculo por dimensão, avaliação técnica por GHE, matriz qualitativa DRPS × AEP-PS, plano de ação e preparação de relatórios.

## Estado da implementação

- Backend FastAPI/PostgreSQL com autenticação, modelos multiempresa e migração Alembic.
- Regras auditáveis extraídas da planilha original: 33 itens, 10 dimensões, polaridade, P1–P4, severidade e matriz P×S.
- AEP-PS com 53 itens e exigência de evidência para escores 2 e 3.
- Integração qualitativa DRPS × AEP-PS sem média matemática.
- Frontend React/TypeScript com dashboard, cadastros, importação, resultados, AEP-PS, matriz, plano de ação e relatórios.

Os dados exibidos inicialmente no frontend são demonstrativos. Os endpoints de cadastro e cálculo ficam em `/api/v1/psychosocial` e exigem autenticação.

## Decisões que precisam de validação técnica

- O mínimo de respondentes permanece configurável; o valor inicial `5` é provisório.
- O limiar formal entre DRPS favorável e desfavorável ainda deve ser aprovado.
- A agregação AEP-PS por dimensão usa o pior item como critério operacional do MVP, sem alterar a classificação final do PGR.
- A exportação Word/PDF e os formatos de integração PGR/PCMSO pertencem à fase seguinte.

## Execução local

Copie `.env.example` para `.env`, ajuste as credenciais e execute `docker compose up --watch`. A documentação da API fica em `http://localhost:8000/docs` e a interface em `http://localhost:5173`.

---

## Base técnica

Este projeto foi iniciado a partir do Full Stack FastAPI Template.

[![Test Docker Compose](../../actions/workflows/test-docker-compose.yml/badge.svg)](../../actions/workflows/test-docker-compose.yml)
[![Test Backend](../../actions/workflows/test-backend.yml/badge.svg)](../../actions/workflows/test-backend.yml)

## Technology Stack and Features

- ⚡ [**FastAPI**](https://fastapi.tiangolo.com) for the Python backend API.
  - 🧰 [SQLModel](https://sqlmodel.tiangolo.com) for the Python SQL database interactions (ORM).
  - 🔍 [Pydantic](https://docs.pydantic.dev), used by FastAPI, for the data validation and settings management.
  - 💾 [PostgreSQL](https://www.postgresql.org) as the SQL database.
- 🚀 [React](https://react.dev) for the frontend.
  - 🧩 Built into the backend application and served by FastAPI on the same domain as the API.
  - 💃 Using TypeScript, hooks, [Vite](https://vitejs.dev), and other parts of a modern frontend stack.
  - 🎨 [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com) for the frontend components.
  - 🤖 An automatically generated frontend client.
  - 🧪 [Playwright](https://playwright.dev) for end-to-end testing.
  - 🦇 Dark mode support.
- ☁️ [FastAPI Cloud](https://fastapicloud.com) for deployment.
- 🐋 [Docker Compose](https://www.docker.com) for local services and self-hosted deployment.
  - 📞 [Traefik](https://traefik.io) as a reverse proxy with automatic HTTPS.
- 🔒 Secure password hashing by default.
- 🔑 JWT (JSON Web Token) authentication.
- 📫 Email-based password recovery.
- ✉️ [React Email](https://react.email) for email templates.
- 📬 [Mailpit](https://mailpit.axllent.org) for local email testing during development.
- ✅ Tests with [Pytest](https://pytest.org).
- 🏭 CI (continuous integration) and CD (continuous deployment) based on GitHub Actions.

### Dashboard Login

![Dashboard login screenshot](img/login.png)

### Dashboard - Admin

![Admin dashboard screenshot](img/dashboard.png)

### Dashboard - Items

![Items dashboard screenshot](img/dashboard-items.png)

### Dashboard - Dark Mode

![Dark mode dashboard screenshot](img/dashboard-dark.png)

### React Email Templates

![Email templates screenshot](img/react-email.png)

### Mailpit - Local Email Testing

![Mailpit screenshot](img/mailpit.png)

### Interactive API Documentation

![API docs](img/docs.png)

## How to Use It

Click the **Use this template** button at the top of this page to create a new repository.

## Backend Development

Backend docs: [backend/README.md](./backend/README.md).

## Frontend Development

Frontend docs: [frontend/README.md](./frontend/README.md).

## Deployment

FastAPI Cloud deployment: [deployment.md](./deployment.md).

Self-hosted deployment with Docker Compose: [deployment-docker-compose.md](./deployment-docker-compose.md).

## Development

General development docs: [development.md](./development.md).

This includes the local FastAPI and Vite workflow, Docker Compose services, `.env` configuration, and more.

## Release Notes

Check the file [release-notes.md](./release-notes.md).

## License

The Full Stack FastAPI Template is licensed under the terms of the MIT license.
