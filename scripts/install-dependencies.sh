#!/bin/bash

echo "🚀 Instalando dependências da SDK Logger..."

# Instalar dependências de produção
echo "📦 Instalando dependências de produção..."
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-otlp-grpc @opentelemetry/exporter-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions winston winston-transport

# Instalar dependências de desenvolvimento
echo "🔧 Instalando dependências de desenvolvimento..."
npm install --save-dev @types/node @types/jest @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint jest ts-jest typescript

# Criar arquivo .env se não existir
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp env.example .env
    echo "✅ Arquivo .env criado. Configure suas variáveis de ambiente."
else
    echo "ℹ️  Arquivo .env já existe."
fi

# Build do projeto
echo "🔨 Fazendo build do projeto..."
npm run build

echo "✅ Instalação concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure suas variáveis de ambiente no arquivo .env"
echo "2. Execute 'npm test' para rodar os testes"
echo "3. Execute 'npm run dev' para desenvolvimento com watch"
echo ""
echo "📚 Consulte o README.md para mais informações sobre uso."
