#!/bin/bash

# Script para criar releases do SDK Logger
# Uso: ./scripts/release.sh [patch|minor|major] [mensagem]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_message() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se estamos no branch main
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    print_error "Você deve estar no branch 'main' para criar um release"
    print_message "Execute: git checkout main"
    exit 1
fi

# Verificar se há mudanças não commitadas
if ! git diff-index --quiet HEAD --; then
    print_error "Há mudanças não commitadas. Faça commit antes de criar um release"
    exit 1
fi

# Verificar se o repositório está atualizado
git fetch origin
if [ "$(git rev-list HEAD...origin/main --count)" != "0" ]; then
    print_error "Seu branch local não está atualizado com origin/main"
    print_message "Execute: git pull origin main"
    exit 1
fi

# Verificar argumentos
if [ $# -eq 0 ]; then
    print_error "Uso: $0 [patch|minor|major] [mensagem opcional]"
    print_message "Exemplos:"
    print_message "  $0 patch 'Correção de bug'"
    print_message "  $0 minor 'Nova funcionalidade'"
    print_message "  $0 major 'Breaking change'"
    exit 1
fi

RELEASE_TYPE=$1
RELEASE_MESSAGE=${2:-"Release $RELEASE_TYPE"}

# Validar tipo de release
case $RELEASE_TYPE in
    patch|minor|major)
        ;;
    *)
        print_error "Tipo de release inválido: $RELEASE_TYPE"
        print_message "Use: patch, minor ou major"
        exit 1
        ;;
esac

print_message "Criando release $RELEASE_TYPE..."

# Executar testes
print_message "Executando testes..."
npm test

# Executar build
print_message "Fazendo build..."
npm run build

# Atualizar versão no package.json
print_message "Atualizando versão..."
npm version $RELEASE_TYPE -m "$RELEASE_MESSAGE"

# Obter nova versão
NEW_VERSION=$(node -p "require('./package.json').version")
TAG_NAME="v$NEW_VERSION"

print_message "Nova versão: $NEW_VERSION"
print_message "Tag: $TAG_NAME"

# Fazer push da tag
print_message "Fazendo push da tag..."
git push origin main --tags

print_success "Release $TAG_NAME criado com sucesso!"
print_message "O GitHub Actions irá publicar automaticamente no NPM"
print_message "Você pode acompanhar o progresso em: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"

# Mostrar próximos passos
echo ""
print_message "Próximos passos:"
print_message "1. Acompanhe o workflow no GitHub Actions"
print_message "2. Verifique se o pacote foi publicado: npm view @psouza.yuri/sdk-logger@$NEW_VERSION"
print_message "3. Atualize a documentação se necessário"

