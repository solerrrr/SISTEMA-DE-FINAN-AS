# Controle Financeiro

Aplicação web para acompanhar receitas, despesas e saldo mensal. Feita com Node.js, Express, JavaScript puro e MySQL.

## Requisitos

- Node.js 18 ou superior
- MySQL 8 ou superior

## Configuração

1. Crie o banco e a tabela executando `schema.sql` no MySQL.
2. Entre nesta pasta e instale as dependências: `npm install`.
3. Copie `.env.example` para `.env` e preencha as credenciais do seu MySQL.
4. Inicie com `npm start` (ou `npm run dev` durante o desenvolvimento).
5. Acesse `http://localhost:3000`.

## Recursos

- Resumo mensal de receitas, despesas e saldo.
- Cadastro de receitas e despesas com data, categoria e observações.
- Filtro por mês e tipo de lançamento.
- Remoção de lançamentos.
- API JSON em `/api/transactions`, `/api/summary` e `/api/health`.

## Rotas da API

- `GET /api/transactions?month=AAAA-MM&type=income|expense`
- `GET /api/summary?month=AAAA-MM`
- `POST /api/transactions` com `description`, `amount`, `type`, `category`, `transaction_date` e `notes`.
- `DELETE /api/transactions/:id`

Este projeto é uma base local de uso individual; antes de publicar na internet, adicione autenticação e controles de acesso por usuário.
